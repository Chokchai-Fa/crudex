import { createFileRoute, Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/principal')({ component: PrincipalBrief });

function PrincipalBrief() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="สรุปเช้าสำหรับผู้บริหาร"
        description="ทั้งโรงเรียน · ข้อมูลตัวอย่าง"
        actions={
          <Button asChild variant="outline">
            <Link to="/">สลับบทบาท</Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-semibold">น้องรุ่งเช้า · 07:00 น.</h2>
          <ul className="list-disc space-y-3 ps-6 leading-relaxed">
            <li>เมื่อวานครู 12 คนสร้างสื่อการสอน 9 ชุด</li>
            <li>ป.5/2 ส่งแบบทดสอบเศษส่วนแล้ว 18 จาก 20 คน</li>
            <li>ป.6/1 ยังขาดงานคณิตศาสตร์ 6 คน ครูประจำชั้นรับทราบแล้ว</li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
