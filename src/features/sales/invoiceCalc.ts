export type VatMode = "EXCL" | "INCL" | "NONE";
export type CommMode = "PERCENT" | "AMOUNT";

export type Line = {
  key: string;

  product_id?: number;
  product_label?: string; // เก็บ label ไว้ช่วย show ใน detail ตอน backend ไม่มี code/name

  quantity?: number;
  price?: number;

  discount_percent?: number;
  discount_amount?: number;

  vat_mode?: VatMode;
  vat_rate?: number;

  commission_mode?: CommMode;
  commission_value?: number;

  withholding_rate?: number;

  // computed
  amount_before_vat?: number;
  vat_amount?: number;

  commission_per_unit?: number;
  commission_total?: number;

  withholding_amount?: number;

  total?: number;
};

export function fmt(n: unknown) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function createEmptyLine(): Line {
  return recalcLine({
    key: crypto.randomUUID(),
    quantity: 1,
    price: 0,
    discount_percent: 0,
    discount_amount: 0,
    vat_mode: "EXCL",
    vat_rate: 7,
    commission_mode: "PERCENT",
    commission_value: 0,
    withholding_rate: 0,
  });
}

export function recalcLine(l: Line): Line {
  const qty = Math.max(0, Number(l.quantity || 0));
  const price = Math.max(0, Number(l.price || 0));

  const gross = qty * price;

  const discPct = clamp(Number(l.discount_percent || 0), 0, 100);
  const discAmt = Math.max(0, Number(l.discount_amount || 0));
  const discByPct = gross * (discPct / 100);
  const discount = Math.min(gross, discByPct + discAmt);

  const netBase = Math.max(0, gross - discount);

  const vatMode: VatMode = (l.vat_mode ?? "EXCL") as VatMode;
  const vatRate = Math.max(0, Number(l.vat_rate ?? 7));

  let beforeVat = netBase;
  let vat = 0;
  let total = netBase;

  if (vatMode === "EXCL") {
    beforeVat = netBase;
    vat = beforeVat * (vatRate / 100);
    total = beforeVat + vat;
  } else if (vatMode === "INCL") {
    const divisor = 1 + vatRate / 100;
    beforeVat = divisor > 0 ? netBase / divisor : netBase;
    vat = netBase - beforeVat;
    total = netBase;
  } else {
    beforeVat = netBase;
    vat = 0;
    total = netBase;
  }

  const commMode: CommMode = (l.commission_mode ?? "PERCENT") as CommMode;
  const commVal = Math.max(0, Number(l.commission_value || 0));

  let commTotal = 0;
  if (commMode === "PERCENT") commTotal = beforeVat * (commVal / 100);
  else commTotal = commVal;

  const commPerUnit = qty > 0 ? commTotal / qty : 0;

  const whtRate = clamp(Number(l.withholding_rate || 0), 0, 100);
  const whtAmount = beforeVat * (whtRate / 100);

  return {
    ...l,
    quantity: qty,
    price: price,

    discount_percent: discPct,
    discount_amount: discAmt,
    vat_rate: vatRate,

    amount_before_vat: Number(beforeVat.toFixed(2)),
    vat_amount: Number(vat.toFixed(2)),

    commission_total: Number(commTotal.toFixed(2)),
    commission_per_unit: Number(commPerUnit.toFixed(2)),

    withholding_rate: whtRate,
    withholding_amount: Number(whtAmount.toFixed(2)),

    total: Number(total.toFixed(2)),
  };
}

export function calcTotals(lines: Line[]) {
  let qty = 0;
  let beforeVat = 0;
  let vat = 0;
  let total = 0;
  let commissionTotal = 0;
  let withholdingTotal = 0;

  for (const l of lines) {
    qty += Number(l.quantity || 0);
    beforeVat += Number(l.amount_before_vat || 0);
    vat += Number(l.vat_amount || 0);
    total += Number(l.total || 0);
    commissionTotal += Number(l.commission_total || 0);
    withholdingTotal += Number(l.withholding_amount || 0);
  }

  return {
    qty,
    beforeVat,
    vat,
    total,
    commissionTotal,
    withholdingTotal,
    netAfterWithholding: total - withholdingTotal,
  };
}
