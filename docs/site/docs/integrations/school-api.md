---
sidebar_label: School API
description: Authenticate a school account, start a run, replay events, publish a worksheet and retrieve grades.
---

# School API

The application Worker serves the school API under `/api` on the application origin. The [OpenAPI 3.1 specification](../reference/openapi.mdx) contains the paths, request schemas, response fields and authentication schemes. The separate agent demo has its own passcode, routes and cookie. [Demo gateway guide](demo-gateway.md)

## Try the school workspace

Open the application and choose **ครู** to enter the classroom or **ผอ.** to view the school’s morning brief. Each new trial gets a private sample school, class ป.4/1 and two fictional students. Refreshing resumes the same session. Sign out to try the other role in a fresh school.

The browser sends `POST /api/auth/guest` with `{"role":"teacher"}` or `{"role":"principal"}`. The API creates the guest account, memberships, class assignments and session together. The response has the same shape as `GET /api/me`. The session and demo memberships expire after eight hours. An active account must sign out before starting a new trial. Multiple visitors can start trials from the same school network.

## Sign in and select a classroom

1. Exchange a single-use invitation with `POST /api/auth/session` and JSON `{"credential":"<invitation>"}`. The server issues an HttpOnly, SameSite=Strict cookie with an eight-hour lifetime. Production cookies also require HTTPS. Use same-origin requests and let the browser manage the cookie.
2. Read `GET /api/me`. The response contains `actor` and `memberships`. Use an assigned class ID from `actor.classes`. Switch membership with `POST /api/auth/membership` and an ID from that membership list.
3. Read `GET /api/agents` for this role. Teachers can use Jaew and the four teacher specialists. Principals have two assistants. Class, school, role and session permissions are checked by the server.
4. In local development, use `POST /api/auth/local` with `{"school":"lotus","role":"teacher","account":1}` to seed synthetic accounts. Supported schools are `lotus` and `river`; accounts are 1 and 2. This route requires a loopback request, local app URL, development environment and local database.
5. `DELETE /api/auth/session` invalidates the current session and clears the cookie. An operator with database access can issue a 15-minute invitation to an existing membership using `node apps/api/scripts/issue-school-invite.mjs <membership-uuid> <new-private-file>` with `DATABASE_URL` configured.

## Teacher chat, replay and worksheet publication

For interactive conversation, send `POST /api/agents/{id}/chat` with the same payload shown below. The API reserves the run and dispatches it to the agent on the open HTTP request. A new request returns HTTP 200, an `X-Run-Id` header and a stream of newline-delimited JSON run events. A repeated request ID returns the original run as JSON. Refresh or reconnect using the saved run history and event cursor. The same school permissions, daily model quotas and run recovery apply to both paths.

The classroom sends ordinary messages and questions directly. Artifact-generation presets and explicit creation requests, such as creating a worksheet or slides, use background delivery so the user can leave while work continues.

For background delivery, send `POST /api/agents/jaew/runs` with JSON like the following, using an actual assigned class and a new UUID for each distinct user request.

```json
{
  "clientRequestId": "31c0a162-f7ad-4219-b372-d67a04deb01f",
  "classId": "ac000001-0000-4000-8003-000000000001",
  "prompt": "สร้างใบงานบวกเศษส่วน ป.5 จำนวน 5 ข้อ"
}
```

HTTP 202 returns a run record. Reuse the client request ID when retrying a submission after a network failure. The server returns the original run for a matching payload and HTTP 409 if the same ID was used for different work. Include the classroom for tools that need scores or that save worksheets. The sandbox starts a fresh session after replacement. Business records remain in Postgres.

### Read progress as JSON

The classroom frontend requests `GET /api/runs/{runId}/events` with the school cookie and `Accept: application/cloudevents-batch+json`. The response is a [CloudEvents 1.0 JSON batch](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/formats/json-format.md). For example, a tool starting produces this batch:

```json
[
  {
    "specversion": "1.0",
    "id": "104",
    "source": "/api/runs/c1620cdd-1de5-4477-98c7-556d0d155169",
    "type": "work.crudex.run.tool",
    "data": {"type": "tool", "id": "call-1", "name": "save_assessment", "status": "started"}
  }
]
```

The envelope ID identifies the event. The ID inside a tool payload identifies the tool call. The six event kinds are `status`, `tool`, `delta`, `approval`, `done` and `error`. Render process steps from the payload and append `delta.text` to the answer. Each response contains up to 128 events in ascending ID order. Send the last consumed ID in `Last-Event-ID` to continue. A 200 response with `[]` means wait and poll again with the same cursor. HTTP 204 means the run has ended and all events have been read.

Newer turns include an optional `delta.messageId`. Group the text by message within the run. When a delta has `interim: true`, it contains an empty string and identifies an earlier message as a progress update. Remove that message from the answer, including on replay. Preserve text from older turns without IDs in arrival order. Clients that simply concatenate `delta.text` continue to work.

### Read progress as SSE

Open `GET /api/runs/{runId}/events` with the school cookie and `Accept: text/event-stream`. Each response carries up to 128 committed events, ordered by a numeric cursor. A response can end before the run finishes. Native EventSource reconnects using the advertised retry interval and the last event ID. With a fetch-based reader, retain each SSE `id`, reconnect on EOF with `Last-Event-ID`, and honor `retry`. Close on a JSON `done` or `error` event. Reconnecting after the terminal cursor returns HTTP 204. A memory proposal emits an `approval` event with `kind: "memory"` and a `proposalId`. A network interruption alone does not cancel a run.

```text
id: 104
data: {"type":"status","status":"running"}

id: 107
data: {"type":"delta","text":"กำลังเตรียมใบงาน"}

```

A tool event includes the call ID, name and status. A completed run ends with `done` and elapsed milliseconds. A failed, interrupted or cancelled run ends with `error` and its code. Read `GET /api/agents/{agentId}/history` for current run status and saved `worksheetIds`. `POST /api/runs/{runId}/cancel` fences subsequent results from that run; a provider request already in progress may consume usage.

Open the teacher copy at `GET /api/assessments/{id}`. Its `formUrl` is an application navigation path. Extract the play token to call `GET /api/play/{token}`. The quiz response contains student-safe questions and choices. A student assigned to that class posts `{"answers":{"q1":"<choice-id>"}}` to the same endpoint using the IDs it returned. Submit once for each student and worksheet. An identical retry returns the original grade; different answers after submission produce 409. The teacher’s `GET /api/classes/{id}/gradebook` returns the class roster, total earned and possible points across submissions, and worksheet links. Missing scores are null.

## Connect a teacher's Kahoot account

Show signed-in teachers a plain link on the application origin, such as `<a href="/api/integrations/kahoot/connect">เชื่อมบัญชี Kahoot</a>`. Open the link as a top-level navigation so the school session cookie goes with the request. After Kahoot sign-in, the browser returns to `/?kahoot=connected` or `/?kahoot=failed`.

- `GET /api/integrations/kahoot/status` returns `connected` and, when connected, `connectedAt` and `expiresAt` in Unix milliseconds.
- `POST /api/integrations/kahoot/disconnect` is a same-origin request that revokes the grant and returns the updated status.

Each teacher connects their own account for each school. The gateway stores the grant across sandbox restarts and keeps the OAuth tokens server-side. Only พี่เจ๋ง can use the integration to create a new draft from a set that passed `check_assessment` and to retrieve the Kahoot or its editor link.

## Other school workflows

| Workflow                    | Caller and contract                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Teacher memory              | List a run’s proposals, then explicitly approve a proposal using its ID. Approved memories can be listed and deleted by their owner. A model’s suggestion alone cannot authorize storage.                                                                                                                                                                    |
| Routines and family reports | An assigned teacher creates a daily class routine with a Bangkok-local hour and minute. The scheduler checks due work every five minutes. Pause or resume with `PATCH /routines/{id}`. `GET /reports` returns teacher-visible drafts; guardians can read sent reports only for their currently linked children. The school backend currently creates drafts. |
| Principal brief             | `GET /briefs/morning?date=YYYY-MM-DD` returns school-scoped class and student counts, submissions, weighted average percent and report count. The optional date selects the Bangkok day for submissions and reports. Classes and students reflect current membership. The average is null when there are no marks.                                           |
| Budget approvals            | The teacher submits an idempotent request with date, budget code, purpose, items, quantities and integer prices in satang. Teachers read their own claims, principals read school claims. Only a signed-in principal can approve or return a pending claim. A return requires a reason. Each decision produces one notification per channel.                 |
| Runtime tool callbacks      | Endpoints under `/internal/runs/{id}/tools/` require the credential of an active run attempt and enforce its scope. They are server-to-server operations. The browser uses the school routes above.                                                                                                                                                          |

All paths in this table are relative to `/api`. Times in JSON are ISO 8601 unless a field explicitly says milliseconds. Error responses use `{"error":{"code":"…","message":"…"}}` for application errors. Handle 400 for invalid input, 401 for a missing/expired session, 403 for insufficient permission, 404 for an unavailable resource, 409 for conflicting retries and 429 for exhausted run quota. After HTTP 202, execution failures arrive on the run stream. The legacy public notes and health routes are also listed in the specification.

[Run the API verification locally](../getting-started/local-development.md).
