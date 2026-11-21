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
  googleFormUrl,
}: {
  id: string;
  membershipId: string;
  roomId: string;
  open: boolean;
  toggle: () => void;
  /** Google Form link from the agent's reply; preferred over the in-app /play page. */
  googleFormUrl?: string;
}) {
  const sheet = useSchoolWorksheet(membershipId, id);
  const grades = useSchoolGradebook(membershipId, roomId);
  const [copyMessage, setCopyMessage] = useState('');
  const [showGrades, setShowGrades] = useState(false);
  if (sheet.error) return <p role="alert">{sheet.error.message}</p>;
  if (!sheet.data) return <p role="status">กำลังอ่านใบงาน…</p>;
  const { title, questions, formUrl } = sheet.data;
  const token = formUrl.split('/').pop();
  // The API adds these once Google Form links are stored; older worksheets fall back to /play.
  const stored = sheet.data as { googleFormUrl?: string; googleFormReason?: string };
  const googleForm = googleFormUrl ?? stored.googleFormUrl;
  const formReason = stored.googleFormReason;
  const scored = grades.data?.students.filter((s) => s.score !== null).length;
  return (
    <div className="m-done chat-artifacts space-y-3">
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
          {googleForm ? (
            <>
              <Button asChild variant="outline">
                <a href={googleForm} target="_blank" rel="noreferrer">
                  เปิดฟอร์ม
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(googleForm);
                    setCopyMessage('คัดลอกลิงก์ Google Form แล้ว');
                  } catch {
                    setCopyMessage('คัดลอกไม่ได้ กรุณาเปิดฟอร์มแล้วคัดลอกลิงก์จากแถบที่อยู่');
                  }
                }}
              >
                คัดลอกลิงก์
              </Button>
              {token && (
                <Link className="form-fallback" to="/play/$token" params={{ token }}>
                  เปิดแบบฝึกในระบบ
                </Link>
              )}
            </>
          ) : (
            token && (
              <>
                <p className="form-fallback">
                  {formReason
                    ? 'สร้าง Google Form ไม่สำเร็จ (' + formReason + ') ใช้แบบฝึกในระบบแทน'
                    : 'ยังไม่มีลิงก์ Google Form ในคำตอบนี้ ใช้แบบฝึกในระบบแทน'}
                </p>
                <Button asChild variant="outline">
                  <Link to="/play/$token" params={{ token }}>
                    เปิดแบบฝึกในระบบ
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(new URL(formUrl, location.origin).href);
                      setCopyMessage('คัดลอกลิงก์แล้ว');
                    } catch {
                      setCopyMessage('คัดลอกไม่ได้ กรุณาใช้เมนูคัดลอกลิงก์จากปุ่มเปิดแบบฝึก');
                    }
                  }}
                >
                  คัดลอกลิงก์
                </Button>
              </>
            )
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
