# Changelog

All notable changes to the hebrah-examples reference demos are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Demos in this repo do not ship a versioned release train — `main` is the supported branch and demos are pinned by their own dependency manifests. Entries below mark notable demo additions, removals, and breaking changes.

## [Unreleased]

### Added

- **Public release metadata:** `LICENSE` (MIT), `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- Clinical chart demo (`clinical-chart-demo`) — connection-scoped chart reads, parity view vs. sidecar VM FHIR, allergy/clinical scenario picker
- Research Pack Medicare demo (`research-pack-medicare-demo`) — CMS Medicare utilization snapshot vs. sandbox claim KPIs
- SMART on FHIR app demo (`smart-app-demo`) — SMART launch + code exchange + patient read
- Admit monitor demo now wires hebrah hosted MCP for agent-driven event triggering

### Changed

- Demo READMEs now reference public hebrah docs (`https://hebrah.com`, `https://github.com/Hebrah-inc/hebrah`) instead of the internal umbrella `documentation/` folder
- Demo READMEs direct credential acquisition through the public demo request flow rather than internal onboarding

### Fixed

- clinical-chart-demo: prefer host-reachable FHIR for parity on hybrid (Ubuntu/Mac) dev
- clinical-chart-demo: allow `sharp` native builds in pnpm workspace

## [0.1.0] — 2026-05

### Added

- Initial public demos: `patient-demo`, `admit-monitor-demo`, `prior-auth-demo`, `webhook-relay-demo`, `mpi-match-demo`, `credentialing-demo`, `aggregator-demo`
- `athena-model-agent-demo` (bring-your-own-model harness for MCP + integration-agent)
- Root `README.md`, `.gitignore`, per-demo `package.json` and `.env.example`