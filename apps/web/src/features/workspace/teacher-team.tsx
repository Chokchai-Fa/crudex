import { BrandLogo } from '@/components/brand-logo';
import { Link } from '@tanstack/react-router';
import { Brain, Mail, Star } from 'lucide-react';
import { rooms, exercises, answerChoices } from './fraction-set';
import { signOutDemo } from './demo-session';

export function TeamIcon({
  name,
  size = 40,
}: {
  name: 'secretary' | 'paper' | 'notebook' | 'envelope';
  size?: number;
}) {
  return (
    <img src={'/team/' + name + '.svg'} width={size} height={size} className="shrink-0" alt="" />
  );
}

export function TeacherTeam({
  room,
  changeRoom,
  submitted,
  hasSet,
  working,
}: {
  room: string;
  changeRoom: (room: string) => void;
  submitted: number;
  hasSet: boolean;
  working: boolean;
}) {
  return (
    <nav aria-label="พื้นที่ครู" className="team-nav">
      <Link to="/sign-in" aria-label="Crudex · เลือกบทบาท">
        <BrandLogo
          width="146"
          height="32"
          className="h-8 w-auto dark:rounded dark:bg-white"
          alt="Crudex"
        />
      </Link>
      <fieldset>
        <legend>ห้องเรียน</legend>
        <div className="flex flex-wrap gap-1">
          {rooms.map((r) => (
            <button
              className="room-pill"
              key={r}
              aria-pressed={r === room}
              onClick={() => changeRoom(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="team-list">
        <div className="team-row current">
          <TeamIcon name="secretary" />
          <div>
            <strong>เลขาครู</strong>
            <small>
              {working
                ? 'กำลังเตรียมคำตอบ…'
                : hasSet
                  ? 'เตรียมชุดใบงานให้ครูแล้ว'
                  : 'พร้อมช่วยงานในห้องนี้'}
            </small>
          </div>
        </div>
        <div className="team-row">
          <TeamIcon name="paper" />
          <div>
            <strong>น้องกระดาษ</strong>
            <small>{hasSet ? 'ใบงาน ฟอร์ม และควิซของห้องนี้' : 'ผู้ช่วยทำสื่อการสอน'}</small>
          </div>
        </div>
        <Link className="team-row" to="/gradebook" search={{ room }}>
          <TeamIcon name="notebook" />
          <div>
            <strong>น้องสมุด</strong>
            <small>{submitted ? 'ส่งงานแล้ว ' + submitted + ' คน' : 'สมุดคะแนนของห้องนี้'}</small>
          </div>
        </Link>
        <Link className="team-row" to="/reports" search={{ room }}>
          <TeamIcon name="envelope" />
          <div>
            <strong>น้องซองจดหมาย</strong>
            <small>ตรวจร่างรายงานผู้ปกครอง</small>
          </div>
        </Link>
      </div>
      <div className="account-panel">
        <p>บัญชีครู · ใช้ข้อมูลตัวอย่างทั้งหมด</p>
        <Link to="/sign-in">สลับบทบาท</Link>
        <button onClick={signOutDemo}>ออกจากระบบ</button>
        <Link className="lg:hidden" to="/memory" search={{ room }}>
          ความจำห้อง
        </Link>
      </div>
    </nav>
  );
}

export function TeamStatus({
  room,
  hasSet,
  working,
  failed,
  step,
}: {
  room: string;
  hasSet: boolean;
  working: boolean;
  failed: boolean;
  step: number;
}) {
  const index = Math.max(0, Math.min(step, exercises.length - 1));
  const [question, answer] = exercises[index] ?? exercises[0];
  const format = sessionStorage.getItem('crudex.demo.memory.format.' + room);
  return (
    <aside className="team-status hidden overflow-y-auto border-s bg-card lg:block print:hidden">
      <h2>ตอนนี้ทีมกำลังทำอะไรอยู่</h2>
      <section className="status-job">
        <div className="flex items-center gap-2">
          <TeamIcon name={working ? 'secretary' : 'paper'} size={42} />
          <div>
            <strong>{working ? 'เลขาครู' : 'น้องกระดาษ'}</strong>
            <p>
              {working
                ? 'กำลังเตรียมคำตอบ…'
                : hasSet
                  ? step < 0
                    ? 'ควิซพร้อมเริ่ม · 10 ข้อ'
                    : step === exercises.length
                      ? 'จบควิซแล้ว'
                      : 'เปิดควิซข้อ ' + (step + 1) + '/' + exercises.length
                  : 'รอคำขอจากครู'}
            </p>
          </div>
        </div>
        {hasSet && (
          <>
            <div className="quiz-preview">
              <small>{step < 0 ? 'โจทย์แรกของควิซ' : 'ควิซ · ข้อ ' + (index + 1)}</small>
              <b>{question} = ?</b>
              <div className="preview-choices">
                {answerChoices(answer, index, 4).map((v) => (
                  <span key={v}>{v}</span>
                ))}
              </div>
            </div>
            {failed && <p role="status">ฟอร์มยังไม่พร้อม · ลองใหม่ที่การ์ดฟอร์ม</p>}
          </>
        )}
      </section>
      <h2>งานผู้ปกครอง</h2>
      <Link className="status-report" to="/reports" search={{ room }}>
        <Mail size={20} />
        <div>
          <strong>รายงานของห้อง {room}</strong>
          <small>ตรวจผู้รับและร่างก่อนส่งจำลอง</small>
        </div>
        <span>ดูก่อน</span>
      </Link>
      <h2>เลขาจำไว้</h2>
      <div className="status-memory">
        <p>
          <Brain size={20} />
          ห้อง {room}
          {hasSet ? ' · ใบงานเศษส่วน' : ''}
        </p>
        <p>
          <Star size={20} />
          {format || 'ยังไม่ได้บันทึกความชอบ'}
        </p>
        <Link to="/memory" search={{ room }}>
          ดู/แก้สิ่งที่จำ →
        </Link>
      </div>
    </aside>
  );
}
