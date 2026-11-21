# School backend and AI architecture

For cloud placement, data ownership and release paths across both Workers, see the [backend cloud architecture](CLOUD-ARCHITECTURE.md).

## School request lifecycle

1. Hono validates the same-origin session cookie and resolves the active school membership and class assignments in Neon. A teacher or principal submits a prompt with an agent ID and client request ID.
2. The run repository commits the run, daily usage reservation and dispatch intent together. A queue consumer claims a timed attempt. The five-minute recovery job picks up unqueued work and reconciles expired attempts.
3. The consumer calls the gateway’s named `SchoolDispatch` entrypoint through the `SCHOOL_GATEWAY` Worker binding. The gateway signs the school, owner, role, class, agent, run, attempt and expiry for the runtime. The shared sandbox manager rotates the sandbox when the owner changes and limits concurrent work.
4. The Node 24 runtime in Vercel Sandbox starts OpenCode with a server-side OpenAI key. Jaew can delegate worksheet work to Jum. School tools call the application API with the active attempt credential. The service checks scope and validates arithmetic before saving an assessment in Neon. A repeated invocation with identical content returns the saved worksheet.
5. The queue consumer records ordered events and terminal status independently of the browser. A client can replay from its last event ID and reopen worksheets from history. A replacement sandbox starts a fresh model session. Published work, approved memories, grades and reports survive replacement.

[Run service](../apps/api/src/services/runs.service.ts) · [Dispatch entrypoint](../apps/agent-gateway/src/school-dispatch.ts) · [Runtime integration](../apps/agent-runtime/src/school.ts)

## Access and data ownership

The application Worker enforces permissions for each operation. A student reads a quiz without its answer key and receives a grade after submission. A teacher sees assigned classes and approves their own memory proposals. A guardian can read sent reports for currently linked students. A principal reads aggregate school data and confirms individual budget decisions through the authenticated API. The school agent has read-only approval tools. [API contract](API.md) · [Database constraints and ownership](DATABASE.md)

The public gateway demo keeps its own passcode sessions, sample tools and morning-brief alarm. The school application reads principal aggregates from Neon, and its routine scheduler creates per-recipient drafts. External family delivery is pending. [Demo gateway guide](agent-gateway.md) · [Cloud services](CLOUD-ARCHITECTURE.md)
