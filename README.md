# ResidueGuard

ResidueGuard is a TanStack Start/React prototype for pre-harvest pesticide-residue workflow calculations, buyer review, and policy simulation.

## Development

```bash
npm install
npm run dev
```

Validation commands:

```bash
npm run typecheck
node --experimental-strip-types --test src/lib/audit/audit.test.ts
npm run build
```

The full repository test command also runs the inherited platform/PWA tests from the uploaded workspace.

## Localization

The interface supports English (`en`), Kannada (`kn`), and Hindi (`hi`). The selector persists the chosen language under `residueguard.lang`, falls back to English for missing messages, updates `document.documentElement.lang`, and does not alter scientific identifiers, stored business data, calculations, timestamps, or hashes.

## Audit integrity model

Buyer Audit uses a typed, browser-local demonstration chain under `residueguard.audit.v1`. Events contain a schema version, event ID, contiguous sequence, lot ID, event type, fixed UTC ISO timestamp, explicit anonymous actor fields, allowlisted payload, previous hash, and event hash. Hashes are computed with Web Crypto `crypto.subtle.digest("SHA-256", ...)` over `rg-audit-canon-1` canonical JSON: object keys are sorted recursively, array order is preserved, UTF-8 is hashed, and `eventHash` is excluded from the hashed content.

Verification recomputes every digest and checks required fields, supported schema, lot scope, genesis, sequence continuity, duplicate IDs/sequences, previous-hash links, and the saved chain head. Viewing and verification do not append events; report export appends a business event and requires the existing chain to verify first. The tamper demonstration verifies an altered copy and never writes the altered record back to storage.

This is a locally verifiable hash chain, not an independently protected production audit system. SHA-256 is a hash function, not encryption; it does not hide records, prove who performed an action, guarantee immutability, prove that residue values are truthful, or detect a wholesale replacement if an attacker can rewrite both the records and local checkpoint. Production-grade integrity would require authenticated server-side appends, transactional sequence/head protection, authorization, durable audit storage, and an externally protected checkpoint or signature service.

The current prototype has no signed-in actor in the Buyer Audit workflow, so events explicitly record `anonymous` / `unauthenticated`. Demonstration events are synthetic and are not laboratory results, government approvals, certifications, or proof of compliance outside the application's existing calculation model.
