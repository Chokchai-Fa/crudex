# AGENTS.md — crudex

Guide for coding agents (Codex, Claude Code, Cursor…) working in this repo. **`CLAUDE.md` is the
full architecture reference — read it before changing anything**; this file is the short version.

## What this is
A full-stack TypeScript monorepo that runs entirely on free-tier cloud services with **no credit
card**: one Cloudflare Worker serves a React SPA and a Hono API, backed by Neon Postgres, Upstash
Redis and Cloudflare Queues (plus a Workers KV namespace and a Vercel project). Everything is
declared in Terraform under `infra/` and deployed by GitHub Actions. It was created from
`app-template`; the one example feature, **notes**, goes through every layer — copy its shape,
then delete it.

The `agent-design` harness uses a separate `crudex-agent` Worker. OpenCode runs on Node 24 in
a Vercel Hobby Sandbox, with the Worker handling authentication, quota and SSE proxying.

## Layout
```
apps/web        Vite + React 19, TanStack Router + Query, Tailwind v4 + shadcn/ui
apps/api        Hono on Workers: routes → services → repositories, Drizzle + Neon HTTP, Upstash REST, Queues consumer
apps/agent-runtime  Node 24 + OpenCode in Vercel Sandbox
apps/agent-gateway  crudex-agent Worker + sandbox lifecycle Durable Object
packages/shared zod schemas = the API contract, used by both apps
infra/          Terraform (Neon, Upstash, Queue, KV, Vercel project); state in HCP Terraform
.github/        ci, deploy, drift (weekly), destroy (manual)
scripts/        init-template.sh, verify-credentials.py, setup-github-secrets.sh
skills/         dev skills, the single source; .claude/skills and .agents/skills are symlinks to it
```

## Commands
```bash
pnpm install
docker compose up -d                       # local Postgres + Redis (Neon/Upstash-style proxies)
pnpm dev                                   # http://localhost:5173, API proxied to :8787
pnpm build | lint | typecheck | test       # across all packages
pnpm --filter api db:generate              # after changing a Drizzle table; commit the migration
```
Node 22 (`.nvmrc`), pnpm via `corepack enable`. Run lint, typecheck and test before finishing.

## Skills — load the matching one before you start
Skills live in `skills/<name>/SKILL.md`. Claude Code reads them via `.claude/skills` and Codex via `.agents/skills`, both symlinks to `skills/`: edit only `skills/`.

| Skill | Use when touching |
|-------|-------------------|
| `infra` | `infra/**`, `apps/api/wrangler.toml`, `.github/workflows/**`, any cloud resource or binding |
| `manage-secrets` | adding, removing or rotating any secret or env var |
| `design-system` | `apps/web/**` UI: components, theming, UX checklist |

## Hard rules
- **No credit card, ever.** Don't add a service, plan or resource that needs one or leaves the
  free tier. If a feature seems to need it, stop and ask.
- **Layering:** routes → services → repositories. Routes parse/validate with the shared zod
  schemas and call services; only repositories touch the DB. Keep the API contract in
  `packages/shared`.
- **Workers constraints:** 10 ms CPU per request on the free plan — no heavy parsing or
  rendering in the Worker; after-response work goes to the Queue. No Node-only APIs.
- **Infra is code:** create cloud resources in Terraform, not dashboards, unless the provider
  has no Terraform support (document that step in `infra/README.md`).
- **Terraform:** `plan`, `fmt` and `validate` only. **Never `apply`, `destroy`, `wrangler
  delete` or deploy** unless the user explicitly asks; changes ship via PR → merge → `deploy.yml`.
- **Secrets:** never commit real values (`.secrets.env`, `.envrc`, `.dev.vars` are gitignored)
  and never echo them. One source of truth per value — follow `manage-secrets`.
- **Migrations** run before the new code ships, so they must be backward-compatible
  (expand first, contract in a later deploy).
- Keep `CLAUDE.md`, `infra/README.md` and this file true in the same change as the code.
