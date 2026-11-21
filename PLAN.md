# School backend and AI integration plan

PR #2 supplies the agent gateway, disposable Vercel Sandbox lifecycle, Node 24 OpenCode harness, five teacher agents, delegated streaming, embedded skills and school tools. Build the school-account workflows around those components. The [architecture](docs/ARCHITECTURE.md) describes the current request path and proposed integration. The [product specification](docs/PRODUCT.md) defines the backend contracts consumed by the design exports.

## Delivery order

The first school-account release is one teacher creating a verified worksheet through Jaew and Jum, then opening it after the sandbox has stopped. Deliver milestones 1–4 in order for that flow. Quiz submission and gradebook build on the saved assessment. Routines and briefs consume the resulting school records. The principal registry fix can ship independently and must land before principal acceptance.

| Change set | Primary files | Observable result |
| --- | --- | --- |
| Principal gateway fix | `apps/agent-runtime/src/agents/index.ts`, `src/server.ts` in that workspace, `apps/agent-gateway/test/morning-brief.test.ts` | The principal agent directory and manual brief agree on the registered agent ID. |
| Identity | `packages/shared/src/identity.schema.ts`, `apps/api/src/middleware/actor.ts`, `db/schema/schools.ts` and `routes/me.routes.ts` under the API workspace | An authenticated teacher sees only assigned schools and classes. |
| AI dispatch | `apps/agent-gateway/src/index.ts`, `sandbox-manager.ts`, `apps/agent-runtime/src/server.ts` and `src/plugin.ts` | A trusted school request reaches the existing agent with verified scope. |
| Run lifecycle | `packages/shared/src/runs.schema.ts`, API run routes/service/repository, `apps/api/src/jobs/messages.ts` and `queue-handler.ts` | The caller receives a durable run ID and can replay committed events. |
| Assessment and gradebook | API assessment, quiz and submission routes/services/repositories; runtime tools `save_assessment.ts` and `get_scores.ts` | A student takes a published quiz; only the assigned teacher sees the gradebook. |
| Scheduled work | API routine and delivery repositories, `apps/api/src/jobs/scheduled-handler.ts`, `apps/agent-gateway/src/morning-brief.ts` | A scheduled occurrence has one outcome per child; the principal sees school-level aggregates. |

New filenames are proposed. Export each shared schema through `packages/shared/src/index.ts`, register API routes in `apps/api/src/app.ts`, and add dependencies through `apps/api/src/middleware/deps.ts`. Keep routes, services and repositories separate. Generate additive migrations alongside each feature so the previous Worker revision continues to operate during rollout.

## Existing gateway contract and immediate blocker

- [ ] Align the principal agent registry with the [gateway contract](docs/agent-gateway.md). On `1724d2b`, the role filter names `rungchao` and `lekha_por` but neither is registered. Use a scripted provider to verify the principal list, a principal chat, and a successful manual brief through the gateway and runtime together.
- [ ] Exercise the existing `BRIEFS` alarm after first access, a scheduled generation at 07:00 Bangkok and an upstream failure that preserves the last valid brief. Keep the new gateway routes compatible as school-level authorization and storage are added.

## 1. Establish school identity

- [ ] Add schools, memberships, classes, teacher assignments and student/guardian mappings under `apps/api/src/db/schema/`. Generate additive Drizzle migrations and seed two synthetic schools.
- [ ] Define identity DTOs in `packages/shared/src/`. Resolve membership from a verified session in Hono middleware and expose `GET /api/me`. Follow the existing route → service → repository pattern.
- [ ] Verify expired memberships, forged roles and cross-school IDs are rejected. Preserve the gateway’s passcode demo using synthetic data.

## 2. Connect the school API to the existing agent gateway

- [ ] Add an authenticated internal dispatch route in `apps/agent-gateway/src/index.ts`. Select the manager by verified school and owner. Extend the manager in place, preserving boot, drain, rotation, shutdown and the overall capacity limit.
- [ ] Pass an expiring credential bound to school, owner, class, agent, run and attempt. Thread verified identity through `server.ts`, the plugin and school tools. Require identity on school requests; keep the sample fallback confined to the demo. Bind session reuse to its owner.
- [ ] Verify two teachers cannot reuse each other’s sessions or query each other’s classes. Test invalid claims, concurrent cold starts and exhausted capacity. A replacement sandbox accepts a new turn with a fresh session.

## 3. Make runs, streaming and memory durable

- [ ] In `apps/api`, persist run acceptance, quota reservation and dispatch intent atomically, keyed by owner and client request ID. Queue the dispatch and let the consumer read the existing chat SSE stream. Store sequenced events and expose run history and replay endpoints.
- [ ] Record completion, failure or interruption against the current attempt. Deduplicate queue retries and reject expired attempts. On ambiguous dispatch, surface interruption for explicit retry. Reuse existing agent definitions and delegation.
- [ ] Adapt memory search/save to owner-scoped repositories. Add one-use approval receipts bound to owner, run and proposed content. Preserve the existing content filters and test that a model-supplied confirmation alone cannot write memory.
- [ ] Exercise a disconnect, repeated POST, provider timeout, quota denial and sandbox loss. Verify one logical run per request ID, replay after reconnect, and a fresh session on explicit retry.

### Run contract and retry rules

Implement `POST /api/agents/:id/runs` with a client request ID. A first submission returns HTTP 202 with its run ID. A replay with the same owner, key and payload returns the original run; a different payload with that key returns 409. Use a database uniqueness constraint and a Neon-compatible atomic write for the run, quota reservation and outbox row. Test simultaneous requests against local Postgres as well as service fakes.

Expose `GET /api/runs/:id/events` with monotonic SSE IDs and `Last-Event-ID` replay, plus `GET /api/agents/:id/history`. Keep the leased attempt ID separate from the run ID. Record `queued → running → succeeded`, with explicit approval, failed, cancelled and interrupted paths. A consumer may retry dispatch before the runtime acknowledges it when the runtime can deduplicate by attempt. An uncertain execution ends in reconciliation or interruption. Browser reconnects only read events.

## 4. Connect assessments, quizzes and grades

- [ ] Use the existing `check_assessment` and `save_assessment` tools. Add an idempotent, scoped save callback, validated by the school service, and persist immutable versions with teacher-only keys. Reference one worksheet from both agents’ histories.
- [ ] Extend the existing Forms publisher with durable publication status and a local form fallback. Add quiz and submission endpoints. Pin each submission to an assessment version and grade it on the server.
- [ ] Replace sample score reads in school mode with repository-backed gradebook reads. Verify invalid answer keys, duplicate submissions, repeated publication, student-safe responses and staff assignment checks.

## 5. Connect routines, parent reports and principal briefs

- [ ] Extend the existing scheduled and queue handlers with timezone-aware routines and a delivery outbox. Deduplicate each scheduled occurrence and child delivery. Keep local email as a draft; reconcile uncertain external sends before retry.
- [ ] Scope every report to the mapped child and recipient. Derive principal brief totals from school-local grades and delivery outcomes. Feed only authorized aggregates to any AI summary.
- [ ] Verify paused routines, duplicate queue delivery, two guardians, local date boundaries, and empty-school results.

## 6. Verify the integrated backend

- [ ] Run workspace lint, typecheck, test and build. Run the existing agent runtime scripted-model E2E suite against the pinned OpenCode version. Keep the gateway gate and daily-cap tests passing.
- [ ] Exercise the school API flow with synthetic data from teacher prompt through delegation, verified worksheet, quiz submission, gradebook and brief. Verify saved artifacts remain readable after sandbox replacement.
- [ ] Use a separately authorized key and budget for one live OpenAI smoke test. Verify account eligibility and no-card hosting limits before any hosted rollout. Follow the repo’s infrastructure and secret-management workflows for bindings or credentials introduced during implementation.

## Local verification sequence

1. Use the pinned repo Node version and `pnpm install --frozen-lockfile`. Start the Compose dependencies and run migrations against the local database as described in the [README](README.md).
2. For each API change, exercise the new route and denial path using the patterns in [notes route tests](apps/api/test/notes.routes.test.ts). Run `pnpm --filter api test`, `pnpm --filter agent-gateway test` and `pnpm --filter agent-runtime test` for the touched packages.
3. For agent changes, set `OPENCODE_BIN` to the compatible local OpenCode executable and run `node apps/agent-runtime/e2e/run.mjs` with Node 24. Extend the scripted scenarios for principal routing and scoped tool calls.
4. For the first release, seed two schools, submit one Thai worksheet request twice with the same ID, disconnect and reconnect, and verify one assessment, one quota reservation and zero cross-school reads. Replace the sandbox and retrieve the completed assessment again. Run the workspace gates from milestone 6 before release.
