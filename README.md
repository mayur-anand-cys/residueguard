# 🛡️ ResidueGuard
### Built by Team ResidueGuard | Krushi & Smart Campus Ideathon 2026

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

> **ResidueGuard** is a B2B Agri-Tech SaaS prototype built for the Krushi & Smart Campus Ideathon 2026. It is a software-only pre-harvest compliance engine that predicts pesticide residue risks and calculates exact Minimum Safe Intervals (MSI) to prevent export rejections for Farmer Producer Organizations (FPOs).

---

## 🚨 The Problem
Indian agriculture loses massive value due to pesticide residue rejections at international ports (EU, US, Japan). The core issue is **information asymmetry**:
* Farmers don't know that a chemical legal in India (e.g., Mancozeb) is banned in the EU.
* Middlemen can easily alter paper spray logs to make unsafe crops look safe.
* A single rejected container costs an FPO **₹10–15 Lakhs**, wiping out a season's profit.

## 💡 The Solution
ResidueGuard shifts agriculture from reactive loss to proactive compliance through three layers:
1. **Predict (FPO Dashboard):** Uses first-order chemical decay kinetics to calculate the exact Minimum Safe Interval (MSI) for harvest, factoring in weather conditions and dose variations.
2. **Simulate (Policy Simulator):** A global market switch that instantly warns farmers if a chemical will be rejected in the EU, US FDA, or Japan *before* they spray.
3. **Verify (Buyer Audit):** Generates an immutable **SHA-256 hash chain** of every spray log. Buyers can run a Tamper Test to instantly detect fraud and export a verified PDF certificate.

---

## 🚀 Key Enterprise Features (The "Judge Killers")
This prototype isn't just a UI; it's built with real-world defensive logic:
* **Role-Based Access Control (RBAC):** Toggle between "FPO Manager" and "EU Auditor" in the top right. Auditors are locked out of the data entry dashboard and can only verify the cryptographic chain.
* **Environmental Decay Modifier:** Adjusts the chemical half-life (DT50) based on real-world conditions like "Heavy Rain" (wash-off) or "High UV" (photodegradation).
* **Anti-Fraud Pipeline:** Includes mock Receipt OCR verification, Weather API cross-checks, and an **Inventory Discrepancy Alert** (flagging if an FPO buys 150L of a chemical but only logs 40L).
* **Safety Buffers:** Automatically adds a +2 day safety margin to all MSI calculations to protect exporters from legal liability.
* **Cryptographic Tamper Test:** A live "Run Tamper Test" button that alters a payload to prove the SHA-256 hash chain instantly catches data fraud.

---

## 🧪 The Science (First-Order Kinetics)
Unlike static statutory labels that ignore actual dosage, ResidueGuard models exponential degradation using Foliar DT50 half-lives. The engine dynamically scales the waiting period based on the farmer's actual dose and the destination market's MRL.

**The Minimum Safe Interval (MSI) Formula:**
* `k = ln(2) / DT50_foliar`
* `Dose Adjustment = ln(Dose_actual / Dose_label) / k`
* `Market Adjustment = max(0, ln(MRL_fssai / MRL_target) / k)`
* `MSI = ceil(PHI_label + Dose Adjustment + Market Adjustment + Safety Buffer)`

---

## 💻 Local Setup & Running the Dashboard

Follow these exact steps to run the ResidueGuard dashboard on your local machine. *These instructions are specifically tailored for Windows PowerShell/VS Code users to bypass common Windows execution errors.*

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your system.
- A code editor like [VS Code](https://code.visualstudio.com/).

### Step 1: Open the Project
1. Open VS Code.
2. Go to **File > Open Folder...** and select the `residueguard` folder.
3. Open the integrated terminal by pressing `` Ctrl + ` `` (Windows).

### Step 2: Bypass PowerShell Script Restrictions (Windows Only)
Windows PowerShell blocks scripts by default, which will cause `npm` and `npx` to fail. Run this exact command in your terminal first:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
``` 
### Step 3: Install Dependencies
Run this command to install the necessary packages:

```powershell
npm install
```
### Step 4: Start the Server on Port 8080
To bypass any custom wrapper script errors (like spawn vite ENOENT), use this direct command to launch the Vite server on port 8080:

```powershell
npx vite --host 0.0.0.0 --port 8080
```
### Step 5: Open the Dashboard
Once the terminal displays VITE ready in XXX ms, open your web browser (Chrome, Edge, etc.) and navigate to:

👉 http://localhost:8080

You will be greeted with the FPO Dashboard. From there, explore the Buyer Audit (to test the SHA-256 hash), the Policy Simulator, and the Data Moat!
