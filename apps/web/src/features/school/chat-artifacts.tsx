import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSchoolWorksheet, useSchoolGradebook } from './api/school';
import { SchoolGradebook, Worksheet } from './classroom';

export function ChatArtifacts({
  id,
  membershipId,
  roomId,
  open,
  toggle,
}: {
  id: string;
  membershipId: string;
  roomId: string;
  open: boolean;
  toggle: () => void;
}) {
  const sheet = useSchoolWorksheet(membershipId, id);
  const grades = useSchoolGradebook(membershipId, roomId);
  const [copyMessage, setCopyMessage] = useState('');
  const [showGrades, setShowGrades] = useState(false);
  if (sheet.error) return <p role="alert">{sheet.error.message}</p>;
  if (!sheet.data) return <p role="status">กำลังอ่านใบงาน…</p>;
  const { title, questions, formUrl } = sheet.data;
  const token = formUrl.split('/').pop();
  const scored = grades.data?.students.filter((s) => s.score !== null).length;
  return (
    <div className="chat-artifacts space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <article className="output-card worksheet-output">
          <div className="mini-page">
            <b>{title}</b>
            <span>{questions[0]?.text}</span>
          </div>
          <h3>ใบงาน · {questions.length} ข้อ</h3>
          <Button variant="outline" aria-expanded={open} onClick={toggle}>
            {open ? 'ปิดใบงาน' : 'ตรวจใบงาน'}
          </Button>
        </article>
        <article className="output-card form-output">
          <div className="mini-page">
            <b>ฟอร์มนักเรียน</b>
            <span>{title}</span>
          </div>
          <h3>แบบฝึกของห้อง</h3>
          {token && (
            <>
              <Button asChild variant="outline">
                <Link to="/play/$token" params={{ token }}>
                  เปิดฟอร์ม
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(new URL(formUrl, location.origin).href);
                    setCopyMessage('คัดลอกลิงก์แล้ว');
                  } catch {
                    setCopyMessage('คัดลอกไม่ได้ กรุณาใช้เมนูคัดลอกลิงก์จากปุ่มเปิดฟอร์ม');
                  }
                }}
              >
                คัดลอกลิงก์
              </Button>
            </>
          )}
          {copyMessage && <p role="status">{copyMessage}</p>}
        </article>
        <article className="output-card quiz-output">
          <div className="mini-page">
            <b>สมุดคะแนนห้อง</b>
            <span>
              {grades.error
                ? 'อ่านคะแนนไม่สำเร็จ'
                : grades.data
                  ? 'มีคะแนน ' + scored + ' / ' + grades.data.students.length + ' คน'
                  : 'กำลังอ่านคะแนน…'}
            </span>
          </div>
          <h3>คะแนนรวมทุกใบงาน</h3>
          <Button
            variant="outline"
            aria-expanded={showGrades}
            onClick={() => setShowGrades((v) => !v)}
          >
            {showGrades ? 'ปิดคะแนน' : 'ดูรายชื่อ'}
          </Button>
        </article>
      </div>
      {open && <Worksheet membershipId={membershipId} id={id} />}
      {showGrades && <SchoolGradebook membershipId={membershipId} classId={roomId} />}
    </div>
  );
}
