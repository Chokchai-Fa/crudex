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

## บัญชีและขอบเขตแชตของเดโม

เมื่อล็อกอิน gateway ออก cookie ที่มีรหัสสุ่มลงนามเฉพาะการล็อกอินครั้งนั้น Runtime ตรวจเจ้าของจาก session หลักของ OpenCode งานที่น้องแจ๋วส่งต่อใช้บัญชีและห้องเดียวกับน้องแจ๋ว การส่ง sessionId เพื่อคุยต่อต้องใช้ cookie เดิมและเลือกผู้ช่วยคนเดิม แชตจากรุ่นก่อนที่ยังไม่มีเจ้าของจะเริ่ม session ใหม่

ผู้ใช้ passcode เดียวกันยังเลือกบทบาทเดโมได้ทั้งสองบทบาท ครูใช้บัญชีตัวอย่างเดียวกันทุกการล็อกอิน จึงใช้ความจำและใบเบิกของบัญชีครูร่วมกัน ห้องเริ่มต้นคือ ป.5/2 เมื่อครูระบุห้อง ระบบตรวจห้องกับรายการที่บัญชีครูสอน ผอ. ใช้บัญชีเดโมอีกบัญชีหนึ่งที่เห็นสรุประดับโรงเรียนและงบกิจกรรม สำหรับการใช้งานรายคนต้องผูกผู้ใช้จริงและสิทธิ์ครูต่อห้องจากระบบบัญชีของโรงเรียน

## ให้ครูเลือกงานเตรียมสอน

ส่ง `{"agentId":"jaew","text":"กำลังจะสอน ม.2/1 เตรียมสอนให้หน่อย"}` ไปที่ `POST /api/chat` เก็บ `sessionId` จาก event `session` แล้วแสดงข้อความจาก `delta` ตามลำดับ ครูจะได้อ่านสรุปคะแนนและความจำของห้องก่อนเลือกงาน ถ้าห้องยังไม่มีคะแนน ให้แสดงคำตอบที่น้องแจ๋วส่งมาโดยตรง

เมื่อได้รับ `done` และข้อความของน้องแจ๋วชวนให้เลือกงานทั้งหกอย่าง หน้าเว็บจะแสดงเป็นข้อความหรือปุ่มเลือกได้หลายข้อก็ได้

| ตัวเลือก | ผู้รับงาน |
| --- | --- |
| 1) สื่อการสอน/สไลด์ | พี่เจ๋ง |
| 2) ใบงาน/การบ้าน | น้องจ๋ำ |
| 3) แบบทดสอบ Google Form | น้องจ๋ำ |
| 4) เกม Kahoot | พี่เจ๋ง |
| 5) กิจกรรมในคาบ | พี่เจ๋ง |
| 6) ข้อสอบ | น้องจ๋ำ |

ให้ครูเลือกได้หลายปุ่มและกดส่งครั้งเดียว ส่งชื่อรายการที่เลือกเป็นข้อความถึงน้องแจ๋วในแชตเดิม ตัวอย่างเมื่อเลือกสองงาน

```json
{
  "agentId": "jaew",
  "sessionId": "<sessionId from the first response>",
  "text": "ขอใบงาน/การบ้าน กับกิจกรรมในคาบ สำหรับ ม.2/1"
}
```

ใช้ cookie เดิมทั้งสองคำขอ ครูพิมพ์คำตอบเองได้เช่นกัน
