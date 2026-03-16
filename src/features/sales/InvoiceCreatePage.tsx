// src/features/sales/InvoiceCreatePage.tsx
import { memo, useEffect, useMemo, useState, useCallback } from "react";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  message,
  Row,
  Col,
  Divider,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

import {
  type Line,
  type VatMode,
  type CommMode,
  createEmptyLine,
  recalcLine,
  calcTotals,
  fmt,
} from "./invoiceCalc";

const { Text } = Typography;

type WarehouseRow = { id: number; code?: string; name: string };
type CustomerRow = { id: number; code?: string; name: string; type: string };

type StockSummaryRow = {
  company_id: number;
  warehouse_id: number;
  warehouse_code: string;
  warehouse_name: string;
  product_id: number;
  product_code: string;
  product_name: string;
  qty: number;
  updated_at?: string;
};

type Option = { value: number; label: string };

// ---------- VAT UI ----------
type VatUI = "EXCL_7" | "INCL_7" | "EXCL_0" | "NONE";
const VAT_UI_OPTIONS: { value: VatUI; label: string }[] = [
  { value: "EXCL_7", label: "แยกภาษี 7%" },
  { value: "INCL_7", label: "รวมภาษี 7%" },
  { value: "EXCL_0", label: "VAT 0%" },
  { value: "NONE", label: "ไม่มี VAT" },
];

function vatUiFromLine(l: Line): VatUI {
  const mode = (l.vat_mode ?? "EXCL") as VatMode;
  const rate = Number(l.vat_rate ?? 7);
  if (mode === "NONE") return "NONE";
  if (rate === 0) return "EXCL_0";
  if (mode === "INCL") return "INCL_7";
  return "EXCL_7";
}

function applyVatUi(v: VatUI): Pick<Line, "vat_mode" | "vat_rate"> {
  if (v === "NONE") return { vat_mode: "NONE", vat_rate: 0 };
  if (v === "EXCL_0") return { vat_mode: "EXCL", vat_rate: 0 };
  if (v === "INCL_7") return { vat_mode: "INCL", vat_rate: 7 };
  return { vat_mode: "EXCL", vat_rate: 7 };
}

// ---------- COMM UI ----------
type CommPercentPreset = 1 | 2 | 3 | 4 | 5;
type CommPercentUI = `${CommPercentPreset}` | "CUSTOM";

const COMM_PERCENT_OPTIONS: { value: CommPercentUI; label: string }[] = [
  { value: "1", label: "1%" },
  { value: "2", label: "2%" },
  { value: "3", label: "3%" },
  { value: "4", label: "4%" },
  { value: "5", label: "5%" },
  { value: "CUSTOM", label: "กำหนดเอง" },
];

function commPercentUiFromValue(v: any): CommPercentUI {
  const n = Number(v ?? 0);
  if ([1, 2, 3, 4, 5].includes(n)) return String(n) as CommPercentUI;
  return "CUSTOM";
}

// ✅ ย้ายออกนอก component หลัก (กัน remount)
const FieldLabel = memo(function FieldLabel({ children }: { children: any }) {
  return <div className="text-xs text-gray-500 mb-1">{children}</div>;
});

type LineCardProps = {
  line: Line;
  index: number;
  linesCount: number;
  warehouseId?: number;
  productOptions: Option[];
  availableByProductId: Map<number, number>;
  usedByProductId: Map<number, number>;
  getMaxQtyForLine: (line: Line) => number;
  updateLine: (key: string, patch: Partial<Line>) => void;
  removeLine: (key: string) => void;

  commUi: CommPercentUI;
  commMode: CommMode;
  commCustom?: number;
  setCommUi: (key: string, v: CommPercentUI) => void;
  setCommCustom: (key: string, n: number) => void;
};

const LineCard = memo(function LineCard({
  line,
  index,
  linesCount,
  warehouseId,
  productOptions,
  availableByProductId,
  usedByProductId,
  getMaxQtyForLine,
  updateLine,
  removeLine,
  commUi,
  commMode,
  commCustom,
  setCommUi,
  setCommCustom,
}: LineCardProps) {
  const max = getMaxQtyForLine(line);
  const usedAll = line.product_id
    ? Number(usedByProductId.get(Number(line.product_id)) || 0)
    : 0;

  const selectedLabel = line.product_id
    ? productOptions.find((o) => o.value === Number(line.product_id))?.label
    : undefined;

  const disableInputs = !warehouseId;

  return (
    <Card
      size="small"
      className="mb-3"
      bodyStyle={{ padding: 16 }}
      title={
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">
            รายการที่ {index + 1}
            {selectedLabel ? (
              <Text type="secondary" className="ml-2">
                ({selectedLabel})
              </Text>
            ) : null}
          </div>
          <Space>
            {warehouseId && line.product_id ? (
              <Text type="secondary" className="text-xs">
                คงเหลือ{" "}
                {fmt(
                  Number(availableByProductId.get(Number(line.product_id)) || 0),
                )}{" "}
                | ใช้ไปในใบนี้ {fmt(usedAll)}
              </Text>
            ) : null}
            <Button
              danger
              onClick={() => removeLine(line.key)}
              disabled={linesCount <= 1}
            >
              ลบ
            </Button>
          </Space>
        </div>
      }
    >
      {/* Row 1 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12} xl={11}>
          <FieldLabel>สินค้า</FieldLabel>
          <Select
            showSearch
            placeholder={
              warehouseId ? "เลือกสินค้า (เฉพาะคลังนี้)" : "กรุณาเลือกคลังก่อน"
            }
            disabled={!warehouseId}
            options={productOptions}
            value={line.product_id}
            onChange={(v) => {
              const pid = Number(v);
              const maxThis = getMaxQtyForLine({
                ...line,
                product_id: pid,
                quantity: line.quantity,
              });
              const nextQty = Math.min(
                Math.max(1, Number(line.quantity || 1)),
                maxThis || 1,
              );
              updateLine(line.key, { product_id: pid, quantity: nextQty });
            }}
            optionFilterProp="label"
            style={{ width: "100%" }}
          />
        </Col>

        <Col xs={12} lg={4} xl={4}>
          <FieldLabel>คงเหลือ</FieldLabel>
          <Input value={line.product_id ? fmt(max) : "-"} readOnly />
        </Col>

        <Col xs={12} lg={4} xl={4}>
          <FieldLabel>จำนวน</FieldLabel>
          <InputNumber
            className="w-full"
            min={1}
            max={max || undefined}
            disabled={disableInputs || !line.product_id}
            value={line.quantity}
            onChange={(v) => updateLine(line.key, { quantity: Number(v || 1) })}
          />
        </Col>

        <Col xs={12} lg={4} xl={5}>
          <FieldLabel>ราคา/หน่วย</FieldLabel>
          {/* ✅ หลังย้าย LineCard ออก โฟกัสจะไม่หลุดแล้ว */}
          <InputNumber
            className="w-full"
            min={0}
            disabled={disableInputs}
            value={line.price}
            onChange={(v) => updateLine(line.key, { price: Number(v ?? 0) })}
          />
        </Col>
      </Row>

      <Divider className="!my-4" />

      {/* Row 2 */}
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} xl={16}>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <FieldLabel>ส่วนลด (%)</FieldLabel>
              <InputNumber
                className="w-full"
                min={0}
                max={100}
                disabled={disableInputs}
                value={line.discount_percent}
                onChange={(v) =>
                  updateLine(line.key, { discount_percent: Number(v || 0) })
                }
              />
            </Col>

            <Col xs={12} md={6}>
              <FieldLabel>ส่วนลดบาท</FieldLabel>
              <InputNumber
                className="w-full"
                min={0}
                disabled={disableInputs}
                value={line.discount_amount}
                onChange={(v) =>
                  updateLine(line.key, { discount_amount: Number(v || 0) })
                }
              />
            </Col>

            <Col xs={24} md={12}>
              <FieldLabel>ประเภทภาษี</FieldLabel>
              <Select
                value={vatUiFromLine(line)}
                options={VAT_UI_OPTIONS}
                disabled={disableInputs}
                onChange={(v) => updateLine(line.key, applyVatUi(v))}
                style={{ width: "100%" }}
              />
            </Col>
          </Row>
        </Col>

        <Col xs={24} xl={8}>
          <Row gutter={[16, 16]}>
            <Col xs={12}>
              <FieldLabel>ก่อนภาษี</FieldLabel>
              <Input value={fmt(line.amount_before_vat || 0)} readOnly />
            </Col>
            <Col xs={12}>
              <FieldLabel>มูลค่ารวม</FieldLabel>
              <Input value={fmt(line.total || 0)} readOnly />
            </Col>
          </Row>
        </Col>
      </Row>

      <Divider className="!my-4" />

      {/* COMM */}
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <FieldLabel>ประเภทคอม</FieldLabel>
              <Select
                value={commMode}
                options={[
                  { value: "PERCENT", label: "เปอร์เซ็นต์" },
                  { value: "AMOUNT", label: "จำนวนเงิน" },
                ]}
                disabled={disableInputs}
                onChange={(v) => {
                  if (v === "PERCENT") {
                    setCommUi(line.key, "CUSTOM");
                    updateLine(line.key, {
                      commission_mode: "PERCENT",
                      commission_value: Number(commCustom ?? 0),
                    });
                  } else {
                    updateLine(line.key, {
                      commission_mode: "AMOUNT",
                      commission_value: 0,
                    });
                  }
                }}
                style={{ width: "100%" }}
              />
            </Col>

            <Col xs={24} md={16}>
              <FieldLabel>ตั้งค่า % / เงิน</FieldLabel>

              {commMode === "PERCENT" ? (
                <>
                  <Row gutter={[12, 12]}>
                    <Col xs={24} lg={12}>
                      <Select
                        value={commUi}
                        options={COMM_PERCENT_OPTIONS}
                        disabled={disableInputs}
                        onChange={(v) => {
                          setCommUi(line.key, v);
                          if (v === "CUSTOM") {
                            updateLine(line.key, {
                              commission_mode: "PERCENT",
                              commission_value: Number(commCustom ?? 0),
                            });
                            return;
                          }
                          updateLine(line.key, {
                            commission_mode: "PERCENT",
                            commission_value: Number(v),
                          });
                        }}
                        style={{ width: "100%" }}
                      />
                    </Col>

                    <Col xs={24} lg={12}>
                      <InputNumber
                        className="w-full"
                        min={0}
                        max={100}
                        disabled={disableInputs || commUi !== "CUSTOM"}
                        value={Number(
                          commUi === "CUSTOM"
                            ? commCustom ?? line.commission_value ?? 0
                            : line.commission_value ?? 0,
                        )}
                        addonAfter="%"
                        onChange={(v) => {
                          const n = Number(v ?? 0);
                          setCommCustom(line.key, n);
                          updateLine(line.key, { commission_value: n });
                        }}
                      />
                    </Col>
                  </Row>
                </>
              ) : (
                <InputNumber
                  className="w-full"
                  min={0}
                  disabled={disableInputs}
                  value={line.commission_value}
                  addonAfter="บาท"
                  onChange={(v) =>
                    updateLine(line.key, { commission_value: Number(v ?? 0) })
                  }
                />
              )}
            </Col>
          </Row>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-3">
        <Col xs={24}>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <FieldLabel>คอม/หน่วย</FieldLabel>
              <Input value={fmt(line.commission_per_unit || 0)} readOnly />
            </Col>

            <Col xs={12} md={6}>
              <FieldLabel>คอมรวม</FieldLabel>
              <Input value={fmt(line.commission_total || 0)} readOnly />
            </Col>

            <Col xs={12} md={6}>
              <FieldLabel>หัก ณ (%)</FieldLabel>
              <InputNumber
                className="w-full"
                min={0}
                max={100}
                disabled={disableInputs}
                value={line.withholding_rate}
                onChange={(v) =>
                  updateLine(line.key, { withholding_rate: Number(v || 0) })
                }
              />
            </Col>

            <Col xs={12} md={6}>
              <FieldLabel>หัก ณ (บาท)</FieldLabel>
              <Input value={fmt(line.withholding_amount || 0)} readOnly />
            </Col>
          </Row>
        </Col>
      </Row>

      {!warehouseId ? (
        <div className="mt-3 text-xs text-gray-500">
          * กรุณาเลือกคลังสินค้าก่อน เพื่อเลือกสินค้าและคุมสต็อก
        </div>
      ) : null}
    </Card>
  );
});

export default function InvoiceCreatePage() {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [summary, setSummary] = useState<StockSummaryRow[]>([]);
  const [lines, setLines] = useState<Line[]>([createEmptyLine()]);

  const warehouseId = Form.useWatch("warehouse_id", form) as number | undefined;
  const createAsStatus = Form.useWatch("create_as_status", form);

  const [commUiByKey, setCommUiByKey] = useState<Record<string, CommPercentUI>>(
    {},
  );
  const [commCustomByKey, setCommCustomByKey] = useState<
    Record<string, number>
  >({});

  const setCommUi = useCallback((key: string, v: CommPercentUI) => {
    setCommUiByKey((p) => ({ ...p, [key]: v }));
  }, []);

  const setCommCustom = useCallback((key: string, n: number) => {
    setCommCustomByKey((p) => ({ ...p, [key]: n }));
  }, []);

  async function loadWarehouses() {
    try {
      const { data } = await api.get("/warehouses");
      const list = Array.isArray(data?.warehouses)
        ? data.warehouses
        : Array.isArray(data)
          ? data
          : [];
      setWarehouses(list);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || e?.message || "โหลดคลังสินค้าไม่สำเร็จ",
        2,
      );
    }
  }

  async function loadCustomers() {
    try {
      const { data } = await api.get("/vendors");
      const list = Array.isArray(data) ? data : [];
      setCustomers(list.filter((v: any) => v.type === "CUSTOMER" || v.type === "BOTH"));
    } catch (e: any) {
      message.error("โหลดรายชื่อลูกค้าไม่สำเร็จ", 2);
    }
  }

  async function loadStockSummary() {
    try {
      const { data } = await api.get("/stock/summary");
      setSummary(Array.isArray(data) ? data : []);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || e?.message || "โหลดสต็อกสรุปไม่สำเร็จ",
        2,
      );
    }
  }

  useEffect(() => {
    form.setFieldsValue({
      issue_date: dayjs(),
      note: null,
      seller_id: null,
      valid_until: null,
      warehouse_id: null,
      create_as_status: "QUOTATION",
      stock_deducted_at: "INVOICE",
      customer_id: null,
    });
    loadWarehouses();
    loadCustomers();
    loadStockSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const warehouseOptions: Option[] = useMemo(
    () =>
      warehouses.map((w) => ({
        value: w.id,
        label: `${w.code ? w.code + " - " : ""}${w.name}`,
      })),
    [warehouses],
  );

  const customerOptions: Option[] = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: `${c.code ? c.code + " - " : ""}${c.name}`,
      })),
    [customers],
  );

  const activeWarehouse = useMemo(() => {
    const id = Number(warehouseId || 0);
    if (!id) return null;
    return warehouses.find((w) => Number(w.id) === id) || null;
  }, [warehouseId, warehouses]);

  const stockInSelectedWarehouse = useMemo(() => {
    const whId = Number(warehouseId || 0);
    if (!whId) return [];

    return summary
      .filter((s) => Number(s.warehouse_id) === whId && Number(s.qty || 0) > 0)
      .map((s) => ({
        product_id: Number(s.product_id),
        product_code: s.product_code,
        product_name: s.product_name,
        available: Number(s.qty || 0),
      }))
      .sort((a, b) =>
        (a.product_code || "").localeCompare(b.product_code || ""),
      );
  }, [summary, warehouseId]);

  const availableByProductId = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of stockInSelectedWarehouse) m.set(r.product_id, r.available);
    return m;
  }, [stockInSelectedWarehouse]);

  const productOptions: Option[] = useMemo(() => {
    return stockInSelectedWarehouse.map((p) => ({
      value: p.product_id,
      label: `${p.product_code ? p.product_code + " - " : ""}${p.product_name}`,
    }));
  }, [stockInSelectedWarehouse]);

  const usedByProductId = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of lines) {
      if (!l.product_id) continue;
      const pid = Number(l.product_id);
      m.set(pid, (m.get(pid) || 0) + Number(l.quantity || 0));
    }
    return m;
  }, [lines]);

  const getMaxQtyForLine = useCallback(
    (line: Line) => {
      if (!warehouseId) return 0;
      if (!line.product_id) return 0;
      const pid = Number(line.product_id);

      const have = Number(availableByProductId.get(pid) || 0);
      const usedAll = Number(usedByProductId.get(pid) || 0);
      const usedOtherLines = Math.max(0, usedAll - Number(line.quantity || 0));

      return Math.max(0, have - usedOtherLines);
    },
    [warehouseId, availableByProductId, usedByProductId],
  );

  // init/cleanup comm ui state
  useEffect(() => {
    setCommUiByKey((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const l of lines) {
        if (typeof next[l.key] === "undefined") {
          next[l.key] = commPercentUiFromValue(l.commission_value);
          changed = true;
        }
      }
      for (const k of Object.keys(next)) {
        if (!lines.some((l) => l.key === k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setCommCustomByKey((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const l of lines) {
        const ui = commPercentUiFromValue(l.commission_value);
        if (ui === "CUSTOM" && typeof next[l.key] === "undefined") {
          const n = Number(l.commission_value ?? 0);
          const isPreset = [1, 2, 3, 4, 5].includes(n);
          next[l.key] = isPreset ? 0 : n;
          changed = true;
        }
      }
      for (const k of Object.keys(next)) {
        if (!lines.some((l) => l.key === k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [lines]);

  // เปลี่ยนคลัง -> เคลียร์สินค้าที่ไม่อยู่คลัง + cap qty
  useEffect(() => {
    if (!warehouseId) return;

    setLines((prev) =>
      prev.map((l) => {
        if (!l.product_id) return l;

        const ok = availableByProductId.has(Number(l.product_id));
        if (!ok)
          return recalcLine({
            ...l,
            product_id: undefined,
            product_label: undefined,
          });

        const maxHave = Number(
          availableByProductId.get(Number(l.product_id)) || 0,
        );
        const q = Number(l.quantity || 0);
        const nextQty = q > maxHave ? maxHave : q;
        return recalcLine({ ...l, quantity: nextQty });
      }),
    );
  }, [warehouseId, availableByProductId]);

  const updateLine = useCallback(
    (key: string, patch: Partial<Line>) => {
      setLines((prev) =>
        prev.map((x) => {
          if (x.key !== key) return x;

          let next: Line = { ...x, ...patch };

          if (patch.product_id) {
            const opt = productOptions.find((o) => o.value === patch.product_id);
            next.product_label = opt?.label;
          }

          if (typeof next.quantity !== "undefined" && next.product_id) {
            const max = getMaxQtyForLine({ ...next });
            const q = Math.max(1, Number(next.quantity || 0));
            next.quantity = max ? Math.min(q, max) : q;
          }

          return recalcLine(next);
        }),
      );
    },
    [productOptions, getMaxQtyForLine],
  );

  const addLine = useCallback(() => {
    const nl = createEmptyLine();
    setLines((prev) => [...prev, nl]);
    setCommUiByKey((p) => ({ ...p, [nl.key]: "CUSTOM" }));
    setCommCustomByKey((p) => ({ ...p, [nl.key]: 0 }));
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((x) => x.key !== key));
    setCommUiByKey((p) => {
      const { [key]: _, ...rest } = p;
      return rest;
    });
    setCommCustomByKey((p) => {
      const { [key]: _, ...rest } = p;
      return rest;
    });
  }, []);

  const totals = useMemo(() => calcTotals(lines), [lines]);

  async function onSubmit() {
    const v = await form.validateFields();

    if (!v.warehouse_id) {
      message.error("กรุณาเลือกคลังสินค้า", 2);
      return;
    }

    const whId = Number(v.warehouse_id);

    const items = lines
      .map((l) => ({
        product_id: l.product_id,
        quantity: Number(l.quantity || 0),
        price: Number(l.price || 0),

        discount_percent: Number(l.discount_percent || 0),
        discount_amount: Number(l.discount_amount || 0),
        vat_mode: (l.vat_mode ?? "EXCL") as VatMode,
        vat_rate: Number(l.vat_rate ?? 7),
        commission_mode: (l.commission_mode ?? "PERCENT") as CommMode,
        commission_value: Number(l.commission_value || 0),
        withholding_rate: Number(l.withholding_rate || 0),

        total: Number(l.total || 0),
      }))
      .filter((x) => x.product_id && x.quantity > 0);

    if (items.length === 0) {
      message.error("กรุณาเพิ่มรายการสินค้า", 2);
      return;
    }

    const needByPid = new Map<number, number>();
    for (const it of items) {
      const pid = Number(it.product_id);
      needByPid.set(pid, (needByPid.get(pid) || 0) + Number(it.quantity || 0));
    }

    for (const [pid, need] of needByPid.entries()) {
      const have = Number(availableByProductId.get(pid) || 0);
      if (have < need) {
        const opt = productOptions.find((o) => o.value === pid);
        message.error(
          `สต็อกไม่พอ: ${opt?.label || `product_id=${pid}`} (คงเหลือ ${fmt(
            have,
          )} / ต้องการ ${fmt(need)})`,
          3,
        );
        return;
      }
    }

    // ...
    setSaving(true);
    try {
      const payload = {
        customer_id: v.customer_id,
        seller_id: v.seller_id ?? null,
        warehouse_id: whId,
        issue_date: dayjs(v.issue_date).format("YYYY-MM-DD"),
        valid_until: v.valid_until ? dayjs(v.valid_until).format("YYYY-MM-DD") : null,
        note: v.note ?? null,
        deposit: 0,
        status: v.create_as_status || "QUOTATION",
        stock_deducted_at: v.create_as_status === "QUOTATION" ? "INVOICE" : (v.stock_deducted_at || "INVOICE"),

        subtotal: totals.beforeVat,
        tax: totals.vat,
        total: totals.total,

        items: items.map((x) => ({
          product_id: Number(x.product_id),
          quantity: Number(x.quantity),
          price: Number(x.price),
          total: Number(x.total || Number(x.quantity) * Number(x.price)),

          discount_percent: x.discount_percent,
          discount_amount: x.discount_amount,
          vat_mode: x.vat_mode,
          vat_rate: x.vat_rate,
          commission_mode: x.commission_mode,
          commission_value: x.commission_value,
          withholding_rate: x.withholding_rate,
        })),
      };

      const { data } = await api.post("/sales/invoice", payload);
      const id = Number(data?.id);
      if (!id) throw new Error("Invalid response");

      message.success(`สร้างใบเสนอราคาสำเร็จ: ${data?.quotation_no || ""}`, 2);
      nav(`/sales/invoice/${data.id}`, { replace: true });
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || e?.message || "สร้างใบเสนอราคาไม่สำเร็จ",
        2,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
      <Card title={`สร้างเอกสารขาย ${createAsStatus === "CONFIRMED" ? "(Invoice)" : createAsStatus === "SHIPPED" ? "(Delivery Order)" : "(Quotation)"}`}>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} lg={6}>
              <Form.Item name="create_as_status" label="ประเภทข้อเอกสารที่จะสร้าง">
                <Select
                  options={[
                    { label: "ใบเสนอราคา (Quotation)", value: "QUOTATION" },
                    { label: "ใบแจ้งหนี้ (Invoice)", value: "CONFIRMED" },
                    { label: "ใบส่งของ (Delivery Order)", value: "SHIPPED" },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12} lg={6}>
              <Form.Item
                name="customer_id"
                label="ลูกค้า"
                rules={[{ required: true, message: "เลือกลูกค้า" }]}
              >
                <Select
                  showSearch
                  placeholder="ค้นหาลูกค้า..."
                  optionFilterProp="label"
                  options={customerOptions}
                />
              </Form.Item>
            </Col>
            
            <Col xs={24} md={12} lg={6}>
              <Form.Item
                name="issue_date"
                label="วันที่เอกสาร"
                rules={[{ required: true }]}
              >
                <DatePicker className="w-full" format="YYYY-MM-DD" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12} lg={6}>
              <Form.Item name="valid_until" label="ยืนยันราคาถึง">
                <DatePicker className="w-full" format="YYYY-MM-DD" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item name="seller_id" label="พนักงานขาย">
                 <Input placeholder="เลือกพนักงาน (ถ้ามี)" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="warehouse_id"
                label="คลังสินค้า"
                rules={[{ required: true, message: "เลือกคลัง" }]}
              >
                <Select placeholder="เลือกคลัง" options={warehouseOptions} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              {createAsStatus !== "QUOTATION" && (
                <Form.Item
                  name="stock_deducted_at"
                  label="ตัดสต็อกเมื่อ (Deduct Stock At)"
                >
                  <Select
                    options={[
                      { label: "Invoice (ตัดทันทีเมื่อ Confirm)", value: "INVOICE" },
                      { label: "Shipment (ตัดเมื่อส่งของ)", value: "SHIPMENT" },
                    ]}
                  />
                </Form.Item>
              )}
            </Col>

            <Col xs={24} md={16}>
              <Form.Item name="note" label="หมายเหตุ">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Divider>
            รายการสินค้า
            {activeWarehouse && (
              <Tag className="ml-2">{activeWarehouse.code}</Tag>
            )}
          </Divider>

          {lines.map((line, index) => (
            <LineCard
              key={line.key}
              line={line}
              index={index}
              linesCount={lines.length}
              warehouseId={Number(warehouseId)}
              productOptions={productOptions}
              availableByProductId={availableByProductId}
              usedByProductId={usedByProductId}
              getMaxQtyForLine={getMaxQtyForLine}
              updateLine={updateLine}
              removeLine={removeLine}
              commUi={commUiByKey[line.key] || "CUSTOM"}
              commMode={line.commission_mode || "PERCENT"}
              commCustom={commCustomByKey[line.key]}
              setCommUi={setCommUi}
              setCommCustom={setCommCustom}
            />
          ))}

          <Button type="dashed" onClick={addLine} block className="mb-4">
            + เพิ่มรายการสินค้า
          </Button>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
                <div className="text-gray-400 text-xs mt-2">
                   * รายการสินค้าจะถูกตรวจสอบสต็อกตามคลังที่เลือก
                </div>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" className="bg-gray-50">
                <div className="flex justify-between mb-1">
                  <span>รวมจำนวน</span>
                  <strong>{fmt(totals.qty)}</strong>
                </div>
                <div className="flex justify-between mb-1">
                  <span>รวมก่อนภาษี</span>
                  <strong>{fmt(totals.beforeVat)}</strong>
                </div>
                <div className="flex justify-between mb-1">
                  <span>ภาษีมูลค่าเพิ่ม</span>
                  <strong>{fmt(totals.vat)}</strong>
                </div>
                <Divider className="my-2" />
                <div className="flex justify-between mb-1 text-lg font-bold">
                  <span>รวมทั้งสิ้น</span>
                  <span>{fmt(totals.total)}</span>
                </div>
                <div className="flex justify-between mb-1 text-gray-500">
                  <span>หัก ณ ที่จ่าย (รวม)</span>
                  <span>{fmt(totals.withholdingTotal)}</span>
                </div>
                <Divider className="my-2" />
                <div className="flex justify-between mb-1 font-semibold">
                  <span>ยอดสุทธิ (หลังหัก ณ)</span>
                  <span>{fmt(totals.netAfterWithholding)}</span>
                </div>
              </Card>
            </Col>
          </Row>

          <Divider />

          <Space className="flex justify-end">
            <Button onClick={() => nav("/sales/invoice")}>ยกเลิก</Button>
            <Button type="primary" loading={saving} onClick={form.submit}>
              บันทึก (Create Quotation)
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
