# Geriatric Prescribing Cascade & Negative Control Evaluation Harness Demo

Interactive customer evaluation demo powered by **Hebrah Isolated Health Environments** (`https://api.hebrah.com`).

## What This Demo Shows

1. **18-Month Longitudinal Medication Histories (`MedicationRequest.authoredOn`):**
   - Seniors aged **65–92** with **5+ active medications**, chronic kidney disease (`N18.30`–`N18.6`), heart failure (`I50.*`), cognitive impairment / dementia (`G31.84`, `F03.90`, `G30.91`), diabetes (`E11.22`), dialysis (`Z99.2`), falls (`Z91.81`, `R29.6`), and frailty (`R54`).
2. **Refills Distinguishable from Initiations + Unlinked Pharmacy Renewal Traps:**
   - Standard chronic refills chain back via `priorPrescription.reference`.
   - **Unlinked Pharmacy Renewals (`unlinked_renewal=True`):** Simulates a 14-month chronic drug whose latest pharmacy renewal omits `priorPrescription`, proving longitudinal RxNorm reconciliation recovers the true earliest initiation date.
3. **Sarcopenic Cystatin C vs. Creatinine Renal Discordance (`LOINC`):**
   - Serial lab draws for Serum Creatinine (`2160-0`), CKD-EPI 2021 eGFR (`98979-8`), Serum Albumin (`1751-7`), Serum Cystatin C (`3368-8`), and Cystatin-C derived eGFR (`50210-4`), highlighting frail older adults whose creatinine eGFR appears normal (`>= 60`) while Cystatin-C eGFR reveals true Stage 3b/4 CKD (`30–42`).
4. **Point-of-Prescribing HL7 CDS Hooks 2.0 (`order-sign`) & 1:1 Negative Controls:**
   - Evaluates `status: "draft"` orders at $T_0$ across **5 positive prescribing cascades** and **5 matched negative controls** (`100%` sensitivity & specificity).
5. **High-Volume Evaluation Harness Scale:**
   - Admit batches of `20`, `50`, `100`, or `250`+ distinct patients per click (up to `500` per API call).

## Quick Start

```bash
cd hebrah-examples/prescribing-cascade-demo
node server.mjs
```

Then open **http://127.0.0.1:3016** in your browser.
