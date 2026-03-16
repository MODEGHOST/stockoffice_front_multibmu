
import type { TaxType } from "./purchaseApi";

export const taxOptions = [
    { value: "EXCLUDE_VAT_7", label: "แยกภาษี 7%" },
    { value: "INCLUDE_VAT_7", label: "รวมภาษี 7%" },
    { value: "NO_VAT", label: "ไม่มีภาษี" },
];

export function normalizeTaxType(v: any): TaxType {
    const s = String(v ?? "")
        .trim()
        .toUpperCase();
    if (s === "EXCLUDE_VAT_7" || s === "INCLUDE_VAT_7" || s === "NO_VAT")
        return s as TaxType;
    return "EXCLUDE_VAT_7";
}

export interface LineCalculation {
    qty: number;
    unit: number;
    base: number;
    discount: number;
    afterDiscount: number;
    beforeTax: number;
    vat: number;
    total: number;
    taxType: TaxType;
    manualVat: number | null;
}

export function calcLine(it: any): LineCalculation {
    const qty = Number(it?.qty || 0);
    const unit = Number(it?.unit_cost || 0);
    const base = qty * unit;

    const dp = Number(it?.discount_pct ?? 0);
    const da = Number(it?.discount_amt ?? 0);

    const discByPct = base * (dp / 100);
    const discount = Math.min(base, discByPct + da);
    const afterDiscount = Math.max(0, base - discount);

    const taxType = normalizeTaxType(it?.tax_type);
    
    // Parse manual_vat if provided
    const hasManualVat = it?.manual_vat !== undefined && it?.manual_vat !== null && it.manual_vat !== '';
    const manualVat = hasManualVat ? Number(it.manual_vat) : null;

    let beforeTax = afterDiscount;
    let vat = 0;
    let total = afterDiscount;

    if (taxType === "EXCLUDE_VAT_7") {
        beforeTax = Number(afterDiscount.toFixed(2));
        vat = hasManualVat ? manualVat! : Number((beforeTax * 0.07).toFixed(2));
        total = Number((beforeTax + vat).toFixed(2));
    } else if (taxType === "INCLUDE_VAT_7") {
        total = Number(afterDiscount.toFixed(2)); // รวม VAT แล้ว
        vat = hasManualVat ? manualVat! : Number((total - (total / 1.07)).toFixed(2));
        beforeTax = Number((total - vat).toFixed(2));
    } else {
        // NO_VAT
        beforeTax = Number(afterDiscount.toFixed(2));
        vat = 0;
        total = beforeTax;
    }

    return {
        qty,
        unit,
        base,
        discount,
        afterDiscount,
        beforeTax,
        vat,
        total,
        taxType,
        manualVat
    };
}

export interface DocSummary {
    totalQty: number;
    base: number;
    discount: number;
    net: number;
    vat: number;
    extra: number;
    headerDiscountType: "PERCENT" | "AMOUNT";
    headerDiscountValue: number;
    headerDiscount: number;
    grandTotal: number;
    lineCount: number;
}

export function calculateSummary(items: any[], header: any): DocSummary {
    let totalQty = 0;
    let base = 0;
    let discount = 0;
    let netBeforeVat = 0;
    let vatTotal = 0;

    for (const it of items) {
        const r = calcLine(it);
        totalQty += r.qty;
        base += r.base;
        discount += r.discount;
        netBeforeVat += r.beforeTax;
        vatTotal += r.vat;
    }

    const extra = Number(header?.extra_charge_amt ?? 0) || 0;

    const headerDiscountType =
        header?.header_discount_type === "PERCENT" ? "PERCENT" : "AMOUNT";
    const headerDiscountValue = Number(header?.header_discount_value ?? 0) || 0;

    const totalBeforeHeaderDiscount = netBeforeVat + vatTotal + extra;

    let headerDiscount =
        headerDiscountType === "PERCENT"
            ? totalBeforeHeaderDiscount * (headerDiscountValue / 100)
            : headerDiscountValue;

    // Ensure discount doesn't exceed total
    headerDiscount = Math.min(totalBeforeHeaderDiscount, headerDiscount);

    const grandTotal = totalBeforeHeaderDiscount - headerDiscount;

    return {
        totalQty,
        base,
        discount,
        net: netBeforeVat,
        vat: vatTotal,
        extra,
        headerDiscountType,
        headerDiscountValue,
        headerDiscount,
        grandTotal,
        lineCount: items.length,
    };
}

export const formatComma = (val: any) => {
  if (val === undefined || val === null || val === '') return '';
  const parts = String(val).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

export const parseComma = (val: string | undefined) => {
  if (!val) return '' as unknown as number;
  return val.replace(/,/g, '') as unknown as number;
};
