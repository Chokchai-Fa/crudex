# Crudex

Crudex is a Thai-language AI assistant for school staff. A teacher can ask Jaew (น้องแจ๋ว) for a fractions worksheet. Jaew delegates to Jum (น้องจ๋ำ), whose tools check the answer key before publication. Other assistants help with teaching media, administrative paperwork and student insights.

## What works today

The passcode-protected agent demo uses synthetic school data. It has five teacher agents, delegated chat with streamed responses, assessment checking, and a Google Forms integration when configured. OpenCode runs on Node 24 in a disposable Vercel Sandbox and calls OpenAI with a server-side key. A replacement sandbox starts a fresh session. [Gateway API and streaming guide](docs/agent-gateway.md)

The gateway also exposes principal chat and morning-brief endpoints. At revision `1724d2b`, the runtime registry is missing the principal agents those endpoints select. The implementation plan starts with a scripted test of this path. [Backend plan](PLAN.md)

The school backend is under development. Its first milestone for teachers is a verified worksheet they can reopen after the sandbox stops. Later workflows use saved assessments for quizzes and gradebooks, and authorized school records for parent reports and principal briefs. [Product specification](docs/PRODUCT.md) · [Screen designs](docs/design/README.md)

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web` | React application served by Cloudflare Workers Static Assets. |
| `apps/api` | Hono application Worker with health and notes routes, Neon repositories, Redis access, a queue consumer and a scheduled handler. School API features belong here. |
| `apps/agent-gateway` | Separate Cloudflare Worker for the agent demo, passcode sessions, sandbox lifecycle, daily quota and morning briefs. |
| `apps/agent-runtime` | OpenCode host, agent definitions, school tools, embedded skills and scripted-model tests. |
| `packages/shared` | Zod contracts shared by application callers and the API. |
| `infra` and `.github/workflows` | Terraform resources, CI and separate application and agent release workflows. |

The [backend architecture](docs/ARCHITECTURE.md) traces an AI request. The [cloud architecture](docs/CLOUD-ARCHITECTURE.md) maps each component to its provider and data store.

## Develop locally

Use Node 22 for the application workspace, pnpm through Corepack, and Docker for local Postgres, Redis and their HTTP proxies. From the repository root, run the following on first setup.

```sh
corepack enable
pnpm install --frozen-lockfile
docker compose up -d --wait
cp -n apps/api/.dev.vars.example apps/api/.dev.vars
DATABASE_URL=postgres://postgres:postgres@localhost:5432/main pnpm --filter api db:migrate
pnpm dev --filter web --filter api
```

Open the [local web app](http://localhost:5173). Vite proxies API requests to the [local API](http://localhost:8787/api/health). For a local AI turn, use Node 24 and follow the runtime guide to bundle and launch the separate agent server. Live model calls require an authorized OpenAI key. The scripted-model suite runs offline. [Agent runtime setup](apps/agent-runtime/README.md)

## Verification and operations

Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` from the repository root. After changing a Drizzle table, generate and review the migration with `pnpm --filter api db:generate`.

Hosted infrastructure must stay within the repo’s no-credit-card constraint. The infrastructure guide covers account setup, credentials, migrations and deployments. [Infrastructure guide](infra/README.md) · [Repository conventions](CLAUDE.md)
