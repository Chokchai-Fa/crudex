import { sampleOwner } from './sample';

/** The one sample claim (ตัวอย่าง) ป้าพร has already sent, so the principal's box is never empty in a demo. */
export const sampleClaimId = 'approval-sample-1';

export function sampleClaim(now: number, thaiDate: string) {
  const rows = [
    { name: 'วงเวียนสำหรับนักเรียน', qty: 10, unitPrice: 45, amount: 450 },
    { name: 'ไม้บรรทัดเหล็ก 30 ซม.', qty: 20, unitPrice: 15, amount: 300 },
  ];
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return {
    id: sampleClaimId,
    ownerId: sampleOwner,
    submittedAt: now,
    note: 'ตัวอย่าง: ส่งโดยป้าพร',
    status: 'pending' as const,
    claim: {
      claimId: 'claim-sample-1',
      label: 'ตัวอย่าง: เบิกอุปกรณ์สอนเรื่องทฤษฎีบทพีทาโกรัส ม.2/1',
      date: thaiDate,
      budgetCode: 'M-02',
      purpose: 'อุปกรณ์สร้างรูปสามเหลี่ยมมุมฉากสำหรับคาบทฤษฎีบทพีทาโกรัส ม.2/1',
      rows,
      total,
      // budgetSheet M-02: งบ 9,000 ใช้ไป 3,100
      remainingAfter: 9000 - 3100 - total,
      overBudget: false,
    },
  };
}
