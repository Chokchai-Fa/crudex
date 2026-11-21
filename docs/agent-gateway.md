# ต่อหน้าเว็บกับ crudex-agent

เดโมใช้ https://crudex-agent.crudex.workers.dev และข้อมูลโรงเรียนตัวอย่าง บัญชีเดโมใช้ passcode ร่วมกัน ตัวเลือกทีมครูหรือ ผอ. เป็นการเลือกหน้าของเดโม

| คำขอ | วิธีใช้ |
|---|---|
| POST /login | ส่ง form-urlencoded ฟิลด์ `passcode` เมื่อสำเร็จได้ 303 และ session cookie แบบ HttpOnly, Secure, SameSite=Strict |
| POST /logout | ล้าง cookie แล้วกลับหน้าเข้าใช้ |
| GET /api/agents | รายชื่อทีมครูเรียงน้องแจ๋วก่อน แต่ละรายการมี id, name และ description |
| GET /api/agents?role=principal | รายชื่อผู้ช่วยของ ผอ. |
| POST /api/chat | ส่ง JSON ที่มี agentId กับ text (1–4,000 ตัวอักษร) และ sessionId ถ้าคุยต่อกับคนเดิม สำหรับทีม ผอ. ใช้ /api/chat?role=principal |
| GET /api/status | สถานะ sandbox, runtimeRevision เมื่อมี sandbox, runsToday และ limit |
| GET /api/brief | อ่าน latest และ nextRunAt (Unix milliseconds) พร้อมตั้งรอบ 07:00 เวลาไทย |
| POST /api/brief/run | สร้างสรุปทันที ค่า latest มี text, generatedAt และ trigger |

ให้เว็บเรียกผ่าน origin เดียวกับ gateway หรือทำ reverse proxy ใน backend ของเว็บเพื่อน ส่ง cookie ของผู้ใช้แยกกัน และเก็บ passcode ฝั่ง server หากต้องใช้ อย่าใส่ passcode ใน JavaScript ที่เบราว์เซอร์ดาวน์โหลด

## อ่านแชตแบบสตรีม

ใช้ fetch แบบ POST แล้วอ่าน response.body เป็น UTF-8 เก็บเศษข้อมูลระหว่าง chunk แยกเฟรมด้วยบรรทัดว่าง แต่ละเฟรมขึ้นต้นด้วย `data: ` แล้วตามด้วย JSON

- `session` มี sessionId ให้เก็บตามผู้ช่วยที่เลือก
- `delta` มี text ให้ต่อท้ายข้อความ รวมผลที่น้องจ๋ำส่งกลับให้น้องแจ๋ว
- `tool` มี id, name และ status (started, success, failed)
- `done` มี elapsedMs ส่วน `error` มี code และจบรอบ

ถ้าได้ HTTP 401 ให้กลับหน้าเข้าใช้ 429 หมายถึงเต็มโควตารายวัน และ 503 หมายถึง sandbox ยังให้บริการไม่ได้ เปิดดูตัวอย่างการอ่าน stream ได้ใน apps/agent-gateway/public/index.html
