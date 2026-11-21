import { createFileRoute, Link } from '@tanstack/react-router';
import { BookOpen, School } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/')({ component: RoleChooser });

function RoleChooser() {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="เข้าใช้ในฐานะ"
        description="เดโมใช้บัญชีตัวอย่าง เลือกบทบาทเพื่อเริ่มงาน"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <BookOpen aria-hidden="true" />
            <h2 className="text-xl font-semibold">ครูผู้สอน</h2>
            <p className="text-muted-foreground">เตรียมคำสั่งทำใบงานแยกตามห้องเรียน</p>
            <Button asChild>
              <Link to="/teacher">เข้าใช้เป็นครู</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4">
            <School aria-hidden="true" />
            <h2 className="text-xl font-semibold">ผู้บริหาร</h2>
            <p className="text-muted-foreground">อ่านสรุปเช้าและติดตามภาพรวมระดับห้อง</p>
            <Button asChild variant="outline">
              <Link to="/principal">อ่านสรุปผู้บริหาร</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
