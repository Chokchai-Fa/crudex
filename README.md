# Crudex

Crudex is a Thai-language AI assistant for school staff. A teacher can ask Jaew (น้องแจ๋ว) for a fractions worksheet. Jaew delegates to Jum (น้องจ๋ำ), whose tools check the answer key before publication. Other assistants help with teaching media, administrative paperwork and student insights.

## What works today

The passcode-protected agent demo uses synthetic school data. It has five teacher agents, delegated chat with streamed responses, assessment checking, and a Google Forms integration when configured. OpenCode runs on Node 24 in a disposable Vercel Sandbox and calls OpenAI with a server-side key. A replacement sandbox starts a fresh session. [Gateway API and streaming guide](docs/agent-gateway.md)

The school API authenticates teachers, students, guardians and principals. A teacher can start a worksheet run, reconnect to its event stream, and reopen the saved worksheet after the sandbox stops. Students submit quizzes for server-side grading. Teachers can read gradebooks and schedule family report drafts. Principals can review school totals and decide budget claims. Frontend integration and external report delivery are pending.

[API guide](docs/API.md) · [OpenAPI specification](docs/openapi.yaml) · [Database schema](docs/DATABASE.md) · [Backend implementation plan](PLAN.md) · [Screen designs](docs/design/README.md)

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web` | React application served by Cloudflare Workers Static Assets. |
| `apps/api` | Hono application Worker for school identity, agent runs, classroom workflows and approvals, backed by Neon, a queue consumer and scheduled jobs. |
| `apps/agent-gateway` | Cloudflare Worker for trusted school dispatch, the passcode-protected demo, sandbox lifecycle and demo morning briefs. |
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
