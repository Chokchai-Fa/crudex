# Infrastructure setup & plan

Everything needed to stand up the app's infrastructure from zero: the **manual one-time steps**
(accounts, tokens, settings that no Terraform provider can do), what **Terraform** creates, what
**wrangler** deploys, and the **first-deploy order**. All services are free tier with **no
credit card**.

> Never paste tokens or secrets into chat, issues, commits, or this file. They go only into
> GitHub secrets, your local `.envrc` (gitignored), or a password manager.

---

## 0. Overview — who creates what

| Thing | Created by | Why not Terraform |
|-------|-----------|-------------------|
| GitHub repo + Actions secrets | **Manual** (once) | Possible via the `github` provider, but it'd need a GitHub token to bootstrap — not worth it |
| Cloudflare account, `workers.dev` subdomain, API token | **Manual** (once) | Account-level bootstrap |
| HCP Terraform org + workspace | **Manual** (once) | It stores Terraform's own state — chicken-and-egg |
| Neon account + API key | **Manual** (once) | Bootstrap credential |
| Upstash account + API key | **Manual** (once) | Bootstrap credential |
| Neon project / database / role | **Terraform** | |
| Upstash Redis database | **Terraform** | |
| Cloudflare Queue `crudex-jobs` | **Terraform** | |
| Vercel account / Hobby team + token | **Manual** (once) | Bootstrap credential; the provider can't create teams |
| Vercel project `crudex` (owns sandboxes + snapshots) | **Terraform** | |
| Vercel Sandboxes, snapshot | `@vercel/sandbox` at run time / `sandbox-image` scripts | Short-lived; snapshot is built by a script (`sandbox-snapshot` skill) |
| Worker `app` (API + static assets + queue consumer) | **wrangler** in CI | Code deploys; Terraform would fight wrangler over the script |
| Worker secrets | **wrangler** in CI (`secrets:` from Terraform outputs + GitHub secrets) | |
| DB schema | **drizzle-kit** migrations in CI | |

```
Manual (once) ──► GitHub secrets ──► CI: terraform apply ──► Neon, Upstash, Queue
                                          │ outputs (HCP state)
                                          ▼
                                     CI: build web + api → migrate → wrangler deploy (+ secrets)
                                          ▼
                         https://app.<your-subdomain>.workers.dev  (SPA + /api)
```

---

## 1. Manual one-time setup

Do these in order — later steps need values from earlier ones. Tick them off as you go.
Record non-secret values (account IDs, subdomain, org name) in the table in §1.9.

### 1.1 Local tools
- [ ] Node.js **22** (pinned in `.nvmrc`; wrangler 4 requires ≥ 22) — e.g. `nvm install 22`
- [ ] pnpm: `corepack enable` (version pinned in root `package.json` `packageManager`)
- [ ] Terraform **1.16.x** (same as CI — e.g. `brew install hashicorp/tap/terraform` or tfenv)
- [ ] Docker (for the local database/cache in §5)
- [ ] Optional: `direnv` (loads `.envrc` automatically), GitHub CLI `gh`
- wrangler is a dev dependency of `apps/api` — run it via `pnpm --filter api exec wrangler …`

### 1.2 GitHub repository
- [ ] Create the repo (private or public) and push this code to `main`.
- [ ] Settings → Branches → protect `main`: require PRs and the `CI` checks to pass.
- [ ] Note: **public** repos get unlimited Actions minutes and can use Environments with
      required reviewers; **private** repos get 2,000 min/month and no reviewer gates on Free.

### 1.3 Cloudflare (Workers, Static Assets, Queues)
- [ ] Sign up at dash.cloudflare.com (free plan, no card).
- [ ] **Account ID** (32 hex chars): Workers & Pages → Overview → right sidebar → **copy
      button**, don't retype it. → GitHub secret `CLOUDFLARE_ACCOUNT_ID`. A one-character typo
      makes every call fail with "Authentication error" / "Invalid account identifier", which
      looks like a token problem — `scripts/verify-credentials.py` detects it.
- [ ] **workers.dev subdomain**: Workers & Pages → Overview → set your subdomain once. The app
      will live at `https://app.<your-subdomain>.workers.dev` — put it in `wrangler.toml`
      `APP_URL` (`scripts/init-template.sh` does this).
- [ ] **API token** — either kind works: *Manage Account → Account API Tokens* (account-owned,
      recommended) or *My Profile → API Tokens* (user-owned). Create Token → *Custom token*:
      - Account → **Workers Scripts: Edit** (Worker, assets, Durable Objects, secrets)
      - Account → **Queues: Edit**
      - Account → **Workers KV Storage: Edit** (Terraform creates the `<app>-previews` namespace)
      - Account → **Account Settings: Read** (wrangler needs it to resolve the account)
      - Account Resources: *Include → your account only*
      - TTL: optional; set a reminder to rotate.
      → GitHub secret `CLOUDFLARE_API_TOKEN`. Grant only these four — not "all permissions".
      Editing a token's permissions later keeps its value; rolling it creates a new value.

### 1.4 HCP Terraform (remote state)
- [ ] Sign up at app.terraform.io (Free tier).
- [ ] Create an **organization** (e.g. `your-name-projects`). Put the name in
      `infra/envs/prod/versions.tf` → `cloud { organization = "…" }`.
- [ ] Create a **workspace** → *CLI-driven workflow*. Its name must equal `workspaces.name` in
      `versions.tf` (here: `crudex`, in organization `samongnoi`).
- [ ] Workspace → Settings → General → **Execution mode: Local**. (Terraform runs in GitHub
      Actions / your machine; HCP only stores, locks, and versions state.)
- [ ] Create a **user** token: avatar → Account settings → Tokens → Create an API token (or an
      *owners* **team** token). → GitHub secret `TF_API_TOKEN`.
      ⚠️ **Not an organization token** (Organization settings → API tokens): it shows up as user
      `api-org-…` and HCP won't let it lock or write state, so `plan` fails with
      "Error acquiring the state lock: resource not found".
- [ ] Locally: `terraform login` (stores a token in `~/.terraform.d/credentials.tfrc.json`).

### 1.5 Neon (Postgres) and Upstash (Redis)
- [ ] **Neon**: sign up at neon.tech (free, no card). Sign-up forces you to create a first
      project — accept any name, then **delete it** (project → Settings → Delete) once you have
      the key; Terraform creates the real one. API key: Organization settings → API keys →
      create → GitHub secret `NEON_API_KEY`.
- [ ] Copy your **Neon organization ID** (`org-…`, Organization settings; not secret) into
      `neon_org_id` in `infra/envs/prod/terraform.tfvars` — API-created projects need it.
- [ ] **Upstash**: sign up at upstash.com (free, no card). Account → Management API → create
      API key. → GitHub secrets `UPSTASH_EMAIL` (your login email) and `UPSTASH_API_KEY`.
      **Don't create a database by hand** — Terraform does.
- [ ] Choose **one region close to your users** for both (e.g. Neon `aws-ap-southeast-1` +
      Upstash `ap-southeast-1` for Southeast Asia). Set it in `infra/envs/prod/terraform.tfvars`
      (non-secret, committed). The Worker runs everywhere, so DB/Redis region drives latency.

### 1.6 Add-ons (only when a feature needs them)

- **Sign in with Google** (Better Auth): Google Cloud project (no billing) → Google Auth Platform →
  Web client with origins `https://app.<your-subdomain>.workers.dev` + `http://localhost:5173` and
  redirect URIs `…/api/auth/callback/google` → GitHub secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

Add any of these with the `manage-secrets` skill (it lists every file to touch).

### 1.7 Vercel (Sandbox)
- [ ] Sign up at vercel.com on the **Hobby** plan (free, no card; non-commercial use only).
      Your Hobby team is created at sign-up — name it as you like (slugs are global, so
      `crudex` may be taken; it doesn't matter). **Don't create the project by hand** —
      Terraform creates project `crudex`.
- [ ] Team Settings → General → copy the **Team ID** (`team_…`, not secret) into
      `vercel_team_id` in `infra/envs/prod/terraform.tfvars`.
- [ ] Account Settings → Tokens → create a token **scoped to that team** (set an expiry you
      will remember to rotate) → GitHub secret `VERCEL_TOKEN`. Locally put it in `.envrc` as
      `VERCEL_API_TOKEN` (Terraform provider) and `VERCEL_TOKEN` (sandbox scripts).

### 1.8 GitHub Actions secrets — final checklist

**Verify first** — before setting secrets, run the read-only checker against your values. It
prints only statuses and non-secret names (never values) and explains each failure:

```bash
scripts/verify-credentials.py                 # reads .secrets.env (gitignored)
```

Set them with the script (hidden prompts → `gh secret set` via stdin; nothing is written to
disk or shell history):

```bash
scripts/setup-github-secrets.sh --repo <owner>/<repo>          # prompts for each value
scripts/setup-github-secrets.sh --repo <owner>/<repo> --check  # ✓/✗ per secret
```
Or fill a gitignored `.secrets.env` (`NAME=value` lines; `chmod 600`) and run with
`--from-file .secrets.env` — verify it with `scripts/verify-credentials.py` first. Delete the
file afterwards, or keep it for local Terraform runs. Manual alternative: Settings → Secrets and variables → Actions →
*Repository secrets*:

| Secret | From | Used by |
|--------|------|---------|
| `TF_API_TOKEN` | §1.4 | all Terraform jobs + `terraform-outputs` action |
| `CLOUDFLARE_API_TOKEN` | §1.3 | Terraform (queue) + wrangler deploy |
| `CLOUDFLARE_ACCOUNT_ID` | §1.3 | Terraform + wrangler deploy |
| `NEON_API_KEY` | §1.5 | Terraform |
| `UPSTASH_EMAIL` | §1.5 | Terraform |
| `UPSTASH_API_KEY` | §1.5 | Terraform |
| `VERCEL_TOKEN` | §1.7 | Terraform (as `VERCEL_API_TOKEN`) + the Worker (`lib/sandbox/vercel.ts`) |

Generated secrets (`DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are
**not** GitHub secrets — they come from Terraform outputs. Add-ons (§1.6) add their
secrets here.

### 1.9 Non-secret values to record (commit these where noted)

| Value | Example | Goes into |
|-------|---------|-----------|
| Cloudflare workers.dev subdomain | `alice` | `apps/api/wrangler.toml` `APP_URL` |
| App URL | `https://app.<your-subdomain>.workers.dev` (Worker `app` on your subdomain) | `wrangler.toml` `APP_URL` |
| HCP organization | `samongnoi` | `infra/envs/prod/versions.tf` |
| HCP workspace | `crudex` | `infra/envs/prod/versions.tf` |
| Vercel team id | `team_…` | `infra/envs/prod/terraform.tfvars` `vercel_team_id` |
| Region (Neon / Upstash) | `aws-ap-southeast-1` / `ap-southeast-1` | `infra/envs/prod/terraform.tfvars` |

---

## 2. Terraform layout (what we'll write)

```
infra/
├── README.md                    # this file
├── modules/
│   ├── neon_db/                 # neon_project (+ default branch/db/role) → connection string
│   ├── upstash_redis/           # upstash_redis_database → REST URL + token
│   ├── queue/                   # cloudflare_queue "crudex-jobs"
│   └── vercel_project/          # vercel_project "crudex" (sandboxes + snapshots live under it)
└── envs/
    └── prod/
        ├── versions.tf          # terraform ~> 1.16.0, cloud {} block, pinned required_providers
        ├── providers.tf         # cloudflare, neon (kislerdm/neon), upstash
        ├── variables.tf         # cloudflare_account_id, regions, names
        ├── terraform.tfvars     # non-secret values only (committed)
        ├── main.tf              # wires the three modules
        ├── outputs.tf           # names map 1:1 to Worker env vars (see below)
        └── .terraform.lock.hcl  # committed — pins provider checksums
```

Providers (versions pinned in `versions.tf`):
`cloudflare/cloudflare`, `kislerdm/neon` (community), `upstash/upstash`, `vercel/vercel`.
Credentials come only from environment variables (`CLOUDFLARE_API_TOKEN`, `NEON_API_KEY`,
`UPSTASH_EMAIL`, `UPSTASH_API_KEY`, `VERCEL_API_TOKEN`) — never from `.tf` files or `.tfvars`.

### Resources

| Module | Resource | Key settings (free tier) |
|--------|----------|--------------------------|
| `neon_db` | Neon project | region from tfvars, Postgres 17, default branch `main`, DB `app`, role `app`; history retention at the free minimum; autosuspend default (scale to zero) |
| `upstash_redis` | Redis database | name `crudex-cache`, region from tfvars, free plan, TLS on, eviction on (cache) |
| `queue` | Cloudflare Queue | name `crudex-jobs` (must equal `wrangler.toml` producer/consumer `queue`) |
| `vercel_project` | Vercel project | name `crudex`, Hobby team from tfvars, no git link, nothing deployed |

### Outputs → Worker env vars

The `terraform-outputs` CI action exports each output as `UPPER_CASE` (`database_url` →
`DATABASE_URL`) and masks sensitive ones. **Keep these names exactly**:

| Output | Sensitive | Becomes |
|--------|:---------:|---------|
| `database_url` | ✅ | `DATABASE_URL` (Neon connection string, `sslmode=require`) |
| `upstash_redis_rest_url` | ❌ | `UPSTASH_REDIS_REST_URL` |
| `upstash_redis_rest_token` | ✅ | `UPSTASH_REDIS_REST_TOKEN` |
| `queue_name` | ❌ | `QUEUE_NAME` (informational) |
| `vercel_project_id` | ❌ | `VERCEL_PROJECT_ID` (Worker secret, used by `lib/sandbox/vercel.ts`) |
| `vercel_team_id` | ❌ | `VERCEL_TEAM_ID` (same) |

Adding/removing one later → follow the `manage-secrets` skill.

### Not in Terraform (by design)
- The Worker, its static assets and the queue **consumer** → `apps/api/wrangler.toml` +
  `wrangler deploy` (add-ons: Durable Objects and the Workers AI `[ai]` binding live there too).
- HCP workspace, GitHub secrets, add-on keys → manual (§1).

---

## 3. First deploy (bootstrap order)

1. Finish **all of §1**.
2. Scaffold code (phase 1): `infra/envs/prod/*`, `apps/api` with `/api/health`, `apps/web`.
3. Locally, check Terraform before anything is created:
   ```bash
   cd infra/envs/prod
   export CLOUDFLARE_API_TOKEN=… NEON_API_KEY=… UPSTASH_EMAIL=… UPSTASH_API_KEY=…   # or direnv
   export TF_VAR_cloudflare_account_id=…
   terraform init && terraform validate && terraform plan
   ```
4. Open a PR → `ci.yml` posts the plan → review → **merge**.
5. `deploy.yml` runs: `infra` applies (creates Neon, Upstash, Queue) → `app` builds
   web + api, runs migrations, uploads Worker secrets, deploys the Worker.
   - The **first** `wrangler deploy` also attaches the queue consumer.
6. Verify:
   - [ ] `https://app.<your-subdomain>.workers.dev/api/health` → `200`
   - [ ] the SPA loads at `/`, and a deep link like `/threads/x` loads the SPA (not a 404)
   - [ ] Cloudflare dashboard → Worker → Settings → Variables shows the secrets (values hidden)
   - [ ] Neon console shows the project and the migrated tables
7. Done — from now on every change goes PR → merge → automatic deploy.

---

## Troubleshooting (seen in practice)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Every Cloudflare call: "Authentication error"; account endpoint: "Invalid account identifier" | Typo in `CLOUDFLARE_ACCOUNT_ID` | Copy it with the copy button; `verify-credentials.py` names the right one |
| `/user/tokens/verify` says "Invalid API Token" but the token is new | Account-owned token — verify via `/accounts/{id}/tokens/verify` instead | Nothing; the token is fine (the verifier handles both kinds) |
| `terraform plan`: "Error acquiring the state lock: resource not found" | `TF_API_TOKEN` is an HCP **organization** token | Use a user or owners-team token (§1.4) |
| `terraform init`: workspace not found | `workspaces.name` in `versions.tf` ≠ the workspace you created | Make them match |
| Neon apply: "requested history retention seconds exceeds allowed maximum" | Provider defaults to 24 h; free plan max is 6 h | `history_retention_seconds = 21600` (set in the `neon_db` module) |
| Upstash: `platform` "not expected" / `region` required | GitHub docs describe an unreleased provider version | Provider 2.1.x: `region = "global"` + `primary_region` |
| Local `plan` shows in-place updates with no attribute changes, CI says "No changes" | Local Terraform older than CI's | Use the pinned version (1.16.x) everywhere |
| CI `actions/checkout`: "Repository not found" (private repo) | Job-level `permissions:` replaced the workflow's `contents: read` | Add `contents: read` to that job's permissions |
| Deploy fails after a merge that only changed `infra/README.md` | `infra/**` path filter matched docs | Filters are `infra/envs/**` + `infra/modules/**` |
| `terraform plan` fails: `Get Redis Database failed … 404 "database not found"` | Upstash archived the free database after ~30 days without activity (the daily keep-alive cron prevents this). The provider errors instead of dropping it from state | Forget it in state, then let the next apply recreate it: `terraform state rm module.upstash_redis.upstash_redis_database.this` (or the destroy workflow's `forget_missing_redis`). The old data can be restored from the Upstash console |

## 4. Day-2 operations

| Task | How |
|------|-----|
| Change infra | Edit `infra/**` → PR (plan comment) → merge (apply) |
| Add/remove/rotate a secret or env var | `manage-secrets` skill |
| See drift | `drift.yml` runs weekly and opens an issue |
| Logs | Cloudflare dashboard → Worker → Logs (observability enabled), or `pnpm --filter api exec wrangler tail` |
| Watch free-tier usage | Cloudflare (Workers, Queues), Neon (CU-hours, storage), Upstash (commands) dashboards |
| Rotate a provider token | Create new → update GitHub secret → re-run `deploy.yml` → revoke old |
| Tear down (destructive — ask first) | Actions → **Terraform destroy** (`destroy.yml`) → Run workflow. Defaults only plan (see the run summary); tick *apply* and type `crudex` in *confirm* to destroy. The database is kept unless *include_database* is ticked; *delete_worker* also runs `wrangler delete` |

**What happens at a free limit** (no card on file means no surprise bills):
Workers/Queues → requests start failing until the daily reset (00:00 UTC);
Neon → compute suspends until next month; Upstash → requests rejected. The app should show friendly errors, never crash.

---

## 5. Local development infrastructure (no cloud quota used)

The app talks to Neon over **HTTP** and to Upstash over **REST**, which plain Postgres and
Redis don't speak. `docker-compose.yml` therefore runs small compatibility proxies:

| Service | Image (pin versions) | Port | Purpose |
|---------|---------------------|------|---------|
| `postgres` | `postgres:17` | 5432 | the database (drizzle-kit migrates it directly) |
| `neon-proxy` | a local Neon HTTP proxy (e.g. `local-neon-http-proxy`) | 4444 | lets `@neondatabase/serverless` talk to local Postgres |
| `redis` | `redis:7` | 6379 | the cache |
| `redis-http` | `serverless-redis-http` (SRH) | 8079 | Upstash-compatible REST API in front of local Redis |

`apps/api/.dev.vars` (gitignored; template in `.dev.vars.example`) points at these:
`DATABASE_URL`, `UPSTASH_REDIS_REST_URL=http://localhost:8079`, a dummy
`UPSTASH_REDIS_REST_TOKEN`. `wrangler dev` simulates Queues locally.

```bash
docker compose up -d
pnpm --filter api db:migrate
pnpm dev            # Vite :5173 (proxies /api + WebSockets) + wrangler dev :8787
```
