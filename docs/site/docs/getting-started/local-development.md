---
sidebar_label: Local development
description: Start the application and database, then verify a school workflow using synthetic records.
---

# Run Crudex locally

Use Node 22 for the application workspace, pnpm through Corepack, and Docker for local Postgres, Redis and their HTTP proxies. From the repository root, run the following on first setup.

```sh
corepack enable
pnpm install --frozen-lockfile
docker compose up -d --wait
cp -n apps/api/.dev.vars.example apps/api/.dev.vars
DATABASE_URL=postgres://postgres:postgres@localhost:5432/main pnpm --filter api db:migrate
pnpm dev --filter web --filter api
```

Open the [local web app](http://localhost:5173). Vite proxies API requests to the [local API](http://localhost:8787/api/health). For a local AI turn, use Node 24 and follow the runtime guide to bundle and launch the separate agent server. Live model calls require an authorized OpenAI key. The scripted-model suite runs offline. [Agent runtime setup](https://github.com/Chokchai-Fa/crudex/blob/main/apps/agent-runtime/README.md)

## Verify a school workflow

Start the local data services, apply the migrations, and run the identity and approval checks against a disposable database. For the worksheet-to-report flow the test fixture acts as the agent gateway and calls the same authenticated tool callbacks as a live sandbox. It exercises the school HTTP API and Postgres without a paid model call. See the self-contained checks in [identity](https://github.com/Chokchai-Fa/crudex/blob/main/apps/api/scripts/check-school-identity.mjs), [approvals](https://github.com/Chokchai-Fa/crudex/blob/main/apps/api/scripts/check-school-approvals.mjs) and [school workflow](https://github.com/Chokchai-Fa/crudex/blob/main/apps/api/scripts/check-school-workflow.mjs).

To run all three checks from the repository root, start the Compose database and proxies, copy the local Worker settings and apply the migrations above. Build the static assets once, then start both local Workers in one Wrangler process.

```sh
pnpm --filter web build
pnpm --filter api exec wrangler dev --local --config wrangler.toml \
  --config scripts/fixtures/dispatch.wrangler.jsonc --port 8790 --test-scheduled
```

In another shell, run the checks against the disposable Compose database.

```sh
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/main
node apps/api/scripts/check-school-identity.mjs http://127.0.0.1:8790/api/
node apps/api/scripts/check-school-approvals.mjs http://127.0.0.1:8790/api/
node apps/api/scripts/check-school-workflow.mjs http://127.0.0.1:8790
```
