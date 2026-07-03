# mpi-match-demo

Minimal MPI merge workflow demo with signed webhook queue.

Port **3006**.

## Setup

1. `cd mpi-match-demo && cp .env.example .env`
2. `pnpm install && pnpm dev`
3. Set webhook URL to `http://localhost:3006/api/webhooks/hebrah`
4. Use the trigger button to run `mpi_merge_workflow` and watch `patient.match.*` / `patient.merge.*` events.
