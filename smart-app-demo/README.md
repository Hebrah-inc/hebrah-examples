# smart-app-demo

Minimal SMART app reference flow for hebrah sandbox.

Port **3005**.

## Setup

1. `cd smart-app-demo && cp .env.example .env`
2. Ensure `SMART_CLIENT_ID` is registered in hebrah (`POST /v1/smart/clients`)
3. `pnpm install && pnpm dev`
4. Open `http://localhost:3005`
5. Paste `iss` + `launch` from dashboard launch link (or use defaults), start auth, exchange code, then fetch Patient.

## What it demonstrates

- SMART authorize URL generation with PKCE (`/oauth/authorize`)
- Authorization code exchange (`/oauth/token`)
- SMART-protected FHIR read (`GET /fhir/R4/Patient/{id}`)
