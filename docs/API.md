# School API

The application Worker serves the school API under `/api` on the application origin. The [OpenAPI 3.1 specification](openapi.yaml) contains the paths, request schemas, response fields and authentication schemes. The separate agent demo has its own passcode, routes and cookie. [Demo gateway guide](agent-gateway.md)

## Sign in and select a classroom

1. Exchange a single-use invitation with `POST /api/auth/session` and JSON `{"credential":"<invitation>"}`. The server issues an HttpOnly, SameSite=Strict cookie with an eight-hour lifetime. Production cookies also require HTTPS. Use same-origin requests and let the browser manage the cookie.
2. Read `GET /api/me`. The response contains `actor` and `memberships`. Use an assigned class ID from `actor.classes`. Switch membership with `POST /api/auth/membership` and an ID from that membership list.
3. Read `GET /api/agents` for this role. Teachers can use Jaew and the four teacher specialists. Principals have two assistants. Class, school, role and session permissions are checked by the server.
4. In local development, use `POST /api/auth/local` with `{"school":"lotus","role":"teacher","account":1}` to seed synthetic accounts. Supported schools are `lotus` and `river`; accounts are 1 and 2. This route requires a loopback request, local app URL, development environment and local database.
5. `DELETE /api/auth/session` invalidates the current session and clears the cookie. An operator with database access can issue a 15-minute invitation to an existing membership using `node apps/api/scripts/issue-school-invite.mjs <membership-uuid> <new-private-file>` with `DATABASE_URL` configured.

## Teacher chat, replay and worksheet publication

Send `POST /api/agents/jaew/runs` with JSON like the following, using an actual assigned class and a new UUID for each distinct user request.

```json
{
  "clientRequestId": "31c0a162-f7ad-4219-b372-d67a04deb01f",
  "classId": "ac000001-0000-4000-8003-000000000001",
  "prompt": "สร้างใบงานบวกเศษส่วน ป.5 จำนวน 5 ข้อ"
}
```

HTTP 202 returns a run record. Reuse the client request ID when retrying a submission after a network failure. The server returns the original run for a matching payload and HTTP 409 if the same ID was used for different work. Include the classroom for tools that need scores or that save worksheets. The sandbox starts a fresh session after replacement. Business records remain in Postgres.

Open `GET /api/runs/{runId}/events` with the school cookie. Each response carries up to 128 committed events, ordered by a numeric cursor. A response can end before the run finishes. Native EventSource reconnects using the advertised retry interval and the last event ID. With a fetch-based reader, retain each SSE `id`, reconnect on EOF with `Last-Event-ID`, and honor `retry`. Close on a JSON `done` or `error` event. Reconnecting after the terminal cursor returns HTTP 204. A memory proposal emits an `approval` event with `kind: "memory"` and a `proposalId`. A network interruption alone does not cancel a run.

```text
id: 104
data: {"type":"status","status":"running"}

id: 107
data: {"type":"delta","text":"กำลังเตรียมใบงาน"}

```

A tool event includes the call ID, name and status. A completed run ends with `done` and elapsed milliseconds. A failed, interrupted or cancelled run ends with `error` and its code. Read `GET /api/agents/{agentId}/history` for current run status and saved `worksheetIds`. `POST /api/runs/{runId}/cancel` fences subsequent results from that run; a provider request already in progress may consume usage.

Open the teacher copy at `GET /api/assessments/{id}`. Its `formUrl` is an application navigation path. Extract the play token to call `GET /api/play/{token}`. The quiz response contains student-safe questions and choices. A student assigned to that class posts `{"answers":{"q1":"<choice-id>"}}` to the same endpoint using the IDs it returned. Submit once for each student and worksheet. An identical retry returns the original grade; different answers after submission produce 409. The teacher’s `GET /api/classes/{id}/gradebook` returns the class roster, total earned and possible points across submissions, and worksheet links. Missing scores are null.

## Other school workflows

| Workflow | Caller and contract |
| --- | --- |
| Teacher memory | List a run’s proposals, then explicitly approve a proposal using its ID. Approved memories can be listed and deleted by their owner. A model’s suggestion alone cannot authorize storage. |
| Routines and family reports | An assigned teacher creates a daily class routine with a Bangkok-local hour and minute. The scheduler checks due work every five minutes. Pause or resume with `PATCH /routines/{id}`. `GET /reports` returns teacher-visible drafts; guardians can read sent reports only for their currently linked children. The school backend currently creates drafts. |
| Principal brief | `GET /briefs/morning?date=YYYY-MM-DD` returns school-scoped class and student counts, submissions, weighted average percent and report count. The optional date selects the Bangkok day for submissions and reports. Classes and students reflect current membership. The average is null when there are no marks. |
| Budget approvals | The teacher submits an idempotent request with date, budget code, purpose, items, quantities and integer prices in satang. Teachers read their own claims, principals read school claims. Only a signed-in principal can approve or return a pending claim. A return requires a reason. Each decision produces one notification per channel. |
| Runtime tool callbacks | Endpoints under `/internal/runs/{id}/tools/` require the credential of an active run attempt and enforce its scope. They are server-to-server operations. The browser uses the school routes above. |

All paths in this table are relative to `/api`. Times in JSON are ISO 8601 unless a field explicitly says milliseconds. Error responses use `{"error":{"code":"…","message":"…"}}` for application errors. Handle 400 for invalid input, 401 for a missing/expired session, 403 for insufficient permission, 404 for an unavailable resource, 409 for conflicting retries and 429 for exhausted run quota. After HTTP 202, execution failures arrive on the run stream. The legacy public notes and health routes are also listed in the specification.

## Local verification

Start the local data services, apply the migrations, and run the identity and approval checks against a disposable database. For the worksheet-to-report flow the test fixture acts as the agent gateway and calls the same authenticated tool callbacks as a live sandbox. It exercises the school HTTP API and Postgres without a paid model call. See the self-contained checks in [identity](../apps/api/scripts/check-school-identity.mjs), [approvals](../apps/api/scripts/check-school-approvals.mjs) and [school workflow](../apps/api/scripts/check-school-workflow.mjs).

To run all three checks from the repository root, start the Compose database and proxies, copy the local Worker settings and apply the migrations as described in the README. Build the static assets once, then start both local Workers in one Wrangler process.

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
