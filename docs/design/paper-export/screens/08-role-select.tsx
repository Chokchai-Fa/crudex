// Exported from Paper: 08 เข้าใช้ · เลือกบทบาท — reference code, Tailwind v4 (React 19 + Vite). Data shown is sample data.
export default function RoleSelect() {
  return (
    <div className="[font-synthesis:none] wrap-anywhere flex overflow-clip items-center flex-col justify-center gap-8 bg-[#F6F9FF] antialiased text-xs/4">
      <div className="flex items-center gap-2">
        <svg width="46" height="46" viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', flexShrink: 0 }}>
          <path d="M35 4c4 3 7 1 10 4s1 6 5 8 6 2 7 6-2 6 0 9 4 5 2 9-5 3-6 7-1 7-5 8-6-2-9 1-4 5-8 5-5-4-9-4-6 3-9 0-1-6-4-8-6-2-7-6 3-6 1-9-4-5-2-9 5-3 6-7 0-7 4-9 6 1 9-1 3-6 7-6 5 4 8 3z" fill="#2F6BFF" />
          <ellipse cx="27" cy="34" rx="7" ry="8.5" fill="#FFFFFF" />
          <ellipse cx="44" cy="34" rx="7" ry="8.5" fill="#FFFFFF" />
          <circle cx="28.5" cy="36" r="3.8" fill="#152238" />
          <circle cx="45.5" cy="36" r="3.8" fill="#152238" />
        </svg>
        <div className="inline-block tracking-[-0.02em] font-['Fredoka',system-ui,sans-serif] font-bold text-[#152238] text-[52px]/14.5">
          crudex
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#152238] text-[32px]/10">
          เข้าใช้ในฐานะ
        </div>
        <div className="inline-block font-['Anuphan',system-ui,sans-serif] text-[#4A5675] text-[17px]/5.5">
          เดโมใช้บัญชีตัวอย่าง ไม่ต้องใส่รหัสผ่าน
        </div>
      </div>
      <div className="flex gap-6">
        <div className="w-85 flex flex-col p-7 rounded-[28px] gap-3.5 shrink-0 [box-shadow:#2F6BFF26_0px_10px_30px] bg-white border-2 border-solid border-[#2F6BFF]">
          <svg width="88" height="88" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', width: '72px', height: '72px', flexShrink: 0 }}>
            <rect x="6" y="8" width="36" height="34" rx="12" fill="#7C4DFF" />
            <ellipse cx="18" cy="23" rx="5.5" ry="6.5" fill="#FFFFFF" />
            <ellipse cx="30" cy="23" rx="5.5" ry="6.5" fill="#FFFFFF" />
            <circle cx="19.5" cy="24" r="2.6" fill="#111114" />
            <circle cx="31.5" cy="24" r="2.6" fill="#111114" />
            <path d="M18 36l6-3 6 3-6 3z" fill="#FFD25E" />
            <path d="M14 8l4-5 4 5" fill="#7C4DFF" />
          </svg>
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#152238] text-2xl/7.5">
            ครู
          </div>
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] text-[#4A5675] text-base/6.25">
            คุยกับเลขาครู ทำสื่อ เก็บคะแนน ส่งรายงานผู้ปกครอง
          </div>
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] text-[#6B7A99] text-sm/4.5">
            ครูตัวอย่าง · ป.5/1, ป.5/2, ป.6/1
          </div>
          <div className="text-center inline-block py-3 rounded-[999px] bg-[#2F6BFF]">
            <div className="inline-block text-center font-['Anuphan',system-ui,sans-serif] font-bold text-white text-[17px]/5.5">
              เข้าใช้เป็นครู
            </div>
          </div>
        </div>
        <div className="w-85 flex flex-col p-7 rounded-[28px] gap-3.5 shrink-0 bg-white [border-width:1.5px] border-solid border-[#E3EAF6]">
          <svg width="88" height="88" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', width: '72px', height: '72px', flexShrink: 0 }}>
            <circle cx="24" cy="27" r="15" fill="#FFB020" />
            <path d="M24 3v6M8 11l4 4M40 11l-4 4M3 25h5M40 25h5" fill="#000000" stroke="#FFB020" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="18.5" cy="27" rx="4.5" ry="5.5" fill="#FFFFFF" />
            <ellipse cx="29.5" cy="27" rx="4.5" ry="5.5" fill="#FFFFFF" />
            <circle cx="18.5" cy="25.5" r="2.2" fill="#111114" />
            <circle cx="29.5" cy="25.5" r="2.2" fill="#111114" />
          </svg>
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] font-bold text-[#152238] text-2xl/7.5">
            ผู้อำนวยการ
          </div>
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] text-[#4A5675] text-base/6.25">
            รับสรุปเช้าจากน้องรุ่งเช้า เห็นภาพรวมระดับห้อง ไม่เห็นคะแนนรายคน
          </div>
          <div className="inline-block font-['Anuphan',system-ui,sans-serif] text-[#6B7A99] text-sm/4.5">
            ผอ. ตัวอย่าง · ทั้งโรงเรียน
          </div>
          <div className="text-center inline-block py-2.75 rounded-[999px] [border-width:1.5px] border-solid border-[#DCE4F2]">
            <div className="inline-block text-center font-['Anuphan',system-ui,sans-serif] font-bold text-[#152238] text-[17px]/5.5">
              เข้าใช้เป็น ผอ.
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="inline-block font-['Anuphan',system-ui,sans-serif] text-[#6B7A99] text-sm/4.5">
          ผู้ปกครองไม่ต้องเข้าเว็บ · ได้รายงานทางอีเมล
        </div>
        <div className="inline-block font-['Anuphan',system-ui,sans-serif] text-[#DCE4F2] text-sm/4.5">
          |
        </div>
        <div className="content-center font-['Anuphan',system-ui,sans-serif] font-bold text-[#2F6BFF] text-sm/4.5">
          รีเซ็ตข้อมูลตัวอย่าง
        </div>
      </div>
    </div>
  );
}
