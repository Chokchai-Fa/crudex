// Exported from Paper: 10 สถานะร่วม + component — reference code, Tailwind v4 (React 19 + Vite). Data shown is sample data.
export default function StatesComponents() {
  return (
    <div className="[font-synthesis:none] wrap-anywhere flex overflow-clip w-360 h-fit flex-col p-12 gap-8 bg-white antialiased text-xs/4">
      <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#152238] text-[32px]/10">
        สถานะร่วมทุกหน้า + ปุ่ม/ป้าย
      </div>
      <div className="flex gap-6">
        <div className="flex flex-col items-center text-center grow basis-[0%] p-7 rounded-3xl gap-3 [border-width:1.5px] border-solid border-[#E3EAF6]">
          <div className="[align-self:start] inline-block text-center font-['Anuphan',system-ui,sans-serif] font-bold text-[#6B7A99] text-[13px]/4">
            ว่าง (empty)
          </div>
          <svg width="88" height="88" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', width: '64px', height: '64px', flexShrink: 0 }}>
            <path d="M8 20c0-8 7-13 16-13s16 5 16 13v14a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8z" fill="#18B87A" />
            <ellipse cx="18" cy="26" rx="5" ry="6" fill="#FFFFFF" />
            <ellipse cx="30" cy="26" rx="5" ry="6" fill="#FFFFFF" />
            <circle cx="18" cy="27.5" r="2.4" fill="#111114" />
            <circle cx="30" cy="27.5" r="2.4" fill="#111114" />
            <path d="M10 9l14-6 14 6-14 6z" fill="#111114" />
            <path d="M36 9v7" fill="#000000" stroke="#FFD25E" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="inline-block text-center font-['Anuphan',system-ui,sans-serif] font-bold text-[#152238] text-lg/5.5">
            ยังไม่มีคะแนนเข้ามา
          </div>
          <div className="inline-block text-center font-['Anuphan',system-ui,sans-serif] text-[#4A5675] text-[15px]/5.75">
            ส่งลิงก์ฟอร์มหรือควิซให้นักเรียน คะแนนจะขึ้นที่นี่เอง
          </div>
          <div className="inline-block py-2 px-4.5 rounded-[999px] bg-[#2F6BFF]">
            <div className="inline-block text-center font-['Anuphan',system-ui,sans-serif] font-bold text-white text-sm/4.5">
              ก๊อปลิงก์ให้นักเรียน
            </div>
          </div>
        </div>
        <div className="flex flex-col grow basis-[0%] p-7 rounded-3xl gap-3 [border-width:1.5px] border-solid border-[#E3EAF6]">
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#6B7A99] text-[13px]/4">
            กำลังโหลด (loading)
          </div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl shrink-0 bg-[#EEF2F8] size-10" />
            <div className="flex flex-col grow basis-[0%] gap-1.5">
              <div className="h-3 w-[round(60%,1px)] rounded-md shrink-0 bg-[#EEF2F8]" />
              <div className="h-2.5 w-[round(40%,1px)] rounded-[5px] shrink-0 bg-[#F2F5FB]" />
            </div>
          </div>
          <div className="h-16 rounded-[14px] shrink-0 bg-[#F2F5FB]" />
          <div className="h-3 w-[round(80%,1px)] rounded-md shrink-0 bg-[#EEF2F8]" />
          <div className="flex items-center gap-2">
            <div className="rounded-lg shrink-0 [border-top-width:3px] border-t-[#2F6BFF] [border-left-width:3px] [border-bottom-width:3px] border-b-[#C9D8FF] [border-right-width:3px] size-4 border-solid border-x-[#C9D8FF]" />
            <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-semibold text-[#2F6BFF] text-sm/4.5">
              น้องสมุดกำลังเปิดสมุด…
            </div>
          </div>
        </div>
        <div className="flex flex-col grow basis-[0%] p-7 rounded-3xl gap-3 bg-[#FFF8FA] [border-width:1.5px] border-solid border-[#FFC9D4]">
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#B4234A] text-[13px]/4">
            ผิดพลาด (error)
          </div>
          <div className="flex items-center justify-center rounded-[14px] shrink-0 bg-[#FFE1E8] size-11">
            <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="9" fill="none" stroke="#B4234A" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M12 7v6M12 16.5v.5" fill="none" stroke="#B4234A" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#152238] text-lg/5.5">
            ส่งอีเมลไม่สำเร็จ 1 บ้าน
          </div>
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] text-[#4A5675] text-[15px]/5.75">
            อีเมลของผู้ปกครองเลขที่ 14 ไม่ถูกต้อง ที่เหลือส่งครบแล้ว
          </div>
          <div className="flex gap-2">
            <div className="inline-block py-2 px-4 rounded-[999px] bg-[#152238]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-white text-sm/4.5">
                แก้อีเมล
              </div>
            </div>
            <div className="inline-block py-1.75 px-3.5 rounded-[999px] [border-width:1.5px] border-solid border-[#DCE4F2]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-semibold text-[#152238] text-sm/4.5">
                ลองใหม่
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-6">
        <div className="flex flex-col grow basis-[0%] gap-3">
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#6B7A99] text-[13px]/4">
            Button (แคปซูล) · default / hover / disabled / loading
          </div>
          <div className="flex items-center gap-2.5">
            <div className="inline-block py-2.5 px-5 rounded-[999px] bg-[#2F6BFF]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-white text-[15px]/4.5">
                ส่งเลย
              </div>
            </div>
            <div className="inline-block py-2.5 px-5 rounded-[999px] bg-[#1F56E0]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-white text-[15px]/4.5">
                ส่งเลย
              </div>
            </div>
            <div className="inline-block py-2.5 px-5 rounded-[999px] bg-[#DCE4F2]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#9AA7C2] text-[15px]/4.5">
                ส่งเลย
              </div>
            </div>
            <div className="opacity-80 flex items-center py-2.5 px-5 rounded-[999px] gap-2 bg-[#2F6BFF]">
              <div className="rounded-[7px] shrink-0 [border-top-width:2.5px] border-t-[#FFFFFF] [border-left-width:2.5px] [border-bottom-width:2.5px] border-b-[#FFFFFF66] [border-right-width:2.5px] size-3.5 border-solid border-x-[#FFFFFF66]" />
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-white text-[15px]/4.5">
                กำลังส่ง
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="inline-block py-2.25 px-4.5 rounded-[999px] [border-width:1.5px] border-solid border-[#DCE4F2]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-semibold text-[#152238] text-[15px]/4.5">
                รอง (secondary)
              </div>
            </div>
            <div className="inline-block py-2.5 px-4.5 rounded-[999px] bg-[#FFD43B]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#152238] text-[15px]/4.5">
                จำลอง (demo action)
              </div>
            </div>
            <div className="inline-block py-2.5 px-4.5 rounded-[999px] bg-[#152238]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-white text-[15px]/4.5">
                หลักบนพื้นขาวใหญ่
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col grow basis-[0%] gap-3">
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#6B7A99] text-[13px]/4">
            Badge · SampleBadge / SimulatedBadge / SourceBadge / FallbackBadge
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-block py-0.5 px-2.25 rounded-md bg-[#FFF8D6]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#8A6D00] text-xs/4">
                ข้อมูลตัวอย่าง
              </div>
            </div>
            <div className="inline-block py-0.5 px-2.25 rounded-md bg-[#FFD43B]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#152238] text-xs/4">
                จำลอง
              </div>
            </div>
            <div className="inline-block py-0.5 px-2.25 rounded-md bg-[#E3ECFF]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#2F6BFF] text-xs/4">
                Form
              </div>
            </div>
            <div className="inline-block py-0.5 px-2.25 rounded-md bg-[#FFF8D6]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#8A6D00] text-xs/4">
                ควิซสด
              </div>
            </div>
            <div className="inline-block py-0.5 px-2.25 rounded-md bg-[#FFF8D6] border border-solid border-[#FFD43B]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#C99A00] text-xs/4">
                ● โหมดสำรอง
              </div>
            </div>
            <div className="inline-block py-px px-1.75 rounded-md bg-[#2F6BFF]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-white text-[11px]/3.5">
                ใหม่
              </div>
            </div>
            <div className="inline-block py-px px-2 rounded-[10px] bg-[#FF5C8A]">
              <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-white text-xs/4">
                2
              </div>
            </div>
          </div>
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] text-[#6B7A99] text-[13px]/5">
            กติกา: ป้าย "ข้อมูลตัวอย่าง" ต้องเห็นทุกหน้า · ป้าย "จำลอง" บนทุกหน้าที่แทนระบบภายนอก (ควิซ ฟอร์มสำรอง)
          </div>
        </div>
      </div>
    </div>
  );
}
