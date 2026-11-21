# Codex task 01 — agent runtime (opencode in Vercel Sandbox behind Worker `crudex-agent`)

You are working in the crudex monorepo on branch `agent-design`. Read `AGENTS.md` first.
This repo is PUBLIC: never write secrets, tokens, passcodes, URLs of private services, emails or
real school data into any file. All demo data is sample data.

## Goal
Stand up the agent harness so later tasks only add agents, tools and skills. One test agent and two
test tools are enough. Do not design product agents.

## Reference (read only, do not copy files wholesale — rewrite)
A pre-event POC lives at `/Users/mac/Documents/edbot` (branch `poc/opencode-harness`). Useful to read:
- `apps/api/src/poc/sandbox-proxy.ts` — Durable Object that opens/rotates/stops a Vercel Sandbox
- `apps/api/src/poc/node/server.ts`, `node/opencode-node.ts`, `node/ffi-stub.ts`, `node/claude-agent-stub.ts`
- `apps/api/scripts/build-poc-sandbox.mjs` — esbuild bundle for the sandbox (aliases + photon-node copy)
- `apps/api/src/poc/index.ts` `runAgent()` — opencode event loop → SSE
- `apps/api/src/poc/school-plugin.ts`, `school-plugin/catalog.ts` — plugin API: `ctx.agent.transform`,
  `ctx.tool.transform`, `ctx.permission.hook('evaluate', …)`, `ctx.permission.assert`, `permissionsFor`, `decide`
- `.github/workflows/deploy-poc.yml` — deploy + smoke test pattern
Lessons that are requirements here:
1. opencode must NOT run inside a Durable Object (128 MB limit). It runs on Node 24 in a Vercel Sandbox.
2. Never set session-level permissions and never set a project-wide `deny *`: a subagent's child session
   inherits the parent's session rules. Agent definitions carry the permissions; a
   `permission.evaluate` hook makes the definition win at run time.
3. Every custom tool calls a guard first (agent bound to this tool? then `ctx.permission.assert`).
4. Use exact versions `@opencode/sdk@2.3.2` and `@opencode/plugin@2.3.2` (same as the POC lockfile).

## Layout to create
```
apps/agent-runtime/            # Node 24 server that runs in the sandbox (package name "agent-runtime")
  src/server.ts                # node:http server; every request needs header x-crudex-upstream-token
  src/harness.ts               # creates the OpenCode host (OpenCode.create from @opencode/sdk) once, SQLite under DATA_DIR
  src/run.ts                   # runTurn(): opencode events → our stream events (async generator)
  src/plugin.ts                # one opencode plugin built from the registries below
  src/permissions.ts           # permissionsFor(def) + decide(rules, action, resources) — pure, unit tested
  src/agents/types.ts          # AgentDefinition {id,name,description,mode,model,instructions,tools,skills,subagents}
  src/agents/index.ts          # export const agents = [testAgent]   ← add new agents here
  src/agents/test-agent.ts     # id "test-agent", model "gpt-5.4-mini", tools ["server_clock"], answers in Thai
  src/tools/types.ts           # ToolDefinition {name,description,input(JSON schema),gate:'allow'|'ask',execute}
  src/tools/index.ts           # export const tools = [serverClock, restrictedProbe]   ← add new tools here
  src/tools/server-clock.ts    # returns current time in Asia/Bangkok + a counter; proves tool calls work
  src/tools/restricted-probe.ts# registered but NOT bound to test-agent; must be refused
  skills/README.md             # skills/<id>/SKILL.md (name + description frontmatter); embedded at build via ctx.skill.transform
  scripts/bundle.mjs           # esbuild → dist/sandbox/server.mjs (+ runtime files) ; then tar → dist/app.tgz
  test/*.test.ts               # vitest: permissions, plugin registration, guard refuses unbound tool
  README.md                    # how to add an agent / tool / skill in 3–5 steps each
apps/agent-gateway/            # Cloudflare Worker "crudex-agent" (package name "agent-gateway")
  wrangler.toml                # name = "crudex-agent"; SQLite-backed DO class SandboxManager; static assets dir public/
  src/index.ts                 # routes below
  src/gate.ts                  # passcode login → signed HttpOnly cookie (HMAC with the passcode), timing-safe compare
  src/sandbox-manager.ts       # Durable Object: open on demand, health wait, idle stop, rotate before Vercel timeout, daily cap
  public/index.html            # tiny test page: agent select, textbox, streamed answer, tool events, status panel
  test/*.test.ts               # gate + daily cap unit tests
.github/workflows/deploy-agent.yml
```
Add both apps to the pnpm workspace (already `apps/*`). Keep `lint`, `typecheck`, `test`, `build`
scripts in each package so turbo picks them up. Do not touch `apps/api`, `apps/web`, `infra/`,
`wrangler.toml` of the main app, or other workflows.

## Runtime server contract (apps/agent-runtime)
Env: `OPENAI_API_KEY`, `UPSTREAM_TOKEN`, `DATA_DIR`, `PORT` (default 8790), `HOST` (default 0.0.0.0).
All routes reject a missing/wrong `x-crudex-upstream-token` with 401 (timing-safe).
- `GET /__health` → `{ok:true, agents:[ids], tools:[names]}`
- `GET /__stats` → `{toolCalls: {name: count}}` (counts real executions of our tools)
- `GET /agents` → `[{id,name,description}]` for primary agents
- `POST /chat` body `{agentId, text, sessionId?}` (zod-validated, text ≤ 4000) → `text/event-stream`,
  each event `data: <json>\n\n`:
  `{type:"session",sessionId}` · `{type:"delta",text}` · `{type:"tool",name,id,status:"started"|"success"|"failed"}` ·
  `{type:"done",elapsedMs}` · `{type:"error",code,detail?}`. Unknown `sessionId` → create a new session.
  Create sessions with `agent` + `model {providerID:'openai', id}` and NO `permissions`.
  Auto-reject any `permission.asked` (no UI for approvals yet). Timeout 120 s.

Plugin: remove built-in agents (`build`, `plan`, `general`, `explore`) and built-in tools are denied by
each agent's rules (deny `*` first, then allow the agent's tools/skills/subagents — last match wins).
Register every ToolDefinition with `options:{codemode:false}`; `execute` first runs the guard: if the
calling agent's definition does not list the tool → throw an error with code `tool_not_bound`.

Bundle: Vercel image `node:24`, no install step in the sandbox, so bundle everything with esbuild
(platform node, esm, target node24, `external:['*.node']`, alias `ffi-rs` and
`@anthropic-ai/claude-agent-sdk` to stubs, createRequire banner, copy runtime-loaded packages like the
POC does). Verify `node dist/sandbox/server.mjs` starts locally.

## Gateway contract (apps/agent-gateway, Worker `crudex-agent`)
Secrets: `PASSCODE`, `OPENAI_API_KEY`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`.
Vars: `DAILY_RUN_LIMIT` (default "60"), `IDLE_STOP_MINUTES` (default "10").
- `GET /` test page (behind gate) · `GET /login` form · `POST /login` → cookie · `POST /logout`
- `GET /api/status` → `{sandbox:"stopped"|"starting"|"running", startedAt?, lastUsedAt?, runsToday, limit}`
- `GET /api/agents` → proxied
- `POST /api/chat` → counts one run against the daily cap (day = Asia/Bangkok date; 429 `{error:"daily_limit"}`
  when over), then streams the sandbox SSE through unchanged.
- `/__sandbox/app.tgz` → only with the one-time boot token (the sandbox downloads the runtime from the
  Worker's static assets; the tarball is built into `public/__sandbox/app.tgz` in CI and gitignored).
SandboxManager (one instance, name "main"): on the first request create a sandbox
(`@vercel/sandbox`, image `node:24`, port 8790, timeout 45 min, 2 vCPU, tag app=crudex-agent), download
+ untar the runtime, start `node server.mjs` detached with env (OPENAI_API_KEY, UPSTREAM_TOKEN = fresh
random 32-byte hex per sandbox, DATA_DIR), poll `/__health` (≤ 45 s). Rotate when older than 40 min.
An alarm stops the sandbox after `IDLE_STOP_MINUTES` without requests. Concurrent first requests share
one start promise. Pass the Worker's `fetch` into the Vercel SDK (its undici client does not run on workerd).
The OpenAI key and the upstream token only travel in the sandbox env / request header; never log them.

## CI: .github/workflows/deploy-agent.yml
Trigger: push to `agent-design` touching `apps/agent-*/**` or the workflow, plus `workflow_dispatch`.
Steps: setup action → `pnpm --filter agent-runtime --filter agent-gateway test` → bundle runtime and copy
tarball into gateway `public/__sandbox/` → resolve `CLOUDFLARE_ACCOUNT_ID` from `GET /accounts` with
`CLOUDFLARE_API_TOKEN` (mask it), resolve Vercel team (`/v2/teams`, first) and project (prefer a project
named `crudex`, else the first; print the chosen name, mask ids) → `wrangler deploy` from apps/agent-gateway
with `--secrets-file` built by jq from GitHub secrets `AGENT_PASSCODE`, `AGENT_OPENAI_API_KEY`,
`VERCEL_TOKEN` + resolved ids (delete the file in a trap) → smoke test against the deployed URL:
login, `GET /api/status`, chat 1 "ตอนนี้กี่โมง ใช้เครื่องมือ server_clock" must contain a `delta`, a `tool`
event `server_clock` `success` and `done`; chat 2 asking the agent to call `restricted_probe` must end
with `done` or `error` and must NOT contain a `restricted_probe` `success`; print timings. The Worker
URL is `https://crudex-agent.<subdomain>.workers.dev`; resolve the subdomain from
`GET /accounts/{id}/workers/subdomain`.

## Done means
`pnpm install`, then `pnpm --filter agent-runtime --filter agent-gateway lint typecheck test` pass,
`node apps/agent-runtime/scripts/bundle.mjs` produces the tarball, and the bundled server starts locally
and answers `/__health`. Do not deploy and do not push; I will. Commit in small commits with clear
messages (`feat(agent-runtime): …`). Report what you verified and what you could not.
