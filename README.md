# crudex

A full-stack TypeScript monorepo that runs **entirely on free-tier cloud services that need no
credit card**: one Cloudflare Worker serving a React SPA and a Hono API, Neon Postgres, Upstash
Redis and Cloudflare Queues, all provisioned by Terraform and deployed by GitHub Actions.

| Part | What's in it |
|------|--------------|
| `apps/web` | Vite + React 19, TanStack Router + Query, Tailwind v4 + shadcn/ui, light/dark theme |
| `apps/api` | Hono on Workers, layered routes → services → repositories, Drizzle + Neon HTTP, Upstash REST, a Queues consumer, Vitest in the Workers runtime |
| `packages/shared` | zod schemas = the API contract, used by both apps |
| `infra/` | Terraform modules for Neon, Upstash and the queue; state in HCP Terraform (free) |
| `.github/` | `ci` (lint/typecheck/test/build + plan comment), `deploy`, weekly `drift` check, manual `destroy` |
| `skills/` | Agent skills (one folder; `.claude/skills` and `.agents/skills` symlink to it): `design-system` (UI rules + UX checklist), `manage-secrets` and `infra` |

The one example feature, **notes**, goes through every layer. Copy its shape for your own
features, then delete it. `CLAUDE.md` has the architecture rules.

## Start a new project

1. Create a repo from this template (GitHub → **Use this template**) and clone it.
2. Rename the placeholders and commit:
   ```bash
   scripts/init-template.sh my-app my-workers-subdomain my-hcp-org
   git diff && git commit -am "chore: initialise from crudex"
   ```
3. Do the one-time account setup in **`infra/README.md` §1** (Cloudflare, HCP Terraform, Neon,
   Upstash), put your Neon org ID in `infra/envs/prod/terraform.tfvars`, then set the GitHub
   secrets with `scripts/verify-credentials.py` and `scripts/setup-github-secrets.sh`.
4. Push to `main`. `deploy.yml` creates the infrastructure, runs migrations and deploys to
   `https://app.<crudex>.workers.dev`.

## Develop locally

Needs Node 22 (`.nvmrc`), pnpm (`corepack enable`) and Docker.

```bash
pnpm install
docker compose up -d                                  # Postgres + Redis with Neon/Upstash-style proxies
cp apps/api/.dev.vars.example apps/api/.dev.vars
DATABASE_URL=postgres://postgres:postgres@localhost:5432/main pnpm --filter api db:migrate
pnpm dev                                              # http://localhost:5173 (API proxied to :8787)
```

`pnpm build | lint | typecheck | test` run across all packages. After changing a Drizzle table,
run `pnpm --filter api db:generate` and commit the new migration.

## Tear down

Actions → **Terraform destroy** → Run workflow. With the defaults it only plans. To actually
destroy, tick **apply** and type the project name in **confirm**. The database is kept unless
**include_database** is ticked.
