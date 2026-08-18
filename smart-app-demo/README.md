# SMART App Demo (Epic patient chart)

Reference **Epic patient-app** integration on port **3005**.

## Features

- MyChart launch (`launch/patient`) and **standalone patient** OAuth (no launch token)
- Full patient chart tabs: Profile, Problems, Meds, Allergies, Vitals, Labs, Visits, Documents, Messages
- Epic category filters (`homemeds`, `vital-signs`, `laboratory`)
- DocumentReference → Binary fetch chain
- Patient-entered vitals via `POST /fhir/R4/Observation`

## Run

```bash
cd hebrah-examples/smart-app-demo
cp .env.example .env.local
pnpm install
pnpm dev
```

On **pnpm 11+**, lifecycle scripts for `sharp` and `unrs-resolver` are allowed via [`pnpm-workspace.yaml`](pnpm-workspace.yaml) (`allowBuilds`). If install fails with `ERR_PNPM_IGNORED_BUILDS`, ensure that file is present and re-run `pnpm install`.

Open http://localhost:3005

## Environment

| Variable | Default |
|----------|---------|
| `NEXT_PUBLIC_HEBRAH_API_BASE_URL` | `http://localhost:8000` |
| `NEXT_PUBLIC_SMART_REDIRECT_URI` | `http://localhost:3005` |
| `NEXT_PUBLIC_SMART_CLIENT_ID` | `sandbox-smart-client` |

Register the SMART client via hebrah-app **Sandbox → SMART launch** or `POST /v1/smart/clients`.

## Epic patient-app checklist

1. Complete SMART OAuth with PKCE
2. Verify `id_token` when `openid` scope requested
3. Pull chart via category-filtered searches
4. Fetch Binary content for documents
5. Submit patient-entered vital (requires `patient/Observation.write`)
6. Compare behavior with [Epic on FHIR](https://fhir.epic.com/Specifications) before App Orchard go-live

## Webhook receiver

`POST /api/webhooks/hebrah` — verifies `X-Hebrah-Signature` with `hbsec_*`.
