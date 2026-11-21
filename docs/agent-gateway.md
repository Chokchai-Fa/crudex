# Agent gateway integration

See the [frontend integration guide](site/docs/integrations/demo-gateway.md) for endpoints, chat events and lesson selection. Append streamed text verbatim so paragraph breaks between progress updates and classroom summaries survive rendering.

## เชื่อมบัญชี Kahoot (สำหรับปุ่มบนหน้าเว็บ)

- ปุ่มเป็นลิงก์ธรรมดา `<a href="/kahoot/connect">เชื่อมบัญชี Kahoot</a>` (ห้ามใช้ `fetch`) ผู้ใช้ต้องล็อกอิน gateway ก่อน
- ลงชื่อเข้าใช้ Kahoot เสร็จ ระบบพากลับมาที่ `/kahoot/callback` แสดงผลว่าเชื่อมสำเร็จหรือไม่
- `GET /api/kahoot/status` คืน `connected` และ `connectedAt`, `expiresAt` (Unix ms) ไม่คืน token
- `POST /api/kahoot/disconnect` ยกเลิกการเชื่อมและลบ token
- token เก็บฝั่ง gateway เท่านั้น ไม่หายเมื่อ sandbox เริ่มใหม่ เฉพาะพี่เจ๋งใช้ได้ และสร้างได้แค่ draft ใหม่จากชุดที่ผ่าน `check_assessment` กับอ่านลิงก์ editor
- เปิดใช้เมื่อตั้งตัวแปร repository `KAHOOT_MCP_ENABLED=true` ตอน deploy
