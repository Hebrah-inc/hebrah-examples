# Research Pack Medicare demo

Port **3012**. Calibrate synthetic FHIR claims against Research Pack 1 (`medicare_utilization_v1`) and a vendored CMS open-data snapshot.

## Prerequisites

1. hebrah-api + hebrah-app running
2. Sandbox `hb_test_*` + `HEBRAH_CONNECTION_ID` from onboarding
3. Optional: hebrah-mcp-host for agent workflows

## Setup

```bash
cd research-pack-medicare-demo
cp .env.example .env   # fill HEBRAH_SANDBOX_API_KEY + HEBRAH_CONNECTION_ID
pnpm install
pnpm dev               # http://localhost:3012
```

## UI

- `/` — setup checklist + use cases
- `/calibration` — apply pack, DRG/share compare table, run `medicare_claim_paid_workflow`

## Agent workflow (MCP)

1. `set_active_connection` → sandbox `conn-sa-*`
2. `list_research_packs` / `get_research_pack`
3. `apply_research_pack` with `pack_id=medicare_utilization_v1`
4. `compare_research_pack` — sandbox vs CMS snapshot
5. `run_sandbox_scenario` with `medicare_claim_paid_workflow`

## Use cases

1. **Analytics agent** — KPI agent grounded in CMS peer DRG mix
2. **Coursework** — fixed seed + fixed open-data snapshot for graded pipelines
3. **Cost-outlier prototype** — watch denial/DRG deltas vs benchmark bands

## Disclaimer

Synthetic sandbox calibration only. Not for clinical decision-making. Benchmarks are trimmed public CMS aggregates (see pack `cms_benchmark.attribution`).
