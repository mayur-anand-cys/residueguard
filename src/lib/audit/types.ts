import type { JsonValue } from "./canonical";

/** 64 zero hex chars. First event's previousHash. Not a hash of any record. */
export const GENESIS_HASH = "0".repeat(64);

export const AUDIT_SCHEMA_VERSION = 1 as const;

/**
 * Business events included in the integrity chain.
 * Viewing the record and running verification are diagnostics. They are not
 * appended, so checking the chain does not rewrite the chain.
 */
export const CHAIN_EVENT_TYPES = [
  "lot_audit_created",
  "residue_result_recorded",
  "compliance_assessment_generated",
  "report_exported",
] as const;

export type ChainEventType = (typeof CHAIN_EVENT_TYPES)[number];

export interface AuditEvent {
  eventId: string;
  sequence: number;
  lotId: string;
  eventType: ChainEventType;
  /** UTC ISO-8601 with millisecond precision, already canonical. Never localized. */
  timestamp: string;
  actorId: "anonymous";
  actorType: "unauthenticated";
  payload: { [key: string]: JsonValue };
  previousHash: string;
  eventHash: string;
  schemaVersion: typeof AUDIT_SCHEMA_VERSION;
}

export type FailureCode =
  | "empty"
  | "missing-field"
  | "bad-sequence"
  | "gap"
  | "duplicate-id"
  | "duplicate-sequence"
  | "genesis"
  | "prev-link"
  | "hash-mismatch"
  | "lot-mismatch"
  | "head-mismatch"
  | "unsupported";

export interface VerificationResult {
  valid: boolean;
  checkedEventCount: number;
  firstInvalidSequence: number | null;
  failureCode: FailureCode | null;
  /** Stable English diagnostic. UI translates `failureCode`; this string is not localized. */
  failureReason: string | null;
  /** UTC ISO timestamp of when verification ran. Not an input to event hashes. */
  verifiedAt: string;
  scope: "lot" | "full-chain";
}

export interface AuditStoreData {
  schemaVersion: typeof AUDIT_SCHEMA_VERSION;
  /** Last event hash. Detects tail deletion only until an editor rewrites this too. */
  head: string | null;
  events: AuditEvent[];
}

export interface NewAuditEvent {
  eventId?: string;
  lotId: string;
  eventType: ChainEventType;
  timestamp?: string;
  payload: { [key: string]: JsonValue };
}
