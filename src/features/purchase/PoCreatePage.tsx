// PoCreatePage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Typography,
  message,
  Divider,
  Radio,
} from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import {
  createPo,
  listProducts,
  listVendors,
  listWarehouses,
  type ProductRow,
  type VendorRow,
  type WarehouseRow,
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

type VendorDetailForPeople = {
  id: number;
  code: string;
  name: string;
  people?: VendorPerson[];
};

type TaxType = "EXCLUDE_VAT_7" | "INCLUDE_VAT_7" | "NO_VAT";

type Line = {
  key: string;
  product_id?: number;
  onhand?: number;
  qty?: number;
  unit_cost?: number;

  discount_pct?: number;
  discount_amt?: number;
  tax_type?: TaxType;
  manual_vat?: number | null;
};



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

export default function PoCreatePage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);

  const [form] = Form.useForm();

  const [lines, setLines] = useState<Line[]>([
    {
      key: crypto.randomUUID(),
      qty: 1,
      unit_cost: 0,
      tax_type: "EXCLUDE_VAT_7",
      discount_pct: 0,
      discount_amt: 0,
    },
  ]);

  // AUTO by default
  const [autoNo, setAutoNo] = useState(true);

  // vendor people
  const [vendorPeople, setVendorPeople] = useState<VendorPerson[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  // address
  const [vendorRegistered, setVendorRegistered] = useState<any>(null);
  const [vendorShipping, setVendorShipping] = useState<any>(null);
  const [vendorGoodsShipping, setVendorGoodsShipping] = useState<any>(null);

  // header discount
  const [headerDiscountType, setHeaderDiscountType] = useState<
    "PERCENT" | "AMOUNT"
  >("AMOUNT");

  async function loadMaster() {
    try {
      setLoading(true);

      const [p, v, w] = await Promise.all([
        listProducts(),
        listVendors(),
        listWarehouses(),
      ]);

      setProducts(p.filter((x) => x.is_active === 1 || (x.is_active as any) === true));
      setVendors(v.filter((x) => (x.is_active === 1 || (x.is_active as any) === true) && (!x.type || x.type === "VENDOR" || x.type === "BOTH")));
      setWarehouses(w.filter((x) => x.is_active === 1 || (x.is_active as any) === true));

      form.setFieldsValue({
        issue_date: dayjs(),
        expected_date: null,
        po_no: "",
        vendor_id: undefined,
        vendor_person_id: undefined,
        warehouse_id: undefined,
        note: null,

        // ✅ ค่าใช้จ่ายเพิ่มเติม (header)
        extra_charge_amt: 0,
        extra_charge_note: null,
      });
    } catch (e: any) {
      message.error(e?.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMaster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function normalizePoNo(v: any) {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    if (!s || s.toLowerCase() === "undefined") return null;
    return s;
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        qty: 1,
        unit_cost: 0,
        tax_type: "EXCLUDE_VAT_7",
        discount_pct: 0,
        discount_amt: 0,
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
        // If changing base amounts and not explicitly setting manual_vat, clear it to force recalculation
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

  async function loadVendorPeople(vendorId: number) {
    setLoadingPeople(true);
    try {
      const { data } = await api.get(`/vendors/${vendorId}`);
      const vd = data as any;

      setVendorRegistered(vd?.registered_address ?? null);
      setVendorShipping(vd?.shipping_address ?? null);
      setVendorGoodsShipping(vd?.goods_shipping_address ?? null);

      const list = Array.isArray(vd?.people) ? vd.people : [];
      const sorted = [...list].sort((a, b) => {
        const ap = Number(a.is_primary ?? 0);
        const bp = Number(b.is_primary ?? 0);
        if (bp !== ap) return bp - ap;
        return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
      });

      setVendorPeople(sorted);

      const primary =
        sorted.find((p) => Number(p.is_primary ?? 0) === 1) || sorted[0];

      form.setFieldsValue({
        vendor_person_id: primary?.id ? Number(primary.id) : undefined,
      });
    } catch (e: any) {
      setVendorPeople([]);
      form.setFieldsValue({ vendor_person_id: undefined });
      message.error(
        e?.response?.data?.message || "โหลดผู้ติดต่อ Vendor ไม่สำเร็จ",
        2,
      );
    } finally {
      setLoadingPeople(false);
    }
  }

  // watch vendor_id -> โหลด vendor_people
  const vendorId = Form.useWatch("vendor_id", form) as number | undefined;

  useEffect(() => {
    if (!vendorId) {
      setVendorPeople([]);
      form.setFieldsValue({ vendor_person_id: undefined });
      return;
    }
    loadVendorPeople(Number(vendorId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  // ✅ watch ค่าใช้จ่ายเพิ่มเติมจาก form
  const extraChargeAmt = Form.useWatch("extra_charge_amt", form) as
    | number
    | undefined;

  const headerDiscountValue = Form.useWatch("header_discount_value", form) as
    | number
    | undefined;

  const summary = useMemo(() => {
    return calculateSummary(lines, {
      extra_charge_amt: extraChargeAmt,
      header_discount_type: headerDiscountType,
      header_discount_value: headerDiscountValue,
    });
  }, [lines, extraChargeAmt, headerDiscountValue, headerDiscountType]);

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
      message.error(
        "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ (เลือกสินค้า/จำนวน/ต้นทุน)",
        2,
      );
      return;
    }

    try {
      setLoading(true);

      const poNo = autoNo ? null : normalizePoNo(v.po_no);
      if (!autoNo && !poNo) {
        message.error("โหมด MANUAL ต้องกรอกเลขที่ PO", 2);
        return;
      }

      const payload: any = {
        vendor_id: Number(v.vendor_id),
        warehouse_id: Number(v.warehouse_id),
        issue_date: dayjs(v.issue_date).format("YYYY-MM-DD"),
        expected_date: v.expected_date
          ? dayjs(v.expected_date).format("YYYY-MM-DD")
          : null,
        note: v.note ? String(v.note) : null,
        items,

        vendor_person_id: v.vendor_person_id
          ? Number(v.vendor_person_id)
          : null,

        // ✅ ค่าใช้จ่ายเพิ่มเติม (header)
        extra_charge_amt: Number(v.extra_charge_amt ?? 0),
        extra_charge_note: v.extra_charge_note
          ? String(v.extra_charge_note)
          : null,
        header_discount_type: headerDiscountType, // "PERCENT" | "AMOUNT"
        header_discount_value: Number(v.header_discount_value ?? 0),
      };

      if (poNo) payload.po_no = poNo;

      const r: any = await createPo(payload);
      message.success(
        `สร้าง PO (DRAFT) แล้ว เลขที่ ${r.po_no ?? ""}`.trim(),
        1.5,
      );
      nav(`/purchase/po/${r.id}`, { replace: true });
    } catch (e: any) {
      message.error(e?.response?.data?.message || "สร้าง PO ไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  const productOptions = useMemo(
    () =>
      products.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
    [products],
  );

  const taxOptions = [
    { value: "EXCLUDE_VAT_7", label: "แยกภาษี 7%" },
    { value: "INCLUDE_VAT_7", label: "รวมภาษี 7%" },
    { value: "NO_VAT", label: "ไม่มีภาษี" },
  ];

  const vendorPeopleOptions = useMemo(() => {
    return vendorPeople
      .filter((p) => Number(p.id) > 0)
      .map((p) => ({
        value: Number(p.id),
        label: personLabel(p),
      }));
  }, [vendorPeople]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">
            สร้าง PO
          </Title>
          <Text type="secondary">
            สร้างใบสั่งซื้อ (DRAFT) ก่อน แล้วค่อย Approve
          </Text>
        </div>

        <Space>
          <Button onClick={() => nav("/purchase/po")}>กลับรายการ</Button>
          <Button type="primary" loading={loading} onClick={submit}>
            บันทึก (DRAFT)
          </Button>
        </Space>
      </div>

      {/* Header Form */}
      <Form form={form} layout="vertical">
        <Card loading={loading}>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Form.Item label="รูปแบบเลขเอกสาร" className="md:col-span-2">
              <Space>
                <Switch
                  checked={autoNo}
                  onChange={(checked) => {
                    setAutoNo(checked);
                    if (checked) form.setFieldsValue({ po_no: "" });
                  }}
                  checkedChildren="AUTO"
                  unCheckedChildren="MANUAL"
                />
                <Text type="secondary">
                  {autoNo ? "ปล่อยว่าง ระบบรันเลขให้" : "กรอกเลขเอง"}
                </Text>
              </Space>
            </Form.Item>

            <Form.Item
              name="po_no"
              label="เลขที่ PO"
              className="md:col-span-2"
              rules={
                autoNo
                  ? []
                  : [
                      {
                        required: true,
                        message: "โหมด MANUAL ต้องกรอกเลขที่ PO",
                      },
                    ]
              }
              extra={
                autoNo ? "โหมด AUTO: ระบบจะสร้างเลขให้เมื่อบันทึก" : undefined
              }
            >
              <Input
                placeholder={autoNo ? "AUTO" : "เช่น PO-2026-0001"}
                disabled={autoNo}
              />
            </Form.Item>

            <Form.Item
              name="issue_date"
              label="วันที่ออก"
              className="md:col-span-1"
              rules={[{ required: true, message: "เลือกวันที่" }]}
            >
              <DatePicker className="w-full" format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item
              name="expected_date"
              label="วันที่คาดว่าจะรับเข้า"
              className="md:col-span-1"
            >
              <DatePicker className="w-full" format="DD/MM/YYYY" />
            </Form.Item>

            {/* Vendor */}
            <Form.Item
              name="vendor_id"
              label="Vendor"
              className="md:col-span-3"
              rules={[{ required: true, message: "เลือก Vendor" }]}
            >
              <Select
                showSearch
                placeholder="เลือกผู้ขาย"
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

            {/* ผู้ติดต่อหลัก */}
            <Form.Item
              name="vendor_person_id"
              label="ผู้ติดต่อหลัก"
              className="md:col-span-3"
              rules={[{ required: true, message: "เลือกผู้ติดต่อหลัก" }]}
              extra="กรุณาเลือก Vendor ก่อน"
            >
              <Select
                loading={loadingPeople}
                disabled={!vendorId}
                placeholder={
                  vendorId ? "เลือกผู้ติดต่อหลัก" : "เลือก Vendor ก่อน"
                }
                optionFilterProp="label"
                showSearch
                options={vendorPeopleOptions}
              />
            </Form.Item>

            {/* ที่อยู่จัดส่งเอกสาร */}
            {vendorShipping && (
              <div className="md:col-span-3">
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

            {/* ที่อยู่จัดส่งสินค้า */}
            {vendorGoodsShipping && (
              <div className="md:col-span-3">
                <Card size="small" title="ที่อยู่จัดส่งสินค้า">
                  <div className="text-sm leading-relaxed">
                    {[
                      vendorGoodsShipping.contact_name,
                       vendorGoodsShipping.phone && `โทร: ${vendorGoodsShipping.phone}`,
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

            {/* ที่อยู่จดทะเบียน */}
            {vendorRegistered && (
              <div className="md:col-span-3">
                <Card size="small" title="ที่อยู่จดทะเบียน">
                  <div className="text-sm leading-relaxed">
                    {[
                      vendorRegistered.contact_name,
                      vendorRegistered.address_line,
                      vendorRegistered.subdistrict &&
                        `ต.${vendorRegistered.subdistrict}`,
                      vendorRegistered.district &&
                        `อ.${vendorRegistered.district}`,
                      vendorRegistered.province &&
                        `จ.${vendorRegistered.province}`,
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
              className="md:col-span-2"
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
          </div>

          <Form.Item name="note" label="หมายเหตุ (ถ้ามี)">
            <Input.TextArea rows={2} />
          </Form.Item>

          <div style={{ display: "none" }}>
            <Form.Item name="extra_charge_amt" initialValue={0}>
              <InputNumber />
            </Form.Item>
            <Form.Item name="extra_charge_note" initialValue={null}>
              <Input />
            </Form.Item>

            <Form.Item name="header_discount_value" initialValue={0}>
              <InputNumber />
            </Form.Item>
          </div>
        </Card>

        {/* Items + Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
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

              {/* ✅ ค่าใช้จ่ายเพิ่มเติมอยู่ท้าย Card นี้ */}
              <Divider className="!my-2" />
              <div>
                <div className="text-sm font-medium mb-2">
                  ค่าใช้จ่ายเพิ่มเติม
                </div>

                <Form.Item
                  name="extra_charge_amt"
                  label="จำนวนเงิน"
                  className="!mb-2"
                >
                  <InputNumber
                    min={0}
                    style={{ width: "100%" }}
                    placeholder="0"
                  />
                </Form.Item>

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
              </div>

              <Divider className="!my-2" />

              <div className="flex justify-between">
                <div className="text-gray-600">ยอดรวมสุทธิ</div>
                <div className="text-lg font-semibold">
                  {summary.grandTotal.toLocaleString()}
                </div>
              </div>

              <div className="text-xs text-gray-500">
                * เลือกคลังเพื่อให้ระบบแสดงคงเหลือ (ถ้าคุณทำ API สต็อกคงเหลือ)
              </div>
            </div>
          </Card>
        </div>
      </Form>
    </div>
  );
}
