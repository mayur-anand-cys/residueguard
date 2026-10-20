# ResidueGuard implementation TODO

- [ ] Localize visible shared and Buyer Audit interface text in English, Kannada, and Hindi using stable keys, with persistent selection, English fallback, accessible selector semantics, and document language updates.
- [ ] Preserve scientific identifiers, lot IDs, timestamps, cryptographic hashes, units, calculations, and stored business data when language changes.
- [ ] Wire the typed audit event schema into the existing Buyer Audit workflow using browser-local demonstration persistence, with explicit anonymous actor fields and a clear non-production limitation banner.
- [ ] Compute lowercase SHA-256 digests with Web Crypto from deterministic canonical JSON that excludes `eventHash` and rejects unsupported values.
- [ ] Maintain a sequential chain with genesis and previous-hash links, and verify required fields, ordering, contiguous sequence numbers, duplicate IDs, lot scope, recomputed hashes, and chain head.
- [ ] Provide visible pending, empty, verified, failed, loading, error, export, copy-hash, and non-destructive tamper-demo states.
- [ ] Add and execute focused audit tests covering valid chains, tampered payloads/hashes, broken links, missing/reordered events, duplicate IDs/sequences, empty chains, and hashing failures.
- [ ] Document that browser-local SHA-256 verification is not encryption, proof of identity, a guarantee of immutability, or an independently protected production audit system.
