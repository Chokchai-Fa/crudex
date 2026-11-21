---
sidebar_label: Agent run lifecycle
description: Follow a school request from the application API through the queue, sandbox, tool callbacks and event replay.
---

# School backend and AI architecture

For cloud placement, data ownership and release paths across both Workers, see the [backend cloud architecture](cloud-services.md).

## School request lifecycle

1. Hono validates the same-origin session cookie and resolves the active school membership and class assignments in Neon. A teacher or principal submits a prompt with an agent ID and client request ID.
2. The run repository commits the run, daily usage reservation and dispatch intent together. A queue consumer claims a timed attempt. The five-minute recovery job picks up unqueued work and reconciles expired attempts.
3. The consumer calls the gateway’s named `SchoolDispatch` entrypoint through the `SCHOOL_GATEWAY` Worker binding. For Jaew, the gateway first asks a small model to label the turn and may answer it directly without a sandbox (see [direct replies](#direct-replies)). Otherwise the gateway signs the school, owner, role, class, agent, run, attempt and expiry for the runtime. The gateway admits the turn against the shared daily cap, then forwards it to that teacher's own sandbox manager instance, so teachers don't queue behind each other or force reboots. The runtime download and Kahoot callbacks carry the instance name back to the same instance.
4. The Node 24 runtime in Vercel Sandbox starts OpenCode with a server-side OpenAI key. Jaew can delegate worksheet work to Jum. School tools call the application API with the active attempt credential. The service checks scope and validates arithmetic before saving an assessment in Neon. A repeated invocation with identical content returns the saved worksheet.
5. The queue consumer records ordered events and terminal status independently of the browser. A client can replay from its last event ID and reopen worksheets from history. A replacement sandbox starts a fresh model session. Published work, approved memories, grades and reports survive replacement.

## Direct replies

Starting or rotating a sandbox can take a minute, and greetings or memory questions don't need one. Before forwarding a Jaew turn, `SchoolDispatch` asks `gpt-5.4-mini` to label the newest message. Each label selects its own path and model:

| Label | Example | Path | Model |
|-------|---------|------|-------|
| `chat` | Greeting, thanks, small talk, a general question | Gateway streams the reply from OpenAI | `gpt-5.4-mini`, no tools |
| `memory` | "Remember that class 5/2 struggles with denominators", "What did I ask you to remember?" | Gateway streams the reply and may call `memory_search` / `memory_save` | `gpt-5.4-mini` |
| `task` | Worksheets, forms, Kahoot, slides, lesson prep, scores, documents, approvals | Sandbox runtime, unchanged | The agent's own model |

For `task` turns the model depends on the agent doing the work, set by `model` in each [agent definition](https://github.com/Chokchai-Fa/crudex/tree/main/apps/agent-runtime/src/agents). Jeng (slides, Kahoot, activities) and Nun (score analysis) run on `gpt-5.4-mini` for speed. Jaew, Jum (worksheets, quizzes, exams), Porn and the principal agents run on `gpt-6.2-sol`. The `routes` table in the direct reply module sets the models for chat and memory turns.

A direct reply uses Jaew's shared persona and the recent conversation that the run service already prepends to the prompt. Memory tools call the same `/api/internal/runs/{id}/tools/memory_*` callbacks as the runtime, using the attempt credential. Memories are still stored in Neon and still need the teacher's approval. Direct replies use the existing stream events (`delta`, `tool`, `done`, `error`), so the API and the web client handle them like any other run. Direct turns don't count against the sandbox's daily run cap.

The turn goes to the sandbox if:

- the router fails, times out after 3 seconds or returns an unexpected label
- OpenAI refuses the first completion
- the agent isn't on the direct list

A direct reply can't delegate work or create materials. When a teacher asks for that, the turn is labelled `task`. [Direct reply module](https://github.com/Chokchai-Fa/crudex/blob/main/apps/agent-gateway/src/direct-reply.ts)

## OpenAI backend and rollback

Agents are moving from the Vercel sandbox to the OpenAI API, one at a time, to remove sandbox start-up time. A ported agent runs in the gateway Worker. The Worker sends the agent's instructions, with its skills appended, to OpenAI and streams the reply as run events. It runs tool calls between model rounds:

- **School API tools** (`get_scores`, `memory_search`…) call the same `/api/internal/runs/{id}/tools/*` callbacks as the runtime, using the attempt credential.
- **Pure tools** (`calc`) run inside the Worker from the runtime's own tool modules.

The agent definitions, skills and tool descriptions are imported from `apps/agent-runtime`, so both backends see the same text. OpenAI's hosted shell is not used: the ported tools don't need a container, and starting one would add latency and container charges.

Two vars in `apps/agent-gateway/wrangler.toml` control it:

| Var | Values | Effect |
|-----|--------|--------|
| `AGENT_BACKEND` | `vercel` (current, rolled back while `interrupted` runs are investigated) or `openai` | `vercel` sends every school turn to the sandbox, including Jaew's chat and memory turns |
| `OPENAI_AGENTS` | Comma-separated agent IDs (currently `nun`) | Agents that run on OpenAI. Unlisted agents, and agents not yet ported, use the sandbox |

**To roll back**, set `AGENT_BACKEND = "vercel"`, or remove an agent from `OPENAI_AGENTS`, then redeploy the gateway with the `deploy-agent.yml` workflow. The sandbox, `SandboxManager` and runtime bundle stay deployed until every agent has moved. A turn also falls back to the sandbox automatically when OpenAI refuses its first request.

Ported so far: **Nun**, when a teacher chats with Nun directly. Work that Jaew hands to Nun still runs in the sandbox until Jaew is ported. [OpenAI backend](https://github.com/Chokchai-Fa/crudex/blob/main/apps/agent-gateway/src/openai-backend.ts)

[Run service](https://github.com/Chokchai-Fa/crudex/blob/main/apps/api/src/services/runs.service.ts) · [Dispatch entrypoint](https://github.com/Chokchai-Fa/crudex/blob/main/apps/agent-gateway/src/school-dispatch.ts) · [Runtime integration](https://github.com/Chokchai-Fa/crudex/blob/main/apps/agent-runtime/src/school.ts)

## Access and data ownership

The application Worker enforces permissions for each operation. A student reads a quiz without its answer key and receives a grade after submission. A teacher sees assigned classes and approves their own memory proposals. A guardian can read sent reports for currently linked students. A principal reads aggregate school data and confirms individual budget decisions through the authenticated API. The school agent has read-only approval tools. [API contract](../integrations/school-api.md) · [Database constraints and ownership](../reference/database.md)

The public gateway demo keeps its own passcode sessions, sample tools and morning-brief alarm. The school application reads principal aggregates from Neon, and its routine scheduler creates per-recipient drafts. External family delivery is pending. [Demo gateway guide](../integrations/demo-gateway.md) · [Cloud services](cloud-services.md)
