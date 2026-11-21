# Paper export — crudex · ขึ้นเว็บ (21 พ.ย. 2026)

ดึงจาก Paper: [agent-school-bot · agent = แชตกับคน 1 คน → หน้า crudex · ขึ้นเว็บ](https://app.paper.design/file/01M7VK2CB1YZZR7WPWTXFANMH5/p-2-0)
ข้อมูล ชื่อ และตัวเลขในทุกจอเป็น **ข้อมูลตัวอย่าง**

## มีอะไรบ้าง

| โฟลเดอร์ | เนื้อหา |
|---|---|
| `screens/*.tsx` | JSX จาก Paper แบบ Tailwind v4 จอละไฟล์ (`export default function …`) ใช้เป็นต้นแบบโครงและค่าสไตล์ ยังไม่แตก component / ยังไม่ผูก API |
| `png/*.png` | ภาพจอเต็มสำหรับเทียบ (1x, โลโก้และ landing มือถือ 2x) |
| `assets/mascots/*.svg` | มาสคอต 5 ตัว + โลโก้ crudex แยกไฟล์ |
| `assets/images/` | รูปที่ฝังในดีไซน์ (ภาพหน้าจอใน landing ฯลฯ) |

Tokens สี/ฟอนต์อยู่ที่ `tokens.css` ในโฟลเดอร์นี้ (map เข้า `@theme` ของ Tailwind v4 ได้)

## จอ ↔ ไฟล์ ↔ route

| จอ | ไฟล์ | route ตาม frontend-plan |
|---|---|---|
| Brand · โลโก้ | `brand-logo.tsx` | — |
| 00 Landing จอคอม / 00m มือถือ | `00-landing.tsx`, `00m-landing-mobile.tsx` | `/` |
| 01a/01b/01c แชตเลขาครู (เสร็จ/กำลังสร้าง/โหมดสำรอง) | `01a-chat-done.tsx`, `01b-chat-streaming.tsx`, `01c-chat-fallback.tsx` | `/agents/$agentId` |
| 02 ใบงาน A4 | `02-worksheet-a4.tsx` | `/worksheets/$id` |
| 03 สมุดคะแนน | `03-gradebook.tsx` | `/gradebook` |
| 04 ควิซนักเรียน (มือถือ) | `04-quiz-student-mobile.tsx` | `/play/$playToken` |
| 05 Form สำรอง + 07 อีเมลผู้ปกครอง | `05-07-form-fallback-parent-email.tsx` | `/play/$playToken`, `/inbox` |
| 06 งานตั้งเวลา | `06-routines.tsx` | `/schedules` |
| 08 เลือกบทบาท | `08-role-select.tsx` | `/demo` |
| 09 ผอ. สรุปเช้า (P1) | `09-principal-brief.tsx` | `/brief` |
| 10 สถานะร่วม + component | `10-states-components.tsx` | (ว่าง/โหลด/ผิดพลาด ใช้ร่วม) |
| M แอปมือถือ 6 จอ | `11-app-mobile.tsx` | ทุก route ที่ 390px |

## วิธีใช้ในแอป

1. ติดฟอนต์: `@fontsource/anuphan`, `@fontsource/sarabun` (ใบงาน), `@fontsource/fredoka` (wordmark เท่านั้น)
2. คัดลอก `assets/images/*` ไป `apps/web/public/paper-assets/` (ในโค้ดอ้าง `/paper-assets/<ไฟล์>`)
3. คัดลอกจอที่ต้องการเข้า `src/` แล้วแตกเป็น component, แทนค่าสี hex ด้วย token และแทนข้อความตัวอย่างด้วยข้อมูลจาก API
4. ค่า `w-300`, `h-215` ฯลฯ เป็นขนาด artboard คงที่ ต้องปรับเป็น responsive เอง
