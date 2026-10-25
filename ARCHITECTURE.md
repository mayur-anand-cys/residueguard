# System Architecture

## Overview
ResidueGuard is a client-side heavy React application designed for zero-latency offline-first usage, which is critical for rural agricultural areas with poor internet connectivity.

## Data Flow
1. **Input:** The FPO Manager enters a spray log via the React UI.
2. **Kinetics Engine (`src/lib/kinetics.ts`):** Calculates the Minimum Safe Interval (MSI) using first-order decay math.
3. **Cryptographic Hashing (`src/lib/audit/chain.ts`):** The event is serialized into a JSON payload, combined with the previous event's hash, and hashed using the browser's native Web Crypto API (SHA-256).
4. **Storage (`src/lib/audit/store.ts`):** The resulting block is appended to a LocalStorage array, representing the immutable ledger.

## Component Breakdown
*   **`residue-guard.tsx`:** The main shell handling routing and global state (Role-Based Access Control).
*   **`Dashboard`:** Form for data entry, KPI visualization, and the Explainable AI verdict card.
*   **`BuyerAudit`:** Read-only view for the importer to verify the hash chain and export the PDF certificate.
*   **`PolicySimulator`:** Market-specific regulatory compliance matrix.
*   **`DataMoat`:** Searchable database of verified chemical MRLs and half-lives.

## Why LocalStorage for the MVP?
For the ideathon prototype, LocalStorage simulates a decentralized ledger without the overhead of a backend server. It allows the demo to run flawlessly without an internet connection. In production, this would be replaced by a cloud PostgreSQL database with an append-only audit log, or anchored to a public blockchain (Polygon) for true immutability.
