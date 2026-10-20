import { appendEvent } from "./chain";
import { AUDIT_SCHEMA_VERSION, type AuditEvent, type AuditStoreData } from "./types";

export const AUDIT_STORAGE_KEY = "residueguard.audit.v1";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class AuditStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditStoreError";
  }
}

export function emptyStore(): AuditStoreData {
  return { schemaVersion: AUDIT_SCHEMA_VERSION, head: null, events: [] };
}

export function readStore(kv: KeyValueStore): AuditStoreData {
  const raw = kv.getItem(AUDIT_STORAGE_KEY);
  if (raw === null || raw === "") return emptyStore();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AuditStoreError("Stored audit records could not be read.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new AuditStoreError("Stored audit records could not be read.");
  }
  const record = parsed as Partial<AuditStoreData>;
  if (record.schemaVersion !== AUDIT_SCHEMA_VERSION) {
    throw new AuditStoreError("Unsupported audit store version. Records were left unchanged.");
  }
  if (!Array.isArray(record.events) || (record.head !== null && typeof record.head !== "string")) {
    throw new AuditStoreError("Stored audit records could not be read.");
  }
  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    head: record.head ?? null,
    events: record.events as AuditEvent[],
  };
}

export function writeStore(kv: KeyValueStore, data: AuditStoreData): void {
  const head = data.events.length === 0 ? null : data.events[data.events.length - 1].eventHash;
  const next: AuditStoreData = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    head,
    events: data.events,
  };
  kv.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next));
}

/**
 * Demonstration events for the fixed buyer-audit lot.
 * Timestamps and ids are fixed so the hashes describe this synthetic record,
 * not a laboratory certificate. Labelled `demonstration: true`.
 */
export async function buildDemonstrationChain(lotId: string): Promise<AuditEvent[]> {
  const shared = { demonstration: true as const, synthetic: true as const };
  let events: AuditEvent[] = [];
  events = await appendEvent(events, {
    eventId: "demo-rg-gra-azox-10-001",
    lotId,
    eventType: "lot_audit_created",
    timestamp: "2026-03-01T06:00:00.000Z",
    payload: {
      ...shared,
      fpo: "Kolar Horticulture FPO",
      crop: "Grapes",
      note: "Synthetic demonstration record, not a laboratory result.",
    },
  });
  events = await appendEvent(events, {
    eventId: "demo-rg-gra-azox-10-002",
    lotId,
    eventType: "residue_result_recorded",
    timestamp: "2026-03-01T06:00:01.000Z",
    payload: {
      ...shared,
      chemical: "Azoxystrobin",
      doseApplied: 1.5,
      labelDose: 1,
      unit: "mg/kg",
      day21ResidueMgKg: 1.979,
      euMrlMgKg: 2,
    },
  });
  events = await appendEvent(events, {
    eventId: "demo-rg-gra-azox-10-003",
    lotId,
    eventType: "compliance_assessment_generated",
    timestamp: "2026-03-01T06:00:02.000Z",
    payload: {
      ...shared,
      verdict: "SAFE",
      msiDays: 21,
      market: "EU",
      daysToHarvest: 21,
    },
  });
  return events;
}

export async function ensureDemonstrationChain(kv: KeyValueStore, lotId: string): Promise<AuditStoreData> {
  const current = readStore(kv);
  if (current.events.length > 0) return current;
  const events = await buildDemonstrationChain(lotId);
  const next: AuditStoreData = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    head: events[events.length - 1]?.eventHash ?? null,
    events,
  };
  writeStore(kv, next);
  return readStore(kv);
}

export function browserStore(): KeyValueStore {
  if (typeof localStorage === "undefined") {
    throw new AuditStoreError("This browser cannot store a local audit chain.");
  }
  return localStorage;
}

export interface AuditExport {
  kind: "residueguard-local-audit-export";
  limitation: string;
  lotId: string;
  exportedAt: string;
  head: string | null;
  events: AuditEvent[];
}

export function buildExport(data: AuditStoreData, lotId: string, exportedAt: string): AuditExport {
  return {
    kind: "residueguard-local-audit-export",
    limitation:
      "Local demonstration chain stored in the browser. SHA-256 links these records. It is not encryption, not proof of identity, and not an external trusted anchor.",
    lotId,
    exportedAt,
    head: data.head,
    events: data.events,
  };
}
