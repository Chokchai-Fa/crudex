# Agent runtime

OpenCode runs on Node 24 in a Vercel Sandbox. The `crudex-agent` Worker authenticates
users, starts a sandbox on demand, and relays the SSE stream. The runtime keeps
sessions in SQLite under `DATA_DIR`. Sandbox rotation or idle shutdown starts a
fresh database. A client with an expired session ID gets a fresh session on its
next turn.

Memory, approvals, notifications, and published briefs are written atomically
to `DATA_DIR/state.json` and loaded when the runtime starts. The gateway also
checkpoints this state in the sandbox manager's Durable Object after streamed
chats and before idle shutdown or rotation. It restores the checkpoint before
proxying requests to a replacement sandbox. Demo state uses the `runtimeState`
key, and school state uses a separate key for each school and owner.

The gateway stores snapshots in 120 KiB byte chunks and transfers snapshots up
to 1 MiB through the token-protected `/__state` route. If a checkpoint fails
or exceeds 1 MiB, the gateway keeps the last successful checkpoint. If a
restore fails, the replacement sandbox stays unavailable until a boot can
restore the saved state.

## Run locally

1. Run `pnpm install` at the repo root.
2. Run `node apps/agent-runtime/scripts/bundle.mjs`. It writes
   `apps/agent-runtime/dist/sandbox/server.mjs` and `apps/agent-runtime/dist/app.tgz`.
3. Set `OPENAI_API_KEY`, `UPSTREAM_TOKEN` and `DATA_DIR` in your shell and run
   `node apps/agent-runtime/dist/sandbox/server.mjs` with Node 24. Use a sample API
   key for a health-only check. A live turn needs a key authorized for `gpt-6.2-sol` (the seven teacher and principal agents; `test-agent` still uses `gpt-5.4-mini`).
   `HOST` defaults to `0.0.0.0` and `PORT` defaults to `8790`.
4. Send `GET /__health` with the `x-crudex-upstream-token` header. The authenticated
   `/__stats` route counts tool executions in the current process.

Run `pnpm turbo run lint typecheck test --filter=agent-runtime --filter=agent-gateway`
to check both packages together.

## Add an agent

1. Define it in `src/agents/<id>.ts` using `AgentDefinition`. Choose `primary` for a
   selectable agent or `subagent` for a delegated agent.
2. List the IDs of the tools, skills and subagents it may use. An empty list
   grants no entries in that category.
3. Add the definition to `src/agents/index.ts`. Rebuild and verify it in a turn.

## Add a tool

1. Create `src/tools/<name>.ts` using `ToolDefinition`. Declare a JSON Schema for its
   arguments and return JSON-serializable output from `execute`.
2. Set `gate` to `allow` or `ask`. The gateway has no approval UI, so turns reject
   requests for approval.
3. Add the tool to `src/tools/index.ts` and bind its name on each permitted agent.
   The plugin checks the binding and permission before entering `execute`.
4. Rebuild and verify an allowed and an unbound call.

## Add a skill

1. Write `skills/<id>/SKILL.md` with `name` and `description` YAML frontmatter. Use
   a lowercase directory ID with letters, numbers and hyphens.
2. Bind the directory ID in the intended agents' `skills` lists.
3. Rebuild the bundle and verify the skill can be loaded by a bound agent.

## Gateway deployment

`.github/workflows/deploy-agent.yml` builds the archive, deploys `crudex-agent`,
and runs the Thai clock and restricted-tool smoke tests. Configure
`CLOUDFLARE_API_TOKEN`, `VERCEL_TOKEN`, `AGENT_PASSCODE` and `AGENT_OPENAI_API_KEY`
as GitHub Actions secrets. The workflow resolves the account, Worker subdomain,
Hobby team and project. The Worker controls the daily Bangkok quota and idle
timeout with `DAILY_RUN_LIMIT` and `IDLE_STOP_MINUTES`.
