# Crudex school backend and AI integration

## Goal and baseline

A teacher can ask in Thai for a Grade 5 fractions worksheet, watch the secretary delegate to the worksheet agent, receive a verified assessment, and reuse it for a quiz. The same school backend supplies scores, scheduled parent reports and a principal’s morning brief. The [design inventory](design/README.md) and [Paper screen exports](design/paper-export/README.md) define the consumer-visible states. The [gateway guide](agent-gateway.md) describes the existing demo API. This proposal covers the API, data model, jobs and AI runtime. Frontend implementation is a separate workstream.

## Execution and ownership

The public entry is the existing Hono Worker. Routes validate shared Zod contracts, derive school, actor and role from a verified session, then call services. Repositories own Neon queries. The role selection pictured in the designs can only select an existing membership. Start locally with explicitly seeded synthetic memberships. A shared environment requires authenticated memberships.

The merged Crudex agent gateway runs the OpenCode school plugin in disposable Node 24 Vercel Sandboxes. Reuse that runtime for chat and worksheet generation. The [system architecture](ARCHITECTURE.md) describes the live code paths and proposed school API integration.

The Worker communicates with an authenticated private runtime adapter. Each request carries a short-lived signed identity scoped to a school, actor, agent and run. Bind tool access to that identity. Node owns temporary OpenCode session state scoped to school and owner. A replacement sandbox starts a fresh session. Neon owns memberships, agent definitions and versions, chat/run records, approved memory, assessments, submissions, schedules and delivery records. Keep secret values out of prompts, transcripts and logs. Use only server-side `OPENAI_API_KEY` in the runtime and an allowlisted model setting, initially `openai/gpt-5.4-mini` subject to account access. Offline tests use the scripted provider. Live runs use an existing authorized key and budget.

## API capabilities

Proposed paths below are relative to `/api`. All identifiers require ownership or membership checks at lookup.

| Design consumer | Backend contract and outcome |
| --- | --- |
| Landing, role selection, mobile (00, 00m, 08, 11) | Landing is static. `GET /me` returns authorized roles and classroom memberships. Mobile uses the same resource IDs and authorization. |
| Teacher chat and shared states (01a–c, 10) | `POST /agents/:id/runs` accepts a prompt and client request ID, returns a run ID. `GET /runs/:id/events` streams sequenced SSE events for progress, text, approval, artifact, completion or failure. `GET /agents/:id/history` restores results. An unavailable provider leaves a retryable failure and preserves existing work. |
| Worksheets and form fallback (02, 05) | `GET /assessments/:id` returns verified, versioned A4 worksheet content. Restrict the answer key to teachers. Publish a verified version as a local form when the Google Forms adapter is unavailable. Record which delivery path succeeded. |
| Gradebook and student quiz (03, 04) | Teacher publishes a quiz from an assessment. A scoped participant token opens that quiz; a submission is scored on the server against the pinned version. `GET /classes/:id/gradebook` reads durable submissions and restricts access to assigned staff. |
| Parent report and routines (06, 07) | Authorized teachers create, pause and inspect routines. A due occurrence produces a per-child report using only that child’s records and approved recipient mapping. Local delivery writes a draft. An external adapter may mark sent after confirmed delivery. |
| Principal brief (09) | `GET /briefs/morning?date=YYYY-MM-DD` returns school-scoped aggregates for an authorized principal. Build on the demo’s latest-brief and manual-generation endpoints once principal agents are registered. Derive counts from submissions and routine outcomes. Render an explicit empty state when no data exists. |

## AI and job semantics

- Reuse one top-level session per school, owner and agent within the lifetime of a healthy sandbox. Preserve native child sessions for delegation. Store the resulting artifact once and reference it from both histories. Serialize turns within a session and deduplicate retries by owner and request ID.
- Port agent definitions, skill bindings and role/tool guards. Disable built-in shell and filesystem tools. Allow only registered school tools and explicit delegation targets. Session-level overrides can shadow child-agent rules. Apply the allowlist at agent definition and again inside each tool.
- Require single-use approval tied to owner, run and proposed memory content before saving. Provide owner-scoped list and delete operations. Bound run time, tool steps, output tokens and daily model usage, including delegated and scheduled work. A failed or interrupted run must reach a terminal state.
- Use the fraction checker before saving or publishing an assessment. A failed check returns a correctable draft. Use deterministic grading and aggregate calculations. Any generated narrative receives only the authorized results.
- Persist run event sequence numbers and terminal state so reconnecting clients can replay after their last event ID. Keep Postgres as the recovery source for business records. Redis may accelerate reads.
- Use the existing scheduled handler to find due routines in school local time and enqueue typed jobs. Make each occurrence unique by routine and scheduled instant, and each delivery unique by occurrence and child. Use an outbox and provider idempotency where supported. An ambiguous send enters reconciliation before another delivery attempt.

## Release boundary

First acceptance uses synthetic records, local form delivery, draft mail and the real OpenCode runtime with a scripted model. A separately authorized live smoke test exercises OpenAI with one synthetic prompt. Real Google accounts, external email, hosted runtime and paid usage require confirmed credentials, hosting and budget before activation. Additional deliverables beyond the design exports can use the same school API contracts.
