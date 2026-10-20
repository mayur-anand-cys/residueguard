# 🛡️ ResidueGuard
**Predict Residue. Secure the Harvest.**

ResidueGuard is a B2B Agri-Tech SaaS prototype built for the **Krushi & Smart Campus Ideathon 2026** at Vemana Institute of Technology. It is a software-only pre-harvest compliance engine that predicts pesticide residue risks and calculates exact Minimum Safe Intervals (MSI) to prevent export rejections and retail downgrades for Farmer Producer Organizations (FPOs).

---

## 🚨 The Problem
Indian agriculture loses massive value due to pesticide residue rejections at international ports and organized retail warehouses. The core issue is **information asymmetry**. Maximum Residue Limits (MRLs) and Pre-Harvest Intervals (PHIs) are buried in unreadable regulatory PDFs. Farmers and FPOs have no predictive way to know if a spray schedule will pass compliance until it is too late. 

## 💡 The Solution
ResidueGuard is an automated compliance engine that shifts agriculture from **reactive loss** to **proactive compliance**. 
* **Zero Hardware:** No IoT sensors or expensive drones required.
* **Zero Behavior Change:** FPO field officers input a 30-second spray log.
* **Predictive Output:** Calculates the exact wait time before harvest and generates a traceable QR code for buyers.

---

## 🧪 The Science (First-Order Kinetics)
Unlike static statutory labels that ignore actual dosage, ResidueGuard models exponential degradation using Foliar DT50 half-lives. The engine dynamically scales the waiting period based on the farmer's actual dose and the destination market's MRL.

The Minimum Safe Interval (MSI) Formula:

```text
k = ln(2) / DT50_foliar
Dose Adjustment = ln(Dose_actual / Dose_label) / k
Market Adjustment = max(0, ln(MRL_fssai / MRL_target) / k)

MSI = ceil(PHI_label + Dose Adjustment + Market Adjustment)
```
