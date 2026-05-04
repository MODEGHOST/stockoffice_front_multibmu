import { useEffect, useMemo, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Button, Card, DatePicker, Form, Input, InputNumber, Radio, Select, Space, Typography, message, Divider, Tag } from "antd";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../lib/api";
import {
  createGrn,
  getBill,
  getNextGrnNo,
  getPo,
  listProducts,
  listVendors,
  listWarehouses,
  type ProductRow,
  type VendorRow,
  type WarehouseRow,
  type PoDetail,
  type BillDetail,
} from "./purchaseApi";
import { calcLine, calculateSummary, formatComma, parseComma } from "./purchaseUtils";

const { Title, Text } = Typography;

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

  type Line = {
  key: string;
  bill_item_id?: number | null;
  product_id?: number;
  qty: number;
  unit_cost: number;
  tax_type?: TaxType;
  discount_pct: number;
  discount_amt: number;
  manual_vat?: number | null;
};

type TaxType = "EXCLUDE_VAT_7" | "INCLUDE_VAT_7" | "NO_VAT";

function safeUUID() {
  // @ts-ignore
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `k_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function GrnCreatePage() {
  const nav = useNavigate();
  const location = useLocation();

  const poIdFromQuery = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const n = Number(sp.get("poId") || 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [location.search]);

  const billIdFromQuery = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const n = Number(sp.get("billId") || 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [location.search]);

  const poIdFromState = useMemo(() => {
    const st: any = location.state;
    const n = Number(st?.po_id || st?.poId || 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [location.state]);

  const billIdFromState = useMemo(() => {
    const st: any = location.state;
    const n = Number(st?.bill_id || st?.billId || 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [location.state]);

  const billId = billIdFromQuery ?? billIdFromState ?? null;
  const poId = billId ? null : poIdFromQuery ?? poIdFromState ?? null;

  const [loading, setLoading] = useState(false);
  const [autoGrnNo, setAutoGrnNo] = useState(true);
  const [grnNoLoading, setGrnNoLoading] = useState(false);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);

  const [form] = Form.useForm();
  const [lines, setLines] = useState<Line[]>([{ key: safeUUID(), qty: 1, unit_cost: 0, tax_type: "EXCLUDE_VAT_7", discount_pct: 0, discount_amt: 0 }]);
  
  // address
  const [vendorRegistered, setVendorRegistered] = useState<any>(null);
  const [vendorShipping, setVendorShipping] = useState<any>(null);
  const [vendorGoodsShipping, setVendorGoodsShipping] = useState<any>(null);

  const [poData, setPoData] = useState<PoDetail | null>(null);
  const [billData, setBillData] = useState<BillDetail | null>(null);

  const lockByRef = !!billId || !!poId;
  const vendorId = Form.useWatch("vendor_id", form);

  useEffect(() => {
    if (!vendorId) {
      setVendorRegistered(null);
      setVendorShipping(null);
      setVendorGoodsShipping(null);
      return;
    }

    api
      .get(`/vendors/${vendorId}`)
      .then(({ data }: any) => {
        setVendorRegistered(data?.registered_address ?? null);
        setVendorShipping(data?.shipping_address ?? null);
        setVendorGoodsShipping(data?.goods_shipping_address ?? null);
      })
      .catch(() => {
        setVendorRegistered(null);
        setVendorShipping(null);
        setVendorGoodsShipping(null);
      });
  }, [vendorId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const [p, v, w] = await Promise.all([listProducts(), listVendors(), listWarehouses()]);
        if (!alive) return;

        setProducts((Array.isArray(p) ? p : []).filter((x) => x.is_active === 1 || (x.is_active as any) === true));
        setVendors((Array.isArray(v) ? v : []).filter((x) => (x.is_active === 1 || (x.is_active as any) === true) && (!x.type || x.type === "VENDOR" || x.type === "BOTH")));
        setWarehouses((Array.isArray(w) ? w : []).filter((x) => x.is_active === 1 || (x.is_active as any) === true));

        form.setFieldsValue({
          issue_date: dayjs(),
          grn_no: "",
          extra_charge_value: 0,
          extra_charge_amt: 0,
          extra_charge_note: null,
          header_discount_value: 0,
        });

        if (billId) {
          const bill = await getBill(billId);
          if (!alive) return;

          setBillData(bill);

          form.setFieldsValue({
            vendor_id: bill?.header?.vendor_id,
            warehouse_id: bill?.header?.warehouse_id,
            note: bill?.header?.note ?? null,
            issue_date: dayjs(),
            extra_charge_value: toNum(bill?.header?.extra_charge_amt, 0),
            extra_charge_amt: toNum(bill?.header?.extra_charge_amt, 0),
            extra_charge_note: bill?.header?.extra_charge_note,
            header_discount_value: toNum(bill?.header?.header_discount_value, 0),
          });

          if (bill?.header?.header_discount_type) {
            setHeaderDiscountType(bill.header.header_discount_type);
          }

          const billItems = Array.isArray(bill?.items) ? bill.items : [];
          if (billItems.length > 0) {
            setLines(
              billItems.map((it) => ({
                key: safeUUID(),
                bill_item_id: toNum(it.id, null as any),
                // Map Bill financial fields
                product_id: toNum(it.product_id, undefined as any),
                qty: Math.max(1, toNum(it.qty, 1)),
                unit_cost: Math.max(0, toNum(it.unit_cost, 0)),
                discount_pct: toNum(it.discount_pct, 0),
                discount_amt: toNum(it.discount_amt, 0),
                tax_type: (it.tax_type as TaxType) || "EXCLUDE_VAT_7",
              })),
            );
          } else {
            setLines([{ key: safeUUID(), qty: 1, unit_cost: 0, tax_type: "EXCLUDE_VAT_7", discount_pct: 0, discount_amt: 0 }]);
          }
          return;
        }

        if (poId) {
          const po = await getPo(poId);
          if (!alive) return;

          setPoData(po);

          form.setFieldsValue({
            vendor_id: po?.header?.vendor_id,
            warehouse_id: po?.header?.warehouse_id,
            note: po?.header?.note ?? null,
            issue_date: dayjs(),
            extra_charge_value: toNum((po?.header as any)?.extra_charge_amt, 0),
            extra_charge_amt: toNum((po?.header as any)?.extra_charge_amt, 0),
            extra_charge_note: (po?.header as any)?.extra_charge_note ?? null,
            header_discount_value: toNum((po?.header as any)?.header_discount_value, 0),
          });

          if ((po?.header as any)?.header_discount_type) {
            setHeaderDiscountType((po.header as any).header_discount_type);
          }

          const poItems = Array.isArray(po?.items) ? po.items : [];
          if (poItems.length > 0) {
            setLines(
              poItems.map((it) => ({
                key: safeUUID(),
                product_id: toNum(it.product_id, undefined as any),
                qty: Math.max(1, toNum(it.qty, 1)),
                unit_cost: Math.max(0, toNum(it.unit_cost, 0)),
                tax_type: (it.tax_type as TaxType) || "EXCLUDE_VAT_7",
                discount_pct: toNum(it.discount_pct, 0),
                discount_amt: toNum(it.discount_amt, 0),
              })),
            );
          } else {
            setLines([{ key: safeUUID(), qty: 1, unit_cost: 0, tax_type: "EXCLUDE_VAT_7", discount_pct: 0, discount_amt: 0 }]);
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
  }, [billId, poId]);

  async function loadNextGrnNo(issueDateValue?: any) {
    const d = dayjs(issueDateValue || form.getFieldValue("issue_date") || dayjs());
    if (!d.isValid()) return;

    try {
      setGrnNoLoading(true);
      const next = await getNextGrnNo(d.format("YYYY-MM-DD"));
      if (!next?.grn_no) throw new Error("GRN number not found");
      setAutoGrnNo(true);
      form.setFieldsValue({ grn_no: next.grn_no });
    } catch {
      setAutoGrnNo(false);
      form.setFieldsValue({ grn_no: "" });
      message.warning("ระบบ gen เลขที่ GRN ไม่ได้ กรุณากรอกเลขที่ GRN เอง", 2);
    } finally {
      setGrnNoLoading(false);
    }
  }

  const issueDateWatcher = Form.useWatch("issue_date", form);

  useEffect(() => {
    if (!issueDateWatcher) return;
    loadNextGrnNo(issueDateWatcher);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueDateWatcher]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: Date.now().toString(),
        product_id: undefined,
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

  function setLine(rowKey: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((x) => {
        if (x.key !== rowKey) return x;
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

    const rawItems = lines
      .map((l) => ({
        bill_item_id: l.bill_item_id ?? null,
        product_id: l.product_id ?? 0,
        qty: l.qty,
        unit_cost: l.unit_cost,
        discount_pct: l.discount_pct,
        discount_amt: l.discount_amt,
        tax_type: l.tax_type ?? "EXCLUDE_VAT_7",
        manual_vat: l.manual_vat ?? null,
      }))
      .filter((x) => x.product_id > 0 && x.qty > 0 && x.unit_cost >= 0);

    if (rawItems.length === 0) {
      message.error("ต้องมีรายการสินค้าอย่างน้อย 1 รายการ", 2);
      return;
    }

    const merged = new Map<string, { bill_item_id?: number | null; product_id: number; qty: number; unit_cost: number; discount_pct: number; discount_amt: number; tax_type: TaxType }>();

    for (const it of rawItems) {
      const key = it.bill_item_id ? `b:${it.bill_item_id}` : `p:${it.product_id}`;
      const cur = merged.get(key);
      if (!cur) merged.set(key, { ...it });
      else merged.set(key, { ...cur, qty: cur.qty + it.qty, unit_cost: it.unit_cost });
    }

    try {
      setLoading(true);

      const payload = {
        grn_no: autoGrnNo ? null : String(v.grn_no).trim(),
        po_id: poId ?? null,
        bill_id: billId ?? null,
        vendor_id: toNum(v.vendor_id, 0),
        warehouse_id: toNum(v.warehouse_id, 0),
        issue_date: dayjs(v.issue_date).format("YYYY-MM-DD"),
        note: v.note ? String(v.note) : null,
        items: Array.from(merged.values()),
        // Add new header fields
        extra_charge_amt: toNum(form.getFieldValue("extra_charge_amt"), 0),
        extra_charge_note: Array.isArray(form.getFieldValue("extra_charge_note"))
          ? form.getFieldValue("extra_charge_note").filter(Boolean).join(", ")
          : form.getFieldValue("extra_charge_note")
            ? String(form.getFieldValue("extra_charge_note"))
            : null,
        header_discount_type: headerDiscountType,
        header_discount_value: toNum(form.getFieldValue("header_discount_value"), 0),
      };

      const r = await createGrn(payload);
      message.success("สร้าง GRN (DRAFT) แล้ว", 1.2);
      nav(`/purchase/grn/${r.id}`, { replace: true });
    } catch (e: any) {
      message.error(e?.response?.data?.message || "สร้าง GRN ไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.code} - ${p.name}`,
      })),
    [products],
  );



  const subtitle = useMemo(() => {
    if (billId) {
      const bn = billData?.header?.bill_no ?? `#${billId}`;
      const st = billData?.header?.status ? ` • สถานะ Bill: ${billData.header.status}` : "";
      return `สร้างจาก Bill: ${bn}${st} (โหมด B)`;
    }
    if (poId) {
      const pn = poData?.header?.po_no ?? `#${poId}`;
      const st = poData?.header?.status ? ` • สถานะ PO: ${poData.header.status}` : "";
      return `สร้างจาก PO: ${pn}${st} (legacy)`;
    }
    return "สร้างใบรับเข้า (DRAFT) ก่อน แล้วค่อย Approve เพื่อให้สต็อกเข้า";
  }, [billId, billData, poId, poData]);

  // Calculations
  const extraChargeValue = Form.useWatch("extra_charge_value", form);
  const extraChargeAmt = Form.useWatch("extra_charge_amt", form);
  const headerDiscountValue = Form.useWatch("header_discount_value", form);
  const [headerDiscountType, setHeaderDiscountType] = useState<"PERCENT" | "AMOUNT">("AMOUNT");
  const [extraChargeType, setExtraChargeType] = useState<"PERCENT" | "AMOUNT">("AMOUNT");

  const totals = useMemo(() => {
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

  const taxOptions = [
    { value: "EXCLUDE_VAT_7", label: "แยกภาษี 7%" },
    { value: "INCLUDE_VAT_7", label: "รวมภาษี 7%" },
    { value: "NO_VAT", label: "ไม่มีภาษี" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">
            สร้าง GRN
          </Title>
          <Text type="secondary">{subtitle}</Text>

          {billId && (
            <div className="mt-2">
              <Tag color="purple">BILL Link</Tag>{" "}
              <Button size="small" onClick={() => nav(`/purchase/bill/${billId}`)}>
                เปิด Bill นี้
              </Button>
            </div>
          )}

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
          <Button onClick={() => nav("/purchase/grn")}>กลับรายการ</Button>
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
              name="grn_no"
              label="เลขที่ GRN"
              className="md:col-span-1"
              rules={
                autoGrnNo
                  ? []
                  : [
                      { required: true, message: "กรอกเลขที่ GRN" },
                      {
                        validator: async (_, value) => {
                          const s = String(value ?? "").trim();
                          if (s.length < 3) throw new Error("เลขที่ GRN สั้นเกินไป");
                        },
                      },
                    ]
              }
              extra={
                autoGrnNo
                  ? "ระบบ gen เลขให้ตามวันที่รับเข้า และจะล็อกช่องนี้ไว้"
                  : "ระบบ gen ไม่ได้ กรุณากรอกเลขที่ GRN เอง"
              }
            >
              <Input
                placeholder={autoGrnNo ? "กำลัง gen เลขที่ GRN" : "เช่น GRN-202604-0001"}
                disabled={autoGrnNo}
                suffix={grnNoLoading ? "..." : autoGrnNo ? "AUTO" : "MANUAL"}
              />
            </Form.Item>

            <Form.Item
              name="issue_date"
              label="วันที่รับเข้า"
              className="md:col-span-1"
              rules={[{ required: true, message: "เลือกวันที่" }]}
            >
              <DatePicker className="w-full" format="DD/MM/YYYY" />
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
                disabled={lockByRef}
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(String(input ?? "").toLowerCase())
                }
                options={vendors.map((v) => ({
                  value: v.id,
                  label: `${v.code} - ${v.name}`,
                }))}
              />
            </Form.Item>

            {/* Address Cards */}
            {vendorShipping && (
              <div className="md:col-span-2">
                <Card size="small" title="ที่อยู่จัดส่งเอกสาร">
                  <div className="text-sm leading-relaxed">
                    {[
                      vendorShipping.contact_name,
                      vendorShipping.address_line,
                      vendorShipping.subdistrict &&
                        `ต.${vendorShipping.subdistrict}`,
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

            {vendorGoodsShipping && (
              <div className="md:col-span-2">
                <Card size="small" title="ที่อยู่จัดส่งสินค้า">
                  <div className="text-sm leading-relaxed">
                    {[
                      vendorGoodsShipping.contact_name,
                      vendorGoodsShipping.phone &&
                        `โทร: ${vendorGoodsShipping.phone}`,
                      vendorGoodsShipping.address_line,
                      vendorGoodsShipping.subdistrict &&
                        `ต.${vendorGoodsShipping.subdistrict}`,
                      vendorGoodsShipping.district &&
                        `อ.${vendorGoodsShipping.district}`,
                      vendorGoodsShipping.province &&
                        `จ.${vendorGoodsShipping.province}`,
                      vendorGoodsShipping.postcode,
                    ]
                      .filter(Boolean)
                      .join(" , ")}
                  </div>
                </Card>
              </div>
            )}

            {vendorRegistered && (
              <div className="md:col-span-2">
                <Card size="small" title="ที่อยู่จดทะเบียน">
                  <div className="text-sm leading-relaxed">
                    {[
                      vendorRegistered.contact_name,
                      vendorRegistered.address_line,
                      vendorRegistered.subdistrict &&
                        `ต.${vendorRegistered.subdistrict}`,
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

             {/* Warehouse */}
            <Form.Item
              name="warehouse_id"
              label="Warehouse"
              className="md:col-span-2"
              rules={[{ required: true, message: "เลือกคลัง" }]}
            >
              <Select
                showSearch
                placeholder="เลือกคลัง"
                disabled={lockByRef}
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(String(input ?? "").toLowerCase())
                }
                options={warehouses.map((w) => ({
                  value: w.id,
                  label: `${w.code} - ${w.name}`,
                }))}
              />
            </Form.Item>

            <Form.Item name="note" label="หมายเหตุ" className="md:col-span-2">
              <Input placeholder="ระบุหมายเหตุ (ถ้ามี)" />
            </Form.Item>
          </div>
        </Card>
      

       {/* Items + Summary */}
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
          {/* LEFT: Items */}
          <Card className="lg:col-span-9" bodyStyle={{ paddingTop: 12 }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-semibold text-base">รายการสินค้า</div>
              <Button onClick={addLine} disabled={!!billId}>เพิ่มสินค้า</Button>
            </div>

            <Divider className="!my-3" />

            <div className="space-y-3">
              {lines.map((l) => {
                const r = calcLine(l);

                return (
                  <div key={l.key} className="border rounded-lg p-3 bg-slate-50 relative group">
                     {/* Remove Button (Valid only if not Ref-locked and > 1 item) */}
                     {(!billId) && lines.length > 1 && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <Button
                                size="small"
                                danger
                                type="text"
                                onClick={() => removeLine(l.key)}
                            >
                                ลบ
                            </Button>
                        </div>
                     )}

                     {/* Row 1 */}
                     <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-5">
                            <div className="text-xs text-gray-500 mb-1">สินค้า</div>
                            <Select
                                showSearch
                                className="w-full"
                                placeholder="เลือกสินค้า"
                                value={l.product_id}
                                disabled={!!billId}
                                onChange={(val) => setLine(l.key, { product_id: val })}
                                options={productOptions}
                                filterOption={(input, option) =>
                                    String(option?.label ?? "").toLowerCase().includes(String(input ?? "").toLowerCase())
                                }
                            />
                        </div>

                        <div className="md:col-span-2">
                            <div className="text-xs text-gray-500 mb-1">คงเหลือ</div>
                            <Input value="-" disabled className="w-full bg-gray-100" />
                        </div>

                        <div className="md:col-span-2">
                            <div className="text-xs text-gray-500 mb-1">จำนวนรับ</div>
                            <InputNumber
                                min={1}
                                className="w-full"
                                value={l.qty}
                                formatter={formatComma}
                                parser={parseComma}
                                onKeyDown={preventNonNumericKey}
                                onPaste={preventNonNumericPaste}
                                onChange={(val) => setLine(l.key, { qty: Number(val || 0) })}
                            />
                        </div>

                         <div className="md:col-span-3">
                            <div className="text-xs text-gray-500 mb-1">ต้นทุน/หน่วย</div>
                            <InputNumber
                                min={0}
                                className="w-full"
                                value={l.unit_cost}
                                formatter={formatComma}
                                parser={parseComma}
                                onKeyDown={preventNonNumericKey}
                                onPaste={preventNonNumericPaste}
                                onChange={(val) => setLine(l.key, { unit_cost: Number(val || 0) })}
                            />
                        </div>
                     </div>

                     {/* Row 2 */}
                     <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3 items-end">
                        <div className="md:col-span-2">
                           <div className="text-xs text-gray-500 mb-1">ส่วนลด (%)</div>
                           <InputNumber
                              className="w-full"
                              min={0}
                              max={100}
                              value={l.discount_pct}
                              formatter={formatComma}
                              parser={parseComma}
                              onKeyDown={preventNonNumericKey}
                              onPaste={preventNonNumericPaste}
                              onChange={(val) => setLine(l.key, { discount_pct: Number(val || 0) })}
                           />
                        </div>

                        <div className="md:col-span-2">
                           <div className="text-xs text-gray-500 mb-1">ส่วนลดบาท</div>
                           <InputNumber
                              className="w-full"
                              min={0}
                              value={l.discount_amt}
                              formatter={formatComma}
                              parser={parseComma}
                              onKeyDown={preventNonNumericKey}
                              onPaste={preventNonNumericPaste}
                              onChange={(val) => setLine(l.key, { discount_amt: Number(val || 0) })}
                           />
                        </div>

                        <div className="md:col-span-2">
                           <div className="text-xs text-gray-500 mb-1">ประเภทภาษี</div>
                           <Select
                              className="w-full"
                              value={l.tax_type ?? "EXCLUDE_VAT_7"}
                              onChange={(val) => setLine(l.key, { tax_type: val })}
                              options={taxOptions}
                           />
                        </div>

                        <div className="md:col-span-2">
                           <div className="text-xs text-gray-500 mb-1">ก่อนภาษี</div>
                           <Input 
                              className="w-full bg-gray-100" 
                              value={r.beforeTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                              disabled 
                           />
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
                                className="w-full"
                                formatter={formatComma}
                                parser={parseComma}
                                onKeyDown={preventNonNumericKey}
                                onPaste={preventNonNumericPaste}
                                value={l.manual_vat !== undefined && l.manual_vat !== null && String(l.manual_vat) !== '' ? l.manual_vat : r.vat}
                                onChange={(val) => setLine(l.key, { manual_vat: val })}
                           />
                        </div>

                        <div className="md:col-span-2">
                           <div className="text-xs text-gray-500 mb-1">มูลค่ารวม</div>
                           <Input 
                              className="w-full bg-gray-100" 
                              value={r.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                              disabled 
                           />
                        </div>
                     </div>
                  </div>
                );
              })}
            </div>
            
            {lines.length === 0 && (
                <div className="text-center text-gray-400 py-8">ไม่มีรายการสินค้า</div>
            )}
          </Card>

          {/* RIGHT: Summary */}
           <Card className="lg:col-span-3" title="สรุปข้อมูล">
             <div className="space-y-3">
                <div className="flex justify-between">
                    <div className="text-gray-600">รวมจำนวน</div>
                    <div className="font-medium">{totals.totalQty.toLocaleString()}</div>
                </div>
                 <div className="flex justify-between">
                    <div className="text-gray-600">มูลค่าก่อนส่วนลด</div>
                    <div className="font-medium">{totals.base.toLocaleString()}</div>
                </div>
                <div className="flex justify-between">
                    <div className="text-gray-600">ส่วนลดรวม</div>
                    <div className="font-medium text-red-500">-{totals.discount.toLocaleString()}</div>
                </div>
                
                 <Divider className="!my-2" />

                <div className="flex justify-between">
                  <div className="text-gray-600">ยอดสุทธิสินค้า</div>
                  <div className="font-medium">{totals.net.toLocaleString()}</div>
                </div>

                <div className="flex justify-between">
                  <div className="text-gray-600">VAT</div>
                  <div className="font-medium">{totals.vat.toLocaleString()}</div>
                </div>

                <Divider className="!my-2" />

                {/* Extra Charge */}
                <div>
                  <div className="text-sm font-medium mb-2">ค่าใช้จ่ายเพิ่มเติม</div>

                  <Form.Item label="จำนวนเงิน" className="!mb-2">
                    <Radio.Group
                      value={extraChargeType}
                      onChange={(e) => handleExtraChargeTypeChange(e.target.value)}
                      className="mb-2"
                    >
                      <Radio value="PERCENT">% </Radio>
                      <Radio value="AMOUNT">บาท</Radio>
                    </Radio.Group>

                    <InputNumber
                      min={0}
                      max={extraChargeType === "PERCENT" ? 100 : extraChargeBaseAmount}
                      value={normalizeExtraChargeValue(extraChargeValue)}
                      precision={2}
                      formatter={formatComma}
                      parser={parseComma}
                      onKeyDown={preventNonNumericKey}
                      onPaste={preventNonNumericPaste}
                      onChange={setExtraChargeValue}
                      onBlur={() => setExtraChargeValue(form.getFieldValue("extra_charge_value"))}
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

                  <Form.Item name="extra_charge_note" label="รายละเอียด" className="!mb-0">
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

                <Divider className="!my-2" />

                {/* Header Discount */}
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
                    onKeyDown={preventNonNumericKey}
                    onPaste={preventNonNumericPaste}
                    onChange={(val) =>
                      form.setFieldsValue({
                        header_discount_value: val ?? 0,
                      })
                    }
                  />
                  <div className="flex justify-between mt-1 text-xs text-gray-400">
                    <div>คิดเป็นเงิน</div>
                    <div>{totals.headerDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>

                 <Divider className="!my-2" />
                 
                <div className="flex justify-between">
                    <div className="text-gray-600">ยอดรวมสุทธิ</div>
                    <div className="text-lg font-semibold">{totals.grandTotal.toLocaleString()}</div>
                </div>
             </div>
          </Card>
       </div>
       </Form>
    </div>
  );
}
