# Security & Threat Model

## Threat Model
The primary threat for export buyers is **Post-Hoc Data Tampering**—a scenario where a middleman alters the paper spray logs after the crop has been harvested to make a non-compliant crop appear safe.

## Cryptographic Guarantees
ResidueGuard uses the browser's native `window.crypto.subtle.digest` API to generate SHA-256 hashes. 
*   **Chain Linking:** Every event hash is computed as `SHA256(previous_hash + JSON.stringify(payload))`.
*   **Tamper Evidence:** If a single byte of the payload is altered, the resulting hash will completely change, breaking the chain for all subsequent events.

## Known Limitations (MVP)
*   **Client-Side Storage:** In this prototype, data is stored in browser LocalStorage. A sophisticated attacker with physical access to the laptop can clear LocalStorage or manipulate the browser's memory during runtime.
*   **No Identity Signatures:** The MVP records the "Actor" as "Anonymous" because there is no authentication layer. It proves the *data* wasn't changed, but not *who* entered it.
*   **Future Roadmap:** To achieve absolute immutability, Version 2.0 will push the head hash of the local chain to a public smart contract (e.g., Polygon) after every 10 events, anchoring the local data to a global decentralized truth.
