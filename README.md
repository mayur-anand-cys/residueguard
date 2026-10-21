# 🛡️ ResidueGuard
### Pre-Harvest Residue Intelligence & Cryptographic Traceability

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)

> **ResidueGuard** is a B2B Agri-Tech SaaS prototype built for the Krushi & Smart Campus Ideathon 2026. It is a software-only pre-harvest compliance engine that predicts pesticide residue risks and calculates exact Minimum Safe Intervals (MSI) to prevent export rejections for Farmer Producer Organizations (FPOs).

---

## 🚨 The Problem
Indian agriculture loses massive value due to pesticide residue rejections at international ports (EU, US, Japan). The core issue is **information asymmetry**:
* Farmers don't know that a chemical legal in India (e.g., Mancozeb) is banned in the EU.
* Middlemen can easily alter paper spray logs to make unsafe crops look safe, ruining the exporter's reputation.
* A single rejected container costs an FPO **₹10–15 Lakhs**, wiping out a season's profit.

## 💡 The Solution
ResidueGuard shifts agriculture from reactive loss to proactive compliance through three layers:
1. **Predict (FPO Dashboard):** Uses first-order chemical decay kinetics to calculate the exact Minimum Safe Interval (MSI) for harvest.
2. **Simulate (Policy Simulator):** A global market switch that instantly warns farmers if a chemical will be rejected in the EU, US FDA, or Japan *before* they spray.
3. **Verify (Cryptographic Audit):** Generates an immutable **SHA-256 hash chain** of every spray log. Buyers can run a Tamper Test to instantly detect fraud and export a verified PDF certificate.

---

## 🧪 The Science (First-Order Kinetics)
Unlike static statutory labels that ignore actual dosage, ResidueGuard models exponential degradation using Foliar DT50 half-lives. The engine dynamically scales the waiting period based on the farmer's actual dose and the destination market's MRL.

**The Minimum Safe Interval (MSI) Formula:**
* `k = ln(2) / DT50_foliar`
* `Dose Adjustment = ln(Dose_actual / Dose_label) / k`
* `Market Adjustment = max(0, ln(MRL_fssai / MRL_target) / k)`
* `MSI = ceil(PHI_label + Dose Adjustment + Market Adjustment)`

---

## 🚀 Getting Started (Local Setup)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mayur-anand-cys/residueguard.git


---

## 💻 Local Setup & Running the Dashboard

Follow these exact steps to run the ResidueGuard dashboard on your local machine using **VS Code** or **PowerShell**.

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your system.
- A code editor like [VS Code](https://code.visualstudio.com/).

### Step 1: Open the Project
1. Open VS Code.
2. Go to **File > Open Folder...** and select the `residueguard` folder. *(Make sure you open the folder containing `package.json`, not just the Pictures or Downloads folder).*
3. Open the integrated terminal by pressing `` Ctrl + ` `` (Windows) or `` Cmd + ` `` (Mac).

### Step 2: Install Dependencies
Run the following command in the terminal:
```bash
npm install
