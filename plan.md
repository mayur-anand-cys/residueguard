# ResidueGuard implementation plan

## Findings

- Framework: TanStack Start/Router with React 19 and TypeScript, built with Vite.
- UI: Tailwind CSS v4 utility classes, Lucide icons, Recharts.
- State: React component state for the residue workflow; no application server route currently owns the Buyer Audit record.
- Persistence: the existing audit library is designed for browser `localStorage`; the app has server-only Neon/PGlite helpers, but no audit table or audit route.
- Auth: Better Auth scaffolding is present, but the current workflow does not expose an authenticated actor. Audit records therefore use the explicit anonymous/unauthenticated actor designation.
- Routing: one root route (`/`) with tab navigation inside `ResidueGuard`.

## Implementation

1. Mount the existing `LanguageProvider` at the document shell and use the existing translation dictionary with English fallback and persisted language selection.
2. Localize the header, navigation, dashboard, Buyer Audit, policy simulator, data moat, form validation, and chart labels without changing scientific identifiers or stored values.
3. Wire the existing canonical JSON + Web Crypto SHA-256 audit library into the Buyer Audit page, initializing labelled synthetic demonstration events in localStorage only when empty.
4. Add visible pending, empty, verified, failed, loading, export, copy-hash, and tamper-demonstration states. Verification will recompute hashes, check required fields, ordering, sequence gaps, genesis, previous-hash links, lot scope, and the stored head checkpoint.
5. Keep verification and viewing out of the integrity chain to avoid recursive mutation. Report/export is the only diagnostic action that appends a business event.
6. Add unit tests for canonicalization, real SHA-256, valid chains, tampering, reordering, deletion, broken links, duplicate IDs/sequences, empty chains, and unsupported payload values.
7. Run typecheck, lint, tests, and production build; document any limitations of browser-local persistence.

## Project structure

- `src/components/residue-guard.tsx`: existing tabbed workflow and localized Buyer Audit UI.
- `src/i18n/`: language context, persisted selector, dictionaries, locale-aware display formatting.
- `src/lib/audit/`: typed event schema, canonicalization, Web Crypto digest, chain verification, and local demonstration store.
- `src/lib/kinetics.ts`: existing residue calculations and synthetic reference data, preserved unchanged.
- `src/routes/__root.tsx`: provider mounting and document language.
- `src/lib/audit/audit.test.ts`: focused audit integrity tests.

## Design

Existing ResidueGuard visual language is retained: restrained white cards on a slate canvas, emerald as the trusted action color, rose/amber for failure and delay, compact responsive navigation, and Inter typography. The audit panel adds a calm integrity banner and monospace hash blocks without introducing a new dashboard or changing the established information hierarchy.
