# Contributing to hebrah-examples

Thanks for your interest in improving the Hebrah reference integration demos! This repo ships a set of self-contained Next.js apps that exercise the hebrah control plane (`hebrah-api`) and webhook receiver. Contributions that make demos clearer, more reliable, or more representative of real integration shapes are welcome.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating you agree to its terms.

## Ground rules

- **One demo per concern.** Each `*-demo/` folder is its own self-contained Next.js app with a dedicated port (see the [README](./README.md#demos) for the port table). Don't bundle unrelated surfaces into one demo.
- **Don't bundle private infrastructure.** Demos must run against the public hebrah control plane (`hebrah-api`) and a sandbox connection. Do not commit real credentials, internal VM hostnames, or production URLs.
- **Pin the API surface.** When you bump the demo to use a new hebrah-api endpoint or webhook event, link the relevant docs in the demo's README and mention it in the PR description.
- **Run locally before opening a PR.** The repo root `.gitignore` covers Node/Next artifacts, but each demo ships its own `pnpm install && pnpm dev` workflow. Verify your demo starts and the webhook verification path passes.

## Local setup

You need:

1. Node.js 22+ and pnpm 11+
2. A running hebrah-api control plane (local Docker Compose or hosted `https://api.hebrah.com`)
3. Sandbox credentials from a hebrah onboarding (`hb_test_*` API key, `hbsec_*` webhook secret, `conn-sa-*` connection ID)
4. For `admit-monitor-demo`: a hosted MCP personal access token (`hb_pat_*`) from `hebrah-app → Settings → MCP`

See the umbrella repo's [local development guide](https://github.com/Hebrah-inc/hebrah/blob/main/documentation/local-development.md) for spinning up the platform locally.

For each demo:

```bash
cd <demo-folder>
cp .env.example .env
# Fill in hb_test_*, hbsec_*, HEBRAH_CONNECTION_ID, and any demo-specific vars
pnpm install
pnpm dev
```

Demos listen on the ports documented in the [root README](./README.md#demos).

## Reporting bugs

Open an [issue](https://github.com/Hebrah-inc/hebrah-examples/issues) with:

- The demo name and port
- `pnpm` / Node version
- hebrah-api version or commit (`docker compose ps` or your hosted plan)
- Repro steps and expected vs. actual behavior
- Whether the issue affects sandbox data, webhook delivery, or the demo UI

For security-sensitive issues, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## Proposing a new demo

Open an issue first to discuss scope. We expect new demos to:

1. Cover a clearly distinct integration surface (e.g. credentialing, claim attachment, payer rules)
2. Run on the next free port in the sequence (see [README](./README.md#demos) — currently 3013+)
3. Add a row to the demos table in the root README
4. Add a `README.md` covering prerequisites, env vars, webhook URL, and a smoke-test recipe

If the surface requires new hebrah-api endpoints, please open the issue against [`Hebrah-inc/hebrah-api`](https://github.com/Hebrah-inc/hebrah-api/issues) first so the endpoint ships before the demo lands.

## Pull request workflow

1. Fork the repo and create a branch from `main` (`git checkout -b demo/credentialing-queue`)
2. Make your change. Keep PRs focused — one demo change per PR is preferred
3. Run `pnpm install` and `pnpm dev` in the affected demo folder; smoke-test webhook delivery with the demo's own `Events` (or equivalent) inbox
4. Update the demo's README if you added/changed env vars or page routes
5. Reference any related hebrah-api issue in the PR description (`Refs Hebrah-inc/hebrah-api#123`)
6. Open the PR. A maintainer will review within a few business days
7. After review, squash-merge is the default

## Style

- TypeScript everywhere. Demos already ship `tsconfig.json`; do not opt out of `strict` mode
- Match the existing demo style (server actions for webhook handlers, app router for routes, Tailwind for UI)
- Keep demo UIs minimal and representative of the integration shape — this is reference code, not a product surface
- No telemetry, no analytics, no third-party scripts. Demos run locally

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE). Hebrah, Inc. retains copyright on the original codebase.

## Communication

- **Issues & PRs:** GitHub
- **Security reports:** security@hebrah.com (see [SECURITY.md](./SECURITY.md))
- **Code of Conduct reports:** conduct@hebrah.com
- **Demo access / onboarding / general questions:** [hebrah.com/request-demo](https://hebrah.com/request-demo)