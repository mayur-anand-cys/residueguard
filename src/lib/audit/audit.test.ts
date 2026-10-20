import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, CanonicalError } from "./canonical.ts";
import { appendEvent, demonstratePayloadTamper, digestEvent, verifyChain } from "./chain.ts";
import { sha256Hex } from "./hash.ts";
import { GENESIS_HASH, type AuditEvent } from "./types.ts";

async function validChain(): Promise<AuditEvent[]> {
  let events: AuditEvent[] = [];
  events = await appendEvent(events, {
    eventId: "test-1",
    lotId: "RG-TEST-1",
    eventType: "lot_audit_created",
    timestamp: "2026-01-01T00:00:00.000Z",
    payload: { demonstration: true, crop: "Grapes" },
  });
  events = await appendEvent(events, {
    eventId: "test-2",
    lotId: "RG-TEST-1",
    eventType: "residue_result_recorded",
    timestamp: "2026-01-01T00:00:01.000Z",
    payload: { demonstration: true, residueMgKg: 1.25 },
  });
  events = await appendEvent(events, {
    eventId: "test-3",
    lotId: "RG-TEST-1",
    eventType: "compliance_assessment_generated",
    timestamp: "2026-01-01T00:00:02.000Z",
    payload: { demonstration: true, verdict: "SAFE" },
  });
  return events;
}

test("canonicalization sorts keys and rejects unsupported values", () => {
  assert.equal(canonicalize({ b: 2, a: { d: true, c: null } }), '{"a":{"c":null,"d":true},"b":2}');
  assert.throws(() => canonicalize({ bad: undefined }), CanonicalError);
  assert.throws(() => canonicalize({ bad: Number.NaN }), CanonicalError);
});

test("SHA-256 returns the known lowercase digest", async () => {
  assert.equal(
    await sha256Hex("hello"),
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});

test("a valid single-event chain uses the genesis hash", async () => {
  const event = (await validChain()).slice(0, 1);
  const result = await verifyChain(event, { scope: "lot", lotId: "RG-TEST-1", expectedHead: event[0].eventHash });
  assert.equal(result.valid, true);
  assert.equal(event[0].previousHash, GENESIS_HASH);
});

test("a valid multi-event chain passes verification", async () => {
  const events = await validChain();
  const result = await verifyChain(events, { scope: "lot", lotId: "RG-TEST-1", expectedHead: events.at(-1)?.eventHash });
  assert.equal(result.valid, true);
  assert.equal(result.checkedEventCount, 3);
});

test("payload and stored-hash tampering fail verification", async () => {
  const events = await validChain();
  const payloadTamper = await verifyChain(demonstratePayloadTamper(events, 2), { scope: "lot", lotId: "RG-TEST-1", expectedHead: events.at(-1)?.eventHash });
  assert.equal(payloadTamper.valid, false);
  assert.equal(payloadTamper.firstInvalidSequence, 2);
  const hashTamper = events.map((event, index) => index === 1 ? { ...event, eventHash: "f".repeat(64) } : event);
  const hashResult = await verifyChain(hashTamper, { scope: "lot", lotId: "RG-TEST-1", expectedHead: events.at(-1)?.eventHash });
  assert.equal(hashResult.valid, false);
  assert.equal(hashResult.failureCode, "hash-mismatch");
});

test("broken links, removed events, reordering, duplicates, and tail deletion fail", async () => {
  const events = await validChain();
  const brokenLink = events.map((event, index) => index === 1 ? { ...event, previousHash: GENESIS_HASH } : event);
  assert.equal((await verifyChain(brokenLink, { scope: "lot", lotId: "RG-TEST-1", expectedHead: events.at(-1)?.eventHash })).failureCode, "prev-link");
  const removed = [events[0], events[2]];
  assert.equal((await verifyChain(removed, { scope: "lot", lotId: "RG-TEST-1", expectedHead: events.at(-1)?.eventHash })).failureCode, "gap");
  const reordered = [events[1], events[0], events[2]];
  assert.equal((await verifyChain(reordered, { scope: "lot", lotId: "RG-TEST-1", expectedHead: events.at(-1)?.eventHash })).valid, false);
  const duplicateId = [...events, { ...events[2], sequence: 4 }];
  assert.equal((await verifyChain(duplicateId, { scope: "lot", lotId: "RG-TEST-1", expectedHead: events.at(-1)?.eventHash })).failureCode, "duplicate-id");
  const duplicateSequence = events.map((event, index) => index === 2 ? { ...event, sequence: 2 } : event);
  assert.equal((await verifyChain(duplicateSequence, { scope: "lot", lotId: "RG-TEST-1", expectedHead: events.at(-1)?.eventHash })).failureCode, "duplicate-sequence");
  assert.equal((await verifyChain(events.slice(0, 2), { scope: "lot", lotId: "RG-TEST-1", expectedHead: events.at(-1)?.eventHash })).failureCode, "head-mismatch");
});

test("empty chains are unavailable, not verified", async () => {
  const result = await verifyChain([], { scope: "lot", lotId: "RG-TEST-1", expectedHead: null });
  assert.equal(result.valid, false);
  assert.equal(result.failureCode, "empty");
});

test("append rejects extending a broken chain and does not fake a digest", async () => {
  const events = await validChain();
  const broken = events.map((event, index) => index === 0 ? { ...event, payload: { changed: true } } : event);
  await assert.rejects(() => appendEvent(broken, {
    lotId: "RG-TEST-1",
    eventType: "report_exported",
    payload: { demonstration: true },
  }));
  assert.equal((await digestEvent(events[0])).length, 64);
});
