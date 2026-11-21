# Connect a frontend to the Crudex agent gateway

The demo uses sample school data and a shared passcode. Selecting the teacher or principal team switches the demo view. [Demo gateway](https://crudex-agent.crudex.workers.dev)

| Request | Usage |
| --- | --- |
| `POST /login` | Send the `passcode` field as `application/x-www-form-urlencoded`. On success, the gateway returns a 303 redirect and sets a session cookie with `HttpOnly`, `Secure`, and `SameSite=Strict`. |
| `POST /logout` | Clears the session cookie and redirects to the login page. |
| `GET /api/agents` | Lists the teacher team, with Jaew first. Each entry contains `id`, `name`, and `description`. |
| `GET /api/agents?role=principal` | Lists the principal’s assistants. |
| `POST /api/chat` | Send JSON with `agentId` and `text` (1–4,000 characters). Include `sessionId` to continue a conversation with the same assistant. For the principal team, use `POST /api/chat?role=principal`. |
| `GET /api/status` | Returns the sandbox status, `runsToday`, and `limit`. Includes `runtimeRevision` when a sandbox exists. |
| `GET /api/brief` | Returns `latest` and `nextRunAt` (milliseconds since the Unix epoch) and sets up the daily 07:00 Bangkok schedule. |
| `POST /api/brief/run` | Generates a brief immediately. The `latest` object contains `text`, `generatedAt`, and `trigger`. |

Call the gateway from the same origin or route requests through a reverse proxy in your frontend’s backend. Forward each user’s own session cookie. If the backend needs the passcode, keep it on the server and out of browser JavaScript.

## Read the chat stream

Use `fetch` to send the POST request and decode `response.body` as a UTF-8 stream. A frame can span multiple chunks. Buffer partial frames until you reach a blank line, then parse the JSON after the frame’s `data: ` prefix.

| Event | What the client should do |
| --- | --- |
| `session` | Store `sessionId` for the selected assistant. |
| `delta` | Append `text` to the current message. This includes results Jum sends back to Jaew. |
| `principal_brief` | Display the validated morning brief in `text`. The `briefId` identifies the published result. |
| `tool` | Track the tool call by `id` and `name`. Its `status` is `started`, `success`, or `failed`. |
| `done` | Finish the turn. `elapsedMs` gives its duration in milliseconds. |
| `error` | Finish the turn and read the error `code`. |

On HTTP 401, return to the login page. HTTP 429 means the daily quota has been reached. HTTP 503 means the sandbox is unavailable. [Example stream reader](../apps/agent-gateway/public/index.html)
