# Security Policy

## Reporting a vulnerability

Please report security issues privately to **security@hebrah.com**.

Include:

- A description of the issue and potential impact
- Steps to reproduce
- Affected demo(s) and version(s)
- Whether the report concerns a demo in this repo, the underlying hebrah control plane, or the public Hebrah marketing site

We aim to acknowledge reports within 2 business days. Do not open public GitHub issues for undisclosed vulnerabilities.

## Scope

This repository ships **reference integration demos** — Next.js apps that exercise the hebrah control plane (`hebrah-api`) and verify inbound webhooks. Demos do not store production PHI and run locally against a hebrah sandbox.

| In scope | Out of scope |
|----------|--------------|
| Demo source under `*-demo/` | The hebrah control plane (`Hebrah-inc/hebrah-api`) |
| Demo webhook verification (`X-Hebrah-Signature`) | The hebrah dashboard (`Hebrah-inc/hebrah-app`) |
| Demo `.env.example` placeholders and credential handling | The hosted MCP server (`Hebrah-inc/hebrah-mcp-host`) |
| README instructions and onboarding steps | The marketing site (`https://hebrah.com`) |

Report issues in the hebrah control plane or dashboard directly to **security@hebrah.com** with `[control-plane]` or `[dashboard]` in the subject line.

## Integrator guidance

These demos talk to a real hebrah sandbox. Treat credentials carefully:

- Copy `.env.example` to `.env` and fill in placeholders from your hebrah onboarding step. Never commit `.env`.
- `HEBRAH_API_KEY` (`hb_test_*` / `hb_live_*`), `HEBRAH_WEBHOOK_SECRET` (`hbsec_*`), and MCP personal access tokens (`hb_pat_*`) are bearer credentials. Store them in server-side environment variables or a secrets manager — never in browser bundles, client code, or committed files.
- Sandbox keys (`hb_test_*`) are not PHI-safe. Do not point a demo at real production systems.
- Inbound webhooks carry an `X-Hebrah-Signature` HMAC header. Demos in this repo verify the signature with constant-time compare before processing the body. Do not skip the verification step in your own integrations.
- Synthetic FHIR fixtures are connection-scoped (`pat_{connection_seed}_01`). Different connections see different synthetic patients — there is no cross-tenant data leak in the sandbox.

## Supported versions

This repository publishes demos as a single `main` branch. There is no versioned release train; security fixes land on `main` and demos are pinned by their own dependency manifests.

| Branch | Supported |
|--------|-----------|
| `main` | Yes       |

## Coordinated disclosure

We follow coordinated disclosure. Please give us a reasonable window (typically 90 days, or sooner by mutual agreement) before publishing details publicly so we can ship a fix and notify affected integrators.