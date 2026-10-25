# Scientific Assumptions & Limitations

A cryptographic hash proves *tamper-evidence*, not *truth*. ResidueGuard is designed as a decision-support tool, not a laboratory replacement. The following assumptions are made in the MVP:

## 1. Chemical Decay Model
*   The system uses a **first-order exponential decay model** (\(C_t = C_0 e^{-kt}\)).
*   We assume a constant half-life (Foliar DT50). In reality, environmental factors like soil pH and microbial activity also affect degradation. 
*   *Mitigation:* The UI includes an "Environmental Decay Modifier" to manually adjust for heavy rain (wash-off) and UV exposure.

## 2. Data Provenance
*   The MRL (Maximum Residue Limit) values and DT50 half-lives currently in the `DataMoat` are hardcoded based on public CIB&RC, FSSAI, and EFSA guidelines as of October 2026.
*   They are not synced to a live API in this MVP.

## 3. Trust Boundaries (The "Garbage In" Problem)
*   The SHA-256 hash chain prevents middlemen from altering historical spray logs.
*   However, cryptography cannot prevent the initial farmer from lying (e.g., spraying a banned chemical and logging a safe one).
*   *Mitigation:* The FPO Dashboard includes mock Receipt OCR verification and an "Inventory Discrepancy Alert" (comparing bulk FPO procurement data against logged sprays) to detect fraud at the input layer.
