import { CanonicalError, canonicalize, type JsonValue } from "./canonical.ts";
import { HashUnavailableError, sha256Hex } from "./hash.ts";
import {
  AUDIT_SCHEMA_VERSION,
  CHAIN_EVENT_TYPES,
  GENESIS_HASH,
  type AuditEvent,
  type FailureCode,
  type NewAuditEvent,
  type VerificationResult,
} from "./types.ts";

const HEX_64 = /^[0-9a-f]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const FAILURE_TEXT: Record<FailureCode, string> = {
  empty: "No audit events available.",
  "missing-field": "An audit event is missing a required field.",
  "bad-sequence": "Event sequence is not contiguous.",
  gap: "Event sequence has a gap.",
  "duplicate-id": "Duplicate event id.",
  "duplicate-sequence": "Duplicate sequence number.",
  genesis: "The first event does not use the genesis previous hash.",
  "prev-link": "Previous hash does not match the preceding event hash.",
  "hash-mismatch": "Stored event hash does not match the recomputed SHA-256 digest.",
  "lot-mismatch": "Event lot id does not match the verification scope.",
  "head-mismatch":
    "Chain-head checkpoint does not match the last event. The tail may have been removed or the checkpoint was not updated.",
  unsupported: "Audit record contains a value that cannot be hashed consistently.",
};

export interface VerifyOptions {
  scope: "lot" | "full-chain";
  lotId?: string;
  expectedHead?: string | null;
  verifiedAt?: string;
}

/** Fields covered by the digest, in the canonicalizer's sorted-key form. */
export function hashableContent(event: Omit<AuditEvent, "eventHash">): {
  [key: string]: JsonValue;
} {
  return {
    actorId: event.actorId,
    actorType: event.actorType,
    eventId: event.eventId,
    eventType: event.eventType,
    lotId: event.lotId,
    payload: event.payload,
    previousHash: event.previousHash,
    schemaVersion: event.schemaVersion,
    sequence: event.sequence,
    timestamp: event.timestamp,
  };
}

export async function digestEvent(event: Omit<AuditEvent, "eventHash">): Promise<string> {
  return sha256Hex(canonicalize(hashableContent(event)));
}

export function newEventId(): string {
  if (typeof crypto.randomUUID !== "function") {
    throw new HashUnavailableError("Secure event id unavailable. No event was stored.");
  }
  return crypto.randomUUID();
}

export function utcNow(date = new Date()): string {
  return date.toISOString();
}

/**
 * Append one business event. The new chain is verified before it is returned.
 * A repeated eventId is a no-op so a retry does not fork the chain.
 */
export async function appendEvent(events: AuditEvent[], input: NewAuditEvent): Promise<AuditEvent[]> {
  if (input.eventId && events.some((event) => event.eventId === input.eventId)) {
    return events;
  }
  const prior = await verifyChain(events, {
    scope: "lot",
    lotId: input.lotId,
    expectedHead: events.length === 0 ? null : events[events.length - 1]?.eventHash,
  });
  if (events.length > 0 && !prior.valid) {
    throw new Error(prior.failureReason ?? "Refusing to extend a chain that does not verify.");
  }

  const withoutHash = {
    eventId: input.eventId ?? newEventId(),
    sequence: events.length + 1,
    lotId: input.lotId,
    eventType: input.eventType,
    timestamp: input.timestamp ?? utcNow(),
    actorId: "anonymous" as const,
    actorType: "unauthenticated" as const,
    payload: input.payload,
    previousHash: events.length === 0 ? GENESIS_HASH : events[events.length - 1].eventHash,
    schemaVersion: AUDIT_SCHEMA_VERSION,
  };
  const event: AuditEvent = { ...withoutHash, eventHash: await digestEvent(withoutHash) };
  const next = [...events, event];
  const checked = await verifyChain(next, {
    scope: "lot",
    lotId: input.lotId,
    expectedHead: event.eventHash,
  });
  if (!checked.valid) {
    throw new Error(checked.failureReason ?? "Appended event failed verification.");
  }
  return next;
}

export async function verifyChain(
  events: AuditEvent[],
  options: VerifyOptions,
): Promise<VerificationResult> {
  const verifiedAt = options.verifiedAt ?? utcNow();
  const base = {
    verifiedAt,
    scope: options.scope,
    checkedEventCount: 0,
    firstInvalidSequence: null as number | null,
  };

  if (events.length === 0) {
    return { ...base, valid: false, failureCode: "empty", failureReason: FAILURE_TEXT.empty };
  }

  const seenIds = new Set<string>();
  const seenSeq = new Set<number>();
  for (const event of events) {
    if (seenIds.has(event.eventId)) {
      return fail(base, event.sequence, "duplicate-id");
    }
    seenIds.add(event.eventId);
    if (seenSeq.has(event.sequence)) {
      return fail(base, event.sequence, "duplicate-sequence");
    }
    seenSeq.add(event.sequence);
  }

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedSequence = index + 1;
    const fieldError = fieldProblem(event);
    if (fieldError) return fail(base, event.sequence || expectedSequence, fieldError, index);

    if (options.scope === "lot" && options.lotId && event.lotId !== options.lotId) {
      return fail(base, event.sequence, "lot-mismatch", index);
    }
    if (event.sequence !== expectedSequence) {
      const code = event.sequence > expectedSequence ? "gap" : "bad-sequence";
      return fail(base, event.sequence, code, index);
    }
    const expectedPrev = index === 0 ? GENESIS_HASH : events[index - 1].eventHash;
    if (event.previousHash !== expectedPrev) {
      return fail(base, event.sequence, index === 0 ? "genesis" : "prev-link", index);
    }
    let recomputed: string;
    try {
      recomputed = await digestEvent(event);
    } catch (error) {
      if (error instanceof CanonicalError || error instanceof HashUnavailableError) {
        return fail(base, event.sequence, "unsupported", index);
      }
      throw error;
    }
    if (recomputed !== event.eventHash) {
      return fail(base, event.sequence, "hash-mismatch", index);
    }
  }

  if (options.expectedHead && options.expectedHead !== events[events.length - 1].eventHash) {
    return fail(base, events.length + 1, "head-mismatch", events.length);
  }

  return {
    ...base,
    valid: true,
    checkedEventCount: events.length,
    failureCode: null,
    failureReason: null,
  };
}

/**
 * Copy the chain and alter one payload without recomputing its hash.
 * Does not mutate the input array or its objects.
 */
export function demonstratePayloadTamper(events: AuditEvent[], sequence = 2): AuditEvent[] {
  if (!events.some((event) => event.sequence === sequence)) {
    throw new Error("Tamper demonstration could not find that sequence.");
  }
  return events.map((event) => {
    if (event.sequence !== sequence) return event;
    return {
      ...event,
      payload: { ...event.payload, tamperDemonstration: true },
    };
  });
}

function fieldProblem(event: AuditEvent): FailureCode | null {
  if (!event || typeof event !== "object") return "missing-field";
  if (typeof event.eventId !== "string" || event.eventId.length === 0) return "missing-field";
  if (!Number.isInteger(event.sequence) || event.sequence < 1) return "bad-sequence";
  if (typeof event.lotId !== "string" || event.lotId.length === 0) return "missing-field";
  if (!CHAIN_EVENT_TYPES.includes(event.eventType)) return "missing-field";
  if (typeof event.timestamp !== "string" || !ISO_UTC.test(event.timestamp)) return "missing-field";
  if (event.actorId !== "anonymous" || event.actorType !== "unauthenticated") return "missing-field";
  if (event.schemaVersion !== AUDIT_SCHEMA_VERSION) return "unsupported";
  if (typeof event.previousHash !== "string" || !HEX_64.test(event.previousHash)) return "missing-field";
  if (typeof event.eventHash !== "string" || !HEX_64.test(event.eventHash)) return "missing-field";
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    return "missing-field";
  }
  return null;
}

function fail(
  base: { verifiedAt: string; scope: "lot" | "full-chain"; firstInvalidSequence: number | null },
  sequence: number,
  code: FailureCode,
  checked = 0,
): VerificationResult {
  return {
    valid: false,
    checkedEventCount: checked,
    firstInvalidSequence: sequence,
    failureCode: code,
    failureReason: FAILURE_TEXT[code],
    verifiedAt: base.verifiedAt,
    scope: base.scope,
  };
}
