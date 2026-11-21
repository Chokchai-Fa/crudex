export interface ClaimSnapshot {
  claimId: string;
  label: string;
  date: string;
  budgetCode: string;
  purpose: string;
  rows: { name: string; qty: number; unitPrice: number; amount: number }[];
  total: number;
  remainingAfter: number;
  overBudget: boolean;
}

export type ApprovalStatus = 'pending' | 'approved' | 'returned';

export interface ApprovalRecord {
  id: string;
  ownerId: string;
  submittedAt: number;
  note: string;
  claim: ClaimSnapshot;
  status: ApprovalStatus;
  reason?: string;
  decidedAt?: number;
}

export interface Notification {
  id: string;
  to: string;
  text: string;
  createdAt: number;
}

/** The one box the secretary of the principal reads and ป้าพร writes. In-process until the gateway persists it. */
export const approvals: ApprovalRecord[] = [];
export const notifications: Notification[] = [];

export function addApproval(ownerId: string, claim: ClaimSnapshot, note: string, now = Date.now()) {
  const record: ApprovalRecord = {
    id: 'approval-' + crypto.randomUUID().slice(0, 8),
    ownerId,
    submittedAt: now,
    note,
    claim,
    status: 'pending',
  };
  approvals.push(record);
  return record;
}

/** Problems the code can see in a claim; the secretary reports them and never decides. */
export function anomaliesOf(record: ApprovalRecord) {
  const found: { code: string; message: string }[] = [];
  const { claim } = record;
  if (claim.overBudget)
    found.push({
      code: 'over_budget',
      message: `ยอดเกินงบ ขาดอีก ${Math.abs(claim.remainingAfter)} บาท`,
    });
  if (!claim.date) found.push({ code: 'missing_date', message: 'เอกสารไม่มีวันที่' });
  if (!/พ\.ศ\.|25\d\d|26\d\d/.test(claim.date))
    found.push({ code: 'date_not_buddhist_era', message: 'วันที่ไม่ใช่ พ.ศ.' });
  if (claim.rows.length === 0) found.push({ code: 'no_items', message: 'เอกสารไม่มีรายการ' });
  if (!claim.purpose.trim())
    found.push({ code: 'missing_purpose', message: 'เอกสารไม่ระบุวัตถุประสงค์' });
  if (
    claim.rows.some(
      (row) => Math.round(row.qty * row.unitPrice * 100) !== Math.round(row.amount * 100),
    )
  ) {
    found.push({ code: 'amount_mismatch', message: 'ยอดในรายการไม่ตรงกับจำนวน x ราคา' });
  }
  return found;
}

export function resetApprovals() {
  approvals.length = 0;
  notifications.length = 0;
}
