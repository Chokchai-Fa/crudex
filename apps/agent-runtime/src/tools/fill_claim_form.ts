import { z } from 'zod';
import { budgetSheet } from '../data/sample';
import { ownerOf, ToolError } from './identity';
import { nonBlank, validatedTool } from './validated';

const buddhistDate = (date: Date) =>
  new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    dateStyle: 'long',
    timeZone: 'Asia/Bangkok',
  }).format(date);

const claimInput = z.strictObject({
  budgetCode: nonBlank,
  purpose: nonBlank,
  items: z
    .array(
      z.strictObject({
        name: nonBlank,
        qty: z.number().positive(),
        unitPrice: z.number().nonnegative(),
      }),
    )
    .min(1),
});

// Interpret each JSON number as a decimal before multiplying, including exponent notation.
function decimalParts(value: number) {
  const [mantissa = '', exponent = '0'] = String(value).split('e');
  const [whole = '', fraction = ''] = mantissa.split('.');
  return { digits: BigInt(whole + fraction), scale: Number(exponent) - fraction.length };
}

function lineSatang(qty: number, unitPrice: number): bigint {
  const quantity = decimalParts(qty);
  const price = decimalParts(unitPrice);
  const digits = quantity.digits * price.digits;
  const scale = quantity.scale + price.scale + 2;
  if (scale >= 0) return digits * 10n ** BigInt(scale);
  const divisor = 10n ** BigInt(-scale);
  return (digits + divisor / 2n) / divisor;
}

function baht(satang: bigint): number {
  const amount = Number(satang) / 100;
  if (
    !Number.isSafeInteger(Number(satang)) ||
    lineSatang(1, Math.abs(amount)) !== (satang < 0n ? -satang : satang)
  ) {
    throw new ToolError('invalid_amount', 'ยอดเงินเกินช่วงที่แสดงได้อย่างแม่นยำถึงสตางค์');
  }
  return amount;
}

function buildClaim({ budgetCode, purpose, items }: z.infer<typeof claimInput>) {
  const line = budgetSheet.lines.find((line) => line.code === budgetCode);
  if (!line) throw new ToolError('unknown_budget_code', `ไม่พบรหัสงบ ${budgetCode} ในชีตตัวอย่าง`);

  let totalSatang = 0n;
  const rows = items.map((item) => {
    const amount = lineSatang(item.qty, item.unitPrice);
    totalSatang += amount;
    return { ...item, amount: baht(amount) };
  });
  const remainingSatang = BigInt(line.budget - line.spent) * 100n - totalSatang;
  return {
    mode: 'mock',
    label: 'ตัวอย่าง — ยังไม่ใช่แบบฟอร์มของโรงเรียน',
    claimId: 'claim-' + crypto.randomUUID(),
    date: buddhistDate(new Date()),
    budgetCode,
    purpose,
    rows,
    total: baht(totalSatang),
    remainingAfter: baht(remainingSatang),
    overBudget: remainingSatang < 0n,
    signature: null,
  } as const;
}

export type Claim = ReturnType<typeof buildClaim>;
const claims = new Map<string, { claim: Claim; ownerKey: string; approvalId?: string }>();

export function getApprovalClaim(claimId: string, ownerKey: string) {
  const stored = claims.get(claimId);
  if (!stored || stored.ownerKey !== ownerKey)
    throw new ToolError('claim_not_found', 'ไม่พบแบบฟอร์มเบิกของครู');
  if (stored.claim.overBudget)
    throw new ToolError('over_budget', 'ยอดเบิกเกินงบคงเหลือ จึงส่งอนุมัติไม่ได้');
  return stored;
}

export const fillClaimForm = validatedTool(claimInput, {
  name: 'fill_claim_form',
  description:
    'กรอกแบบฟอร์มเบิกตัวอย่าง (ยังไม่ใช่แบบของโรงเรียน) จากรายการที่ระบุ ยอดรวมและงบคงเหลือคำนวณโดยระบบ วันที่เป็น พ.ศ. ลายเซ็นเว้นว่าง',
  gate: 'allow',
  execute: (input, context) => {
    const ownerKey = ownerOf(context).key;
    const claim = buildClaim(input);
    claims.set(claim.claimId, { claim, ownerKey });
    return structuredClone(claim);
  },
});
