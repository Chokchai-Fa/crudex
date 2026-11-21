---
sidebar_label: Demo gateway
description: Connect to the passcode-protected sample agents, select a role and consume streamed chat events.
---

# Connect a frontend to the Crudex agent gateway

The demo uses sample school data and a shared passcode. Selecting the teacher or principal team switches the demo view. [Demo gateway](https://crudex-agent.crudex.workers.dev)

| Request                          | Usage                                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /login`                    | Send the `passcode` field as `application/x-www-form-urlencoded`. On success, the gateway returns a 303 redirect and sets a session cookie with `HttpOnly`, `Secure`, and `SameSite=Strict`.   |
| `POST /logout`                   | Clears the session cookie and redirects to the login page.                                                                                                                                     |
| `GET /api/agents`                | Lists the teacher team, with Jaew first. Each entry contains `id`, `name`, and `description`.                                                                                                  |
| `GET /api/agents?role=principal` | Lists the principal’s assistants.                                                                                                                                                              |
| `POST /api/chat`                 | Send JSON with `agentId` and `text` (1–4,000 characters). Include `sessionId` to continue a conversation with the same assistant. For the principal team, use `POST /api/chat?role=principal`. |
| `GET /api/status`                | Returns the sandbox status, `runsToday`, and `limit`. Includes `runtimeRevision` when a sandbox exists.                                                                                        |
| `GET /api/brief`                 | Returns `latest` and `nextRunAt` (milliseconds since the Unix epoch) and sets up the daily 07:00 Bangkok schedule.                                                                             |
| `POST /api/brief/run`            | Generates a brief immediately. The `latest` object contains `text`, `generatedAt`, and `trigger`.                                                                                              |
| `GET /kahoot/connect`            | Opens Kahoot sign-in. Use a plain link (top-level navigation, not `fetch`) so the gateway session cookie is sent. Redirects to `/login` without a session.                                     |
| `GET /kahoot/callback`           | Kahoot returns the user here. Shows a page saying whether the account was connected.                                                                                                           |
| `GET /api/kahoot/status`         | Returns `connected`, and when connected `connectedAt` and `expiresAt` (Unix ms). Never returns tokens.                                                                                         |
| `POST /api/kahoot/disconnect`    | Revokes and deletes the stored Kahoot tokens. Returns the new status.                                                                                                                          |

Call the gateway from the same origin or route requests through a reverse proxy in your frontend’s backend. Forward each user’s own session cookie. If the backend needs the passcode, keep it on the server and out of browser JavaScript.

## Connect a Kahoot account (button for พี่เจ๋ง)

Render `<a href="/kahoot/connect">เชื่อมบัญชี Kahoot</a>` for a signed-in user. After the user signs in at Kahoot, the gateway stores the OAuth tokens on the server only (a Durable Object), so they survive sandbox restarts and never reach the browser or the sandbox. Poll `GET /api/kahoot/status` to switch the button to “เชื่อมแล้ว”, and call `POST /api/kahoot/disconnect` for “ยกเลิกการเชื่อม”. The connected account is shared by the demo. Only พี่เจ๋ง can use it, and only to create a new draft from questions that passed `check_assessment` and to read its editor link. The connector is on only when the repository variable `KAHOOT_MCP_ENABLED` is `true` at deploy.

## Read the chat stream

Use `fetch` to send the POST request and decode `response.body` as a UTF-8 stream. A frame can span multiple chunks. Buffer partial frames until you reach a blank line, then parse the JSON after the frame’s `data: ` prefix.

| Event             | What the client should do                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session`         | Store `sessionId` for the selected assistant.                                                                                                             |
| `delta`           | Group chunks by `messageId` within the turn. Append `text` verbatim to that message.                                                                      |
| `progress`        | Render the completed message with this `messageId` as an interim status, such as a muted line. Messages that never receive `progress` make up the answer. |
| `principal_brief` | Display the validated morning brief in `text`. The `briefId` identifies the published result.                                                             |
| `tool`            | Track the tool call by `id` and `name`. Its `status` is `started`, `success`, or `failed`.                                                                |
| `done`            | Finish the turn. `elapsedMs` gives its duration in milliseconds.                                                                                          |
| `error`           | Finish the turn and read the error `code`.                                                                                                                |

Keep newline characters across SSE frames. Render the accumulated text as Markdown or with CSS `white-space: pre-wrap`. Clients that append every `delta.text` in stream order still receive the same text and paragraph breaks.

On HTTP 401, return to the login page. HTTP 429 means the daily quota has been reached. HTTP 503 means the sandbox is unavailable. [Example stream reader](https://github.com/Chokchai-Fa/crudex/blob/main/apps/agent-gateway/public/index.html)

## Demo accounts and session ownership

Each login receives a signed cookie with a new random login ID. To resume a chat, send the original cookie and choose the same assistant. The runtime checks ownership on the root OpenCode session. Work delegated by Jaew inherits its teacher account and classroom. Older sessions without ownership metadata start a fresh chat.

The shared passcode allows either demo role. Each teacher login sees the same sample classrooms and owns its own approved memories and budget claims. Grade 5/2 is the default classroom. When a teacher names another class, the runtime checks that class against the account’s teaching assignments. The principal uses a separate sample account for school summaries and activity budgets. Use the [school API](school-api.md) for individual accounts and real classroom assignments.

## Prepare a lesson with Jaew

Send `{"agentId":"jaew","text":"กำลังจะสอน ม.2/1 เตรียมสอนให้หน่อย"}` to `POST /api/chat`. Save the `sessionId` from the `session` event and group the streamed messages as described above. Jaew summarizes the classroom’s score history and memory before offering preparation tasks. If the classroom has no scores, display Jaew’s response directly.

After `done`, if Jaew offers the six choices, display the message or let the teacher select multiple options. Preserve the Thai labels from the reply. Jaew requests ten worksheet questions by default and passes an explicit question count through to Jum.

| Teacher’s choice        | Assigned assistant |
| ----------------------- | ------------------ |
| 1) สื่อการสอน/สไลด์     | Jeng               |
| 2) ใบงาน/การบ้าน        | Jum                |
| 3) แบบทดสอบ Google Form | Jum                |
| 4) เกม Kahoot           | Jeng               |
| 5) กิจกรรมในคาบ         | Jeng               |
| 6) ข้อสอบ               | Jum                |

Send all selected items in one message to Jaew using the original cookie and session. The teacher can also type a free-form response.

```json
{
  "agentId": "jaew",
  "sessionId": "<sessionId from the first response>",
  "text": "ขอใบงาน/การบ้าน กับกิจกรรมในคาบ สำหรับ ม.2/1"
}
```
