// BillCreatePage.tsx
import { useEffect, useMemo, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
  message,
  Divider,
  Tag,
  Radio,
} from "antd";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../lib/api";
import {
  createBill,
  getNextBillNos,
  getPo,
  listProducts,
  listVendors,
  listWarehouses,
  type ProductRow,
  type VendorRow,
  type WarehouseRow,
} from "./purchaseApi";
import { calculateSummary, formatComma, parseComma } from "./purchaseUtils";
import { financeApi, type FinanceAccount } from "../finance/financeApi";

const { Title, Text } = Typography;

type VendorPerson = {
  id: number;
  prefix?: string | null;
  first_name: string;
  last_name: string;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  is_primary?: number;
  sort_order?: number;
};

type TaxType = "EXCLUDE_VAT_7" | "INCLUDE_VAT_7" | "NO_VAT";

type Line = {
  key: string;
  product_id: number | null;
  onhand?: number | null;
  qty: number;
  unit_cost: number;
  discount_pct: number;
  discount_amt: number;
  tax_type: TaxType;
  manual_vat?: number | null;
};

function calcLine(l: Line) {
  const qty = Number(l.qty || 0);
  const unit = Number(l.unit_cost || 0);
  const base = qty * unit;

  const dp = Number(l.discount_pct || 0);
  const da = Number(l.discount_amt || 0);

  const discByPct = base * (dp / 100);
  const discount = Math.min(base, discByPct + da);
  const afterDiscount = Math.max(0, base - discount);
  const hasManualVat =
    l.manual_vat !== undefined &&
    l.manual_vat !== null &&
    String(l.manual_vat) !== "";
  const manualVat = hasManualVat ? Number(l.manual_vat) : null;

  let beforeTax = Number(afterDiscount.toFixed(2));
  let vat = 0;
  let total = Number(afterDiscount.toFixed(2));

  if (l.tax_type === "EXCLUDE_VAT_7") {
    vat = hasManualVat ? manualVat! : Number((beforeTax * 0.07).toFixed(2));
    total = Number((beforeTax + vat).toFixed(2));
  }

  if (l.tax_type === "INCLUDE_VAT_7") {
    total = Number(afterDiscount.toFixed(2));
    vat = hasManualVat
      ? manualVat!
      : Number((total - total / 1.07).toFixed(2));
    beforeTax = Number((total - vat).toFixed(2));
  }

  return { qty, base, discount, beforeTax, vat, total };
}

function personLabel(p: VendorPerson) {
  const name =
    `${p.prefix ? `${p.prefix} ` : ""}${p.first_name} ${p.last_name}`.trim();
  const nick = p.nickname ? ` (${p.nickname})` : "";
  const pos = p.position ? ` • ${p.position}` : "";
  const dept = p.department ? ` • ${p.department}` : "";
  const phone = p.phone ? ` • ${p.phone}` : "";
  const email = p.email ? ` • ${p.email}` : "";
  const primary = Number(p.is_primary ?? 0) === 1 ? " (Primary)" : "";
  return `${name}${nick}${pos}${dept}${phone}${email}${primary}`.trim();
}

function safeUUID() {
  // @ts-ignore
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `k_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toTagList(v: any) {
  if (Array.isArray(v)) return v;
  return String(v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

const extraChargeOptions = [
  "ค่าขนส่ง",
  "ค่ารถ",
  "ค่าขนย้าย",
  "ค่าแรง",
  "ค่าคนงาน",
  "ค่าติดตั้ง",
  "ค่าบริการ",
  "ค่าธรรมเนียม",
  "ค่าประกันสินค้า",
  "ค่าภาษีนำเข้า",
  "ค่าเอกสาร",
  "ค่าอื่น ๆ",
];

export default function BillCreatePage() {
  const nav = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [autoBillNos, setAutoBillNos] = useState(true);
  const [billNosLoading, setBillNosLoading] = useState(false);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);

  const [form] = Form.useForm();

  const [lines, setLines] = useState<Line[]>([
    {
      key: safeUUID(),
      product_id: null,
      qty: 1,
      unit_cost: 0,
      tax_type: "EXCLUDE_VAT_7",
      discount_pct: 0,
      discount_amt: 0,
      manual_vat: null,
    },
  ]);

  // PO Linking
  const poIdFromQuery = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const n = Number(sp.get("poId") || 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [location.search]);

  const poIdFromState = useMemo(() => {
    const st: any = location.state;
    const n = Number(st?.po_id || st?.poId || 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [location.state]);

  const poId = poIdFromQuery ?? poIdFromState ?? null;
  const [poInfo, setPoInfo] = useState<{ po_no?: string | null; status?: string | null } | null>(null);

  // Vendor People & Address
  const [vendorPeople, setVendorPeople] = useState<VendorPerson[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [vendorRegistered, setVendorRegistered] = useState<any>(null);
  const [vendorShipping, setVendorShipping] = useState<any>(null);

  // Header Discount
  const [headerDiscountType, setHeaderDiscountType] = useState<"PERCENT" | "AMOUNT">("AMOUNT");
  const [extraChargeType, setExtraChargeType] = useState<"PERCENT" | "AMOUNT">("AMOUNT");

  // Finance Accounts
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);

  // Load Master Data & PO
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const [p, v, w, f] = await Promise.all([listProducts(), listVendors(), listWarehouses(), financeApi.list()]);
        if (!alive) return;

        setProducts((Array.isArray(p) ? p : []).filter((x) => x.is_active === 1 || (x.is_active as any) === true));
        setVendors((Array.isArray(v) ? v : []).filter((x) => (x.is_active === 1 || (x.is_active as any) === true) && (!x.type || x.type === "VENDOR" || x.type === "BOTH")));
        setWarehouses((Array.isArray(w) ? w : []).filter((x) => x.is_active === 1 || (x.is_active as any) === true));
        setFinanceAccounts(f.filter((a) => a.is_active));

        form.setFieldsValue({
          issue_date: dayjs(),
          bill_no: "",
          tax_invoice_no: "",
          vendor_id: undefined,
          vendor_person_id: undefined,
          warehouse_id: undefined,
          note: null,
          extra_charge_amt: 0,
          extra_charge_value: 0,
          extra_charge_note: null,
          header_discount_value: 0,
        });

        // If PO ID exists, load PO data
        if (poId) {
          const po = await getPo(poId);
          if (!alive) return;

          setPoInfo({ po_no: po?.header?.po_no ?? null, status: po?.header?.status ?? null });

          form.setFieldsValue({
            po_id: poId,
            vendor_id: po.header.vendor_id,
            warehouse_id: po.header.warehouse_id,
            note: po.header.note ?? null,
            extra_charge_amt: Number(po.header.extra_charge_amt ?? 0),
            extra_charge_value: Number(po.header.extra_charge_amt ?? 0),
            extra_charge_note: toTagList(po.header.extra_charge_note),
            header_discount_value: Number((po.header as any).header_discount_value ?? 0),
          });

          const hdt = (po.header as any).header_discount_type;
          if (hdt === "PERCENT" || hdt === "AMOUNT") {
            setHeaderDiscountType(hdt);
          }

          // Pre-load vendor person logic will be handled by the useEffect watching vendor_id below,
          // BUT we need to set the value after options load. 
          // Ideally, we wait for vendor load, then set form. 
          // We can set a "pendingPersonId" state if needed, or just rely on react-hook-form value if we set it effectively.

          // Let's force load vendor details now to ensure address shows up immediately
          if (po.header.vendor_id) {
            await loadVendorPeople(po.header.vendor_id);
            form.setFieldsValue({ vendor_person_id: po.header.vendor_person_id });
          }

          const poItems = Array.isArray(po?.items) ? po.items : [];
          if (poItems.length > 0) {
            setLines(
              poItems.map((it) => ({
                key: safeUUID(),
                product_id: toNum(it.product_id, undefined as any),
                qty: Math.max(1, toNum(it.qty, 1)),
                unit_cost: Math.max(0, toNum(it.unit_cost, 0)),
                discount_pct: toNum(it.discount_pct, 0),
                discount_amt: toNum(it.discount_amt, 0),
                tax_type: (it.tax_type as TaxType) || "EXCLUDE_VAT_7",
              })),
            );
          }
        }

      } catch (e: any) {
        message.error(e?.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ", 2);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId]);

  async function loadNextBillNos(issueDateValue?: any) {
    const d = dayjs(issueDateValue || form.getFieldValue("issue_date") || dayjs());
    if (!d.isValid()) return;

    try {
      setBillNosLoading(true);
      const next = await getNextBillNos(d.format("YYYY-MM-DD"));
      if (!next?.bill_no || !next?.tax_invoice_no) {
        throw new Error("Bill number not found");
      }
      setAutoBillNos(true);
      form.setFieldsValue({
        bill_no: next.bill_no,
        tax_invoice_no: next.tax_invoice_no,
      });
    } catch {
      setAutoBillNos(false);
      form.setFieldsValue({ bill_no: "", tax_invoice_no: "" });
      message.warning("ระบบ gen เลขที่ Bill/Tax ไม่ได้ กรุณากรอกเอง", 2);
    } finally {
      setBillNosLoading(false);
    }
  }

  const issueDateWatcher = Form.useWatch("issue_date", form);

  useEffect(() => {
    if (!issueDateWatcher) return;
    loadNextBillNos(issueDateWatcher);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueDateWatcher]);

  async function loadVendorPeople(vendorId: number) {
    setLoadingPeople(true);
    try {
      const { data } = await api.get(`/vendors/${vendorId}`);
      const vd = data as any;

      setVendorRegistered(vd?.registered_address ?? null);
      setVendorShipping(vd?.shipping_address ?? null);

      const list = Array.isArray(vd?.people) ? vd.people : [];
      const sorted = [...list].sort((a, b) => {
        const ap = Number(a.is_primary ?? 0);
        const bp = Number(b.is_primary ?? 0);
        if (bp !== ap) return bp - ap;
        return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
      });

      setVendorPeople(sorted);

      // If NO person selected yet, select primary
      const currentPerson = form.getFieldValue("vendor_person_id");
      if (!currentPerson) {
        const primary = sorted.find((p) => Number(p.is_primary ?? 0) === 1) || sorted[0];
        if (primary) form.setFieldsValue({ vendor_person_id: primary.id });
      }

    } catch (e: any) {
      setVendorPeople([]);
      message.error(e?.response?.data?.message || "โหลดผู้ติดต่อ Vendor ไม่สำเร็จ", 2);
    } finally {
      setLoadingPeople(false);
    }
  }

  const vendorIdSelector = Form.useWatch("vendor_id", form);

  useEffect(() => {
    if (!vendorIdSelector) {
      setVendorPeople([]);
      setVendorRegistered(null);
      setVendorShipping(null);
      return;
    }
    // Only reload if we are not already loading (this checks strict changes)
    // Actually simplicity: just load.
    loadVendorPeople(Number(vendorIdSelector));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorIdSelector]);

  // Calculations
  const extraChargeValue = Form.useWatch("extra_charge_value", form);
  const extraChargeAmt = Form.useWatch("extra_charge_amt", form);
  const headerDiscountValue = Form.useWatch("header_discount_value", form);

  const summary = useMemo(() => {
    return calculateSummary(lines, {
      extra_charge_amt: extraChargeAmt,
      header_discount_type: headerDiscountType,
      header_discount_value: headerDiscountValue,
    });
  }, [lines, extraChargeAmt, headerDiscountValue, headerDiscountType]);

  const extraChargeBaseAmount = useMemo(() => {
    return calculateSummary(lines, {
      extra_charge_amt: 0,
      header_discount_type: "AMOUNT",
      header_discount_value: 0,
    }).net;
  }, [lines]);

  function calcExtraChargeAmount(
    value: number | string | null | undefined,
    type = extraChargeType,
  ) {
    const n = Number(value ?? 0);
    const safeValue = Number.isFinite(n) ? n : 0;
    const max = type === "PERCENT" ? 100 : extraChargeBaseAmount;
    const normalizedValue = Math.min(Math.max(safeValue, 0), max);
    return type === "PERCENT"
      ? Number(((extraChargeBaseAmount * normalizedValue) / 100).toFixed(2))
      : normalizedValue;
  }

  function normalizeExtraChargeValue(
    value: number | string | null | undefined,
    type = extraChargeType,
  ) {
    const n = Number(value ?? 0);
    const safeValue = Number.isFinite(n) ? n : 0;
    const max = type === "PERCENT" ? 100 : extraChargeBaseAmount;
    return Math.min(Math.max(safeValue, 0), max);
  }

  function preventNonNumericKey(e: KeyboardEvent<HTMLInputElement>) {
    if (
      e.ctrlKey ||
      e.metaKey ||
      [
        "Backspace",
        "Delete",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "Tab",
        "Enter",
      ].includes(e.key)
    ) {
      return;
    }

    if (!/^[0-9.]$/.test(e.key)) {
      e.preventDefault();
      return;
    }

    const target = e.currentTarget;
    if (e.key === "." && target.value.includes(".")) {
      e.preventDefault();
    }
  }

  function preventNonNumericPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/,/g, "").trim();
    if (!/^\d*\.?\d*$/.test(text)) {
      e.preventDefault();
    }
  }

  function setExtraChargeValue(value: number | string | null | undefined) {
    const normalizedValue = normalizeExtraChargeValue(value);
    form.setFieldsValue({
      extra_charge_value: normalizedValue,
      extra_charge_amt: calcExtraChargeAmount(normalizedValue),
    });
  }

  function handleExtraChargeTypeChange(type: "PERCENT" | "AMOUNT") {
    setExtraChargeType(type);
    const normalizedValue = normalizeExtraChargeValue(
      form.getFieldValue("extra_charge_value"),
      type,
    );
    form.setFieldsValue({
      extra_charge_value: normalizedValue,
      extra_charge_amt: calcExtraChargeAmount(normalizedValue, type),
    });
  }

  useEffect(() => {
    const current = Number(extraChargeValue ?? 0);
    const normalizedValue = normalizeExtraChargeValue(current);
    const amount = calcExtraChargeAmount(normalizedValue);
    if (current !== normalizedValue || Number(extraChargeAmt ?? 0) !== amount) {
      form.setFieldsValue({
        extra_charge_value: normalizedValue,
        extra_charge_amt: amount,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    extraChargeType,
    extraChargeBaseAmount,
    extraChargeValue,
    extraChargeAmt,
  ]);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
    [products],
  );

  const vendorPeopleOptions = useMemo(() => {
    return vendorPeople
      .filter((p) => Number(p.id) > 0)
      .map((p) => ({
        value: Number(p.id),
        label: personLabel(p),
      }));
  }, [vendorPeople]);

  const taxOptions = [
    { value: "EXCLUDE_VAT_7", label: "แยกภาษี 7%" },
    { value: "INCLUDE_VAT_7", label: "รวมภาษี 7%" },
    { value: "NO_VAT", label: "ไม่มีภาษี" },
  ];

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: Date.now().toString(),
        product_id: null,
        qty: 1,
        unit_cost: 0,
        tax_type: "EXCLUDE_VAT_7",
        discount_pct: 0,
        discount_amt: 0,
        manual_vat: null,
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((x) => x.key !== key));
  }

  function setLine(key: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((x) => {
        if (x.key !== key) return x;
        const next = { ...x, ...patch };
        if (
          !("manual_vat" in patch) &&
          ("qty" in patch ||
            "unit_cost" in patch ||
            "discount_pct" in patch ||
            "discount_amt" in patch ||
            "tax_type" in patch)
        ) {
          next.manual_vat = null;
        }
        return next;
      })
    );
  }

  async function submit() {
    const v = await form.validateFields();

    const items = lines
      .map((l) => ({
        product_id: Number(l.product_id || 0),
        qty: Number(l.qty || 0),
        unit_cost: Number(l.unit_cost ?? 0),

        discount_pct: Number(l.discount_pct ?? 0),
        discount_amt: Number(l.discount_amt ?? 0),
        tax_type: l.tax_type ?? "EXCLUDE_VAT_7",
      }))
      .filter((x) => x.product_id > 0 && x.qty > 0 && x.unit_cost >= 0);

    if (items.length === 0) {
      message.error("ต้องมีรายการสินค้าอย่างน้อย 1 รายการ", 2);
      return;
    }

    try {
      setLoading(true);

      const payload = {
        bill_no: autoBillNos ? null : String(v.bill_no).trim(),
        tax_invoice_no: autoBillNos ? null : String(v.tax_invoice_no).trim(),
        po_id: poId ?? null,
        vendor_id: Number(v.vendor_id),
        warehouse_id: Number(v.warehouse_id),
        issue_date: dayjs(v.issue_date).format("YYYY-MM-DD"),
        paid_date: v.paid_date ? dayjs(v.paid_date).format("YYYY-MM-DD") : null,
        finance_account_id: v.paid_date ? (v.finance_account_id ? Number(v.finance_account_id) : null) : null,
        note: v.note ? String(v.note) : null,

        vendor_person_id: v.vendor_person_id ? Number(v.vendor_person_id) : null,

        extra_charge_amt: Number(v.extra_charge_amt ?? 0),
        extra_charge_note: Array.isArray(v.extra_charge_note)
          ? v.extra_charge_note.join(", ")
          : v.extra_charge_note
            ? String(v.extra_charge_note)
            : null,
        header_discount_type: headerDiscountType,
        header_discount_value: Number(v.header_discount_value ?? 0),

        items,
      };

      const r = await createBill(payload);
      message.success("สร้าง Bill (DRAFT) แล้ว", 1.2);
      nav(`/purchase/bill/${r.id}`, { replace: true });
    } catch (e: any) {
      message.error(e?.response?.data?.message || "สร้าง Bill ไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  const subtitle = useMemo(() => {
    if (!poId) return "สร้าง Bill ซื้อสินค้า (DRAFT)";
    const poNo = poInfo?.po_no ?? `#${poId}`;
    const st = poInfo?.status ? ` • สถานะ PO: ${poInfo.status}` : "";
    return `สร้าง Bill จาก PO: ${poNo}${st}`;
  }, [poId, poInfo]);


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">
            สร้าง Bill
          </Title>
          <Text type="secondary">{subtitle}</Text>
          {poId && (
            <div className="mt-2">
              <Tag color="blue">PO Link</Tag>{" "}
              <Button size="small" onClick={() => nav(`/purchase/po/${poId}`)}>
                เปิด PO นี้
              </Button>
            </div>
          )}
        </div>

        <Space>
          <Button onClick={() => nav("/purchase/bill")}>กลับรายการ</Button>
          <Button type="primary" loading={loading} onClick={submit}>
            บันทึก (DRAFT)
          </Button>
        </Space>
      </div>

      {/* Header Form */}
      <Form form={form} layout="vertical">
        <Form.Item name="extra_charge_value" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="extra_charge_amt" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="header_discount_value" hidden>
          <Input />
        </Form.Item>
        <Card loading={loading}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Form.Item
              name="bill_no"
              label="เลขที่ Bill"
              className="md:col-span-1"
              rules={
                autoBillNos
                  ? []
                  : [
                      { required: true, message: "กรอกเลขที่ Bill" },
                      { min: 3, message: "อย่างน้อย 3 ตัวอักษร" },
                    ]
              }
              extra={
                autoBillNos
                  ? "ระบบ gen เลขให้ตามวันที่เอกสาร และจะล็อกช่องนี้ไว้"
                  : "ระบบ gen ไม่ได้ กรุณากรอกเลขที่ Bill เอง"
              }
            >
              <Input
                placeholder={autoBillNos ? "กำลัง gen เลขที่ Bill" : "เช่น BILL-PO202604-0005"}
                disabled={autoBillNos}
                suffix={billNosLoading ? "..." : autoBillNos ? "AUTO" : "MANUAL"}
              />
            </Form.Item>

            <Form.Item
              name="tax_invoice_no"
              label="เลขที่ใบกำกับภาษี"
              className="md:col-span-1"
              rules={
                autoBillNos
                  ? []
                  : [
                      { required: true, message: "กรอกเลขที่ใบกำกับภาษี" },
                      { min: 3, message: "อย่างน้อย 3 ตัวอักษร" },
                    ]
              }
              extra={
                autoBillNos
                  ? "ระบบ gen เลข TAX คู่กับ Bill และจะล็อกช่องนี้ไว้"
                  : "ระบบ gen ไม่ได้ กรุณากรอกเลขที่ใบกำกับภาษีเอง"
              }
            >
              <Input
                placeholder={autoBillNos ? "กำลัง gen เลขที่ TAX" : "เช่น TAX-PO202604-0005"}
                disabled={autoBillNos}
                suffix={billNosLoading ? "..." : autoBillNos ? "AUTO" : "MANUAL"}
              />
            </Form.Item>

            <Form.Item
              name="issue_date"
              label="วันที่เอกสาร"
              className="md:col-span-1"
              rules={[{ required: true, message: "เลือกวันที่" }]}
            >
              <DatePicker className="w-full" format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item
              name="paid_date"
              label="วันที่ชำระ (Paid Date)"
              className="md:col-span-1"
            >
              <DatePicker
                className="w-full"
                placeholder="ระบุตราบเมื่อชำระแล้ว"
                format="DD/MM/YYYY"
                disabledDate={(current) =>
                  issueDateWatcher
                    ? current.isBefore(dayjs(issueDateWatcher).startOf("day"))
                    : false
                }
              />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prev, current) => prev.paid_date !== current.paid_date}
            >
              {({ getFieldValue }) => {
                const isPaid = !!getFieldValue("paid_date");
                if (!isPaid) return null;
                return (
                  <Form.Item
                    name="finance_account_id"
                    label="ช่องทางการจ่ายเงิน"
                    className="md:col-span-1"
                    rules={[{ required: true, message: "เลือกช่องทางการจ่ายเงิน" }]}
                  >
                    <Select
                      placeholder="เลือกช่องทางการจ่ายเงิน"
                      options={financeAccounts.map(a => ({
                        label: `[${a.type}] ${a.name} (คงเหลือ ${Number(a.balance).toLocaleString()})`,
                        value: a.id
                      }))}
                    />
                  </Form.Item>
                );
              }}
            </Form.Item>

            <Form.Item name="po_id" label="อ้างอิง PO" className="md:col-span-1">
              <Input value={poId ? String(poId) : ""} disabled placeholder="-" />
            </Form.Item>

            {/* Vendor */}
            <Form.Item
              name="vendor_id"
              label="Vendor"
              className="md:col-span-2"
              rules={[{ required: true, message: "เลือก Vendor" }]}
            >
              <Select
                showSearch
                placeholder="เลือกผู้ขาย"
                // If locked by PO, allows changing? Usually yes, but warns. 
                // But typically Bill from PO implies same vendor. Let's keep enabled but defaulted.
                optionFilterProp="label"
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                options={vendors.map((v) => ({
                  value: v.id,
                  label: `${v.code} - ${v.name}`,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="vendor_person_id"
              label="ผู้ติดต่อหลัก"
              className="md:col-span-2"
              rules={[{ required: true, message: "เลือกผู้ติดต่อหลัก" }]}
              extra="กรุณาเลือก Vendor ก่อน"
            >
              <Select
                loading={loadingPeople}
                disabled={!vendorIdSelector}
                placeholder={vendorIdSelector ? "เลือกผู้ติดต่อหลัก" : "เลือก Vendor ก่อน"}
                optionFilterProp="label"
                showSearch
                options={vendorPeopleOptions}
              />
            </Form.Item>

            {/* ที่อยู่จัดส่งเอกสาร */}
            {vendorShipping && (
              <div className="md:col-span-2">
                <Card size="small" title="ที่อยู่จัดส่งเอกสาร">
                  <div className="text-sm leading-relaxed">
                    {[
                      vendorShipping.contact_name,
                      vendorShipping.address_line,
                      vendorShipping.subdistrict && `ต.${vendorShipping.subdistrict}`,
                      vendorShipping.district && `อ.${vendorShipping.district}`,
                      vendorShipping.province && `จ.${vendorShipping.province}`,
                      vendorShipping.postcode,
                    ]
                      .filter(Boolean)
                      .join(" , ")}
                  </div>
                </Card>
              </div>
            )}

            {/* ที่อยู่จดทะเบียน */}
            {vendorRegistered && (
              <div className="md:col-span-2">
                <Card size="small" title="ที่อยู่จดทะเบียน">
                  <div className="text-sm leading-relaxed">
                    {[
                      vendorRegistered.contact_name,
                      vendorRegistered.address_line,
                      vendorRegistered.subdistrict && `ต.${vendorRegistered.subdistrict}`,
                      vendorRegistered.district && `อ.${vendorRegistered.district}`,
                      vendorRegistered.province && `จ.${vendorRegistered.province}`,
                      vendorRegistered.postcode,
                    ]
                      .filter(Boolean)
                      .join(" , ")}
                  </div>
                </Card>
              </div>
            )}

            <Form.Item
              name="warehouse_id"
              label="Warehouse"
              className="md:col-span-1"
              rules={[{ required: true, message: "เลือกคลัง" }]}
            >
              <Select
                showSearch
                placeholder="เลือกคลัง"
                options={warehouses.map((w) => ({
                  value: w.id,
                  label: `${w.code} - ${w.name}`,
                }))}
              />
            </Form.Item>

            <Form.Item name="note" label="หมายเหตุ (ถ้ามี)" className="md:col-span-3">
              <Input.TextArea rows={1} />
            </Form.Item>
          </div>

          <div style={{ display: "none" }}>
            {/* 
                REMOVED: Duplicate hidden fields which were causing form value conflicts.
                Values are now controlled directly in the Summary section.
            */}
          </div>
        </Card>

        {/* Items + Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
          {/* LEFT: Items */}
          <Card className="lg:col-span-9" bodyStyle={{ paddingTop: 12 }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-semibold text-base">รายการสินค้า</div>
              <Button onClick={addLine}>เพิ่มสินค้า</Button>
            </div>

            <Divider className="!my-3" />

            <div className="space-y-3">
              {lines.map((l, idx) => {
                const r = calcLine(l);

                return (
                  <div key={l.key} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">รายการที่ {idx + 1}</div>
                      <Button
                        danger
                        onClick={() => removeLine(l.key)}
                        disabled={lines.length <= 1}
                      >
                        ลบ
                      </Button>
                    </div>

                    {/* Row 1 */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3">
                      <div className="md:col-span-5">
                        <div className="text-xs text-gray-500 mb-1">สินค้า</div>
                        <Select
                          showSearch
                          placeholder="กรุณาเลือกก่อน"
                          value={l.product_id}
                          options={productOptions}
                          filterOption={(input, option) =>
                            String(option?.label ?? "")
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          onChange={(val) =>
                            setLine(l.key, { product_id: Number(val) })
                          }
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500 mb-1">
                          คงเหลือ
                        </div>
                        <Input
                          value={
                            typeof l.onhand === "number"
                              ? String(l.onhand)
                              : "-"
                          }
                          disabled
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500 mb-1">จำนวน</div>
                        <InputNumber
                          min={1}
                          value={l.qty}
                          formatter={formatComma}
                          parser={parseComma}
                          onKeyDown={preventNonNumericKey}
                          onPaste={preventNonNumericPaste}
                          onChange={(val) =>
                            setLine(l.key, { qty: Number(val || 0) })
                          }
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div className="md:col-span-3">
                        <div className="text-xs text-gray-500 mb-1">
                          ราคา/หน่วย (ต้นทุน)
                        </div>
                        <InputNumber
                          min={0}
                          value={l.unit_cost}
                          formatter={formatComma}
                          parser={parseComma}
                          onKeyDown={preventNonNumericKey}
                          onPaste={preventNonNumericPaste}
                          onChange={(val) =>
                            setLine(l.key, { unit_cost: Number(val ?? 0) })
                          }
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3">
                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500 mb-1">
                          ส่วนลด (%)
                        </div>
                        <InputNumber
                          min={0}
                          max={100}
                          value={l.discount_pct}
                          formatter={formatComma}
                          parser={parseComma}
                          onKeyDown={preventNonNumericKey}
                          onPaste={preventNonNumericPaste}
                          onChange={(val) =>
                            setLine(l.key, { discount_pct: Number(val ?? 0) })
                          }
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500 mb-1">
                          ส่วนลดบาท
                        </div>
                        <InputNumber
                          min={0}
                          value={l.discount_amt}
                          formatter={formatComma}
                          parser={parseComma}
                          onKeyDown={preventNonNumericKey}
                          onPaste={preventNonNumericPaste}
                          onChange={(val) =>
                            setLine(l.key, { discount_amt: Number(val ?? 0) })
                          }
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500 mb-1">
                          ประเภทภาษี
                        </div>
                        <Select
                          value={l.tax_type}
                          options={taxOptions}
                          onChange={(val) =>
                            setLine(l.key, { tax_type: val as TaxType })
                          }
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500 mb-1">
                          ก่อนภาษี
                        </div>
                        <Input value={r.beforeTax.toLocaleString()} disabled />
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <span>VAT</span>
                          {l.manual_vat !== undefined && l.manual_vat !== null && String(l.manual_vat) !== '' && (
                            <span className="text-[10px] text-orange-500">*(แก้ไขเอง)*</span>
                          )}
                        </div>
                        <InputNumber
                          min={0}
                          precision={2}
                          formatter={formatComma}
                          parser={parseComma}
                          onKeyDown={preventNonNumericKey}
                          onPaste={preventNonNumericPaste}
                          value={l.manual_vat !== undefined && l.manual_vat !== null && String(l.manual_vat) !== '' ? l.manual_vat : r.vat}
                          onChange={(val) =>
                            setLine(l.key, { manual_vat: val })
                          }
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500 mb-1">
                          มูลค่ารวม
                        </div>
                        <Input value={r.total.toLocaleString()} disabled />
                      </div>
                    </div>

                    <div className="text-xs text-gray-400 mt-2">
                      * กรุณาเลือกสินค้า/จำนวน/ต้นทุน เพื่อคำนวณยอดรวม
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* RIGHT: Summary + Extra Charge */}
          <Card className="lg:col-span-3" title="สรุปข้อมูล">
            <div className="space-y-3">
              <div className="flex justify-between">
                <div className="text-gray-600">รวมจำนวน</div>
                <div className="font-medium">
                  {summary.totalQty.toLocaleString()}
                </div>
              </div>

              <div className="flex justify-between">
                <div className="text-gray-600">รวมมูลค่าก่อนส่วนลด</div>
                <div className="font-medium">
                  {summary.base.toLocaleString()}
                </div>
              </div>

              <div className="flex justify-between">
                <div className="text-gray-600">รวมส่วนลด</div>
                <div className="font-medium">
                  {summary.discount.toLocaleString()}
                </div>
              </div>

              <Divider className="!my-2" />

              <div className="flex justify-between">
                <div className="text-gray-600">ยอดสุทธิสินค้า</div>
                <div className="font-medium">
                  {summary.net.toLocaleString()}
                </div>
              </div>

              <div className="flex justify-between">
                <div className="text-gray-600">VAT</div>
                <div className="font-medium">
                  {summary.vat.toLocaleString()}
                </div>
              </div>

              {/* Extra Charge */}
              <Divider className="!my-2" />
              <div>
                <div className="text-sm font-medium mb-2">
                  ค่าใช้จ่ายเพิ่มเติม
                </div>

                <Form.Item label="จำนวนเงิน" className="!mb-2">
                  <Radio.Group
                    value={extraChargeType}
                    onChange={(e) =>
                      handleExtraChargeTypeChange(e.target.value)
                    }
                    className="mb-2"
                  >
                    <Radio value="PERCENT">% </Radio>
                    <Radio value="AMOUNT">บาท</Radio>
                  </Radio.Group>

                  <InputNumber
                    min={0}
                    max={
                      extraChargeType === "PERCENT"
                        ? 100
                        : extraChargeBaseAmount
                    }
                    value={normalizeExtraChargeValue(extraChargeValue)}
                    precision={2}
                    formatter={formatComma}
                    parser={parseComma}
                    onKeyDown={preventNonNumericKey}
                    onPaste={preventNonNumericPaste}
                    onChange={setExtraChargeValue}
                    onBlur={() =>
                      setExtraChargeValue(
                        form.getFieldValue("extra_charge_value"),
                      )
                    }
                    style={{ width: "100%" }}
                    placeholder="0"
                  />
                </Form.Item>

                {extraChargeType === "PERCENT" && (
                  <Form.Item label="จำนวนเงินที่คำนวณจาก %" className="!mb-2">
                    <InputNumber
                      value={Number(extraChargeAmt ?? 0)}
                      disabled
                      precision={2}
                      formatter={formatComma}
                      parser={parseComma}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                )}

                <Form.Item
                  name="extra_charge_note"
                  label="รายละเอียด"
                  className="!mb-0"
                >
                  <Select
                    mode="tags"
                    allowClear
                    placeholder="เลือกหรือพิมพ์เอง"
                    options={extraChargeOptions.map((x) => ({
                      value: x,
                      label: x,
                    }))}
                  />
                </Form.Item>
              </div>

              {/* Header Discount */}
              <Divider className="!my-2" />
              <div>
                <div className="text-sm font-medium mb-2">ส่วนลดท้ายบิล</div>

                <Radio.Group
                  value={headerDiscountType}
                  onChange={(e) => setHeaderDiscountType(e.target.value)}
                  className="mb-2"
                >
                  <Radio value="PERCENT">% </Radio>
                  <Radio value="AMOUNT">บาท</Radio>
                </Radio.Group>

                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  value={headerDiscountValue}
                  onChange={(val) =>
                    form.setFieldsValue({
                      header_discount_value: val ?? 0,
                    })
                  }
                />
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <div>คิดเป็นเงิน</div>
                  <div>{summary.headerDiscount.toLocaleString()}</div>
                </div>
              </div>

              <Divider className="!my-2" />

              <div className="flex justify-between">
                <div className="text-gray-600">ยอดรวมสุทธิ</div>
                <div className="text-lg font-semibold">
                  {summary.grandTotal.toLocaleString()}
                </div>
              </div>

              <div className="text-xs text-gray-500">
                * ยอดรวมสุทธิ = (ยอดสุทธิสินค้า + VAT + ค่าใช้จ่ายเพิ่มเติม) − ส่วนลดท้ายบิล
              </div>
            </div>
          </Card>
        </div>
      </Form>
    </div>
  );
}
