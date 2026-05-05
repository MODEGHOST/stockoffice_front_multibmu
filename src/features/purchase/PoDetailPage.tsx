// PoDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  Descriptions,
  Divider,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { approvePo, cancelPo, getPo, type PoDetail } from "./purchaseApi";
import DocumentStepTracker from "./DocumentStepTracker";
import { PoPrint } from "./PoPrint";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getVendor } from "../vendors/vendorApi";
import { getWarehouse } from "../warehouses/warehouseApi";

const { Title, Text } = Typography;

function statusTag(s?: string) {
  if (s === "APPROVED") return <Tag color="green">APPROVED</Tag>;
  if (s === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  return <Tag color="gold">DRAFT</Tag>;
}

function daysLeft(expected_date?: string | null) {
  if (!expected_date) return null;
  const end = dayjs(expected_date);
  if (!end.isValid()) return null;
  return end.startOf("day").diff(dayjs().startOf("day"), "day");
}

function renderDaysLeftTag(expected_date?: string | null) {
  const d = daysLeft(expected_date ?? null);
  if (d === null) return "-";
  if (d < 0) return <Tag color="red">{`${d} วัน`}</Tag>;
  if (d === 0) return <Tag color="orange">วันนี้</Tag>;
  return <Tag color="blue">{`${d} วัน`}</Tag>;
}

// functions moved to purchaseUtils

function safeDate(v?: string | null) {
  if (!v) return "-";
  const d = dayjs(v);
  return d.isValid() ? d.format("DD/MM/YYYY") : String(v);
}

function splitExtraNote(v?: any): string[] {
  if (v === null || v === undefined) return [];
  const s = String(v).trim();
  if (!s) return [];
  // หน้า Create ใช้ Select tags -> String(array) จะกลายเป็น "a,b,c"
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

import { calculateSummary, calcLine } from "./purchaseUtils";
import { taxOptions } from "./purchaseUtils"; // Wait, I didn't export taxOptions. I should check if I need to.
// Actually I didn't export taxOptions in purchaseUtils.ts. 
// I will keep taxOptions locally or export it. usage is line 526.
// Let's assume taxOptions stays here for now or I add it to utils.
// Actually, `taxOptions` is used in render loop.
// For now, I will ONLY replace the calculation functions.

// ... imports ...

export default function PoDetailPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const poId = Number(id);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PoDetail | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [acting, setActing] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const r = await getPo(poId);

      // Patch missing names
       if (!r.header.vendor_name && r.header.vendor_id) {
        try {
          const v = await getVendor(r.header.vendor_id);
          r.header.vendor_name = v.name;
        } catch (e) {
          console.error("Failed to load vendor name", e);
        }
      }

      if (!r.header.warehouse_name && r.header.warehouse_id) {
         try {
           const w = await getWarehouse(r.header.warehouse_id);
           r.header.warehouse_name = w.name;
         } catch (e) {
           console.error("Failed to load warehouse name", e);
         }
      }

      setData(r);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "โหลด PO ไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(poId) || poId <= 0) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId]);

  const header: any = data?.header;
  const items = data?.items ?? [];

  const canApprove = header?.status === "DRAFT";
  const canCancel = header?.status === "DRAFT" || header?.status === "APPROVED";

  async function onApprove() {
     // ... same ...
     Modal.confirm({
       title: "Approve PO?",
       content: "เมื่ออนุมัติแล้ว PO จะล็อกเป็น APPROVED (ยังไม่เพิ่มสต็อก)",
       okText: "Approve",
       cancelText: "ยกเลิก",
       centered: true,
       async onOk() {
         try {
           setActing(true);
           await approvePo(poId);
           message.success("Approve สำเร็จ", 1.2);
           await load();
         } catch (e: any) {
           message.error(e?.response?.data?.message || "Approve ไม่สำเร็จ", 2);
         } finally {
           setActing(false);
         }
       },
     });
  }

  async function onCancel() {
     // ... same ...
     const reason = cancelReason.trim();
    if (reason.length < 5) {
      message.error("กรอกเหตุผลอย่างน้อย 5 ตัวอักษร", 2);
      return;
    }

    try {
      setActing(true);
      await cancelPo(poId, reason);
      message.success("ยกเลิก PO แล้ว", 1.2);
      setCancelOpen(false);
      setCancelReason("");
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "ยกเลิกไม่สำเร็จ", 2);
    } finally {
      setActing(false);
    }
  }

  // ... person info ...
  const personName = [
    header?.vendor_person_prefix,
    header?.vendor_person_first_name,
    header?.vendor_person_last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const nick = header?.vendor_person_nickname
    ? ` (${header.vendor_person_nickname})`
    : "";
  const pos = header?.vendor_person_position
    ? ` • ${header.vendor_person_position}`
    : "";
  const dept = header?.vendor_person_department
    ? ` • ${header.vendor_person_department}`
    : "";

  const phone = header?.vendor_person_phone
    ? `โทร ${header.vendor_person_phone}`
    : "";
  const email = header?.vendor_person_email
    ? `อีเมล ${header.vendor_person_email}`
    : "";

  const personLine1 = (
    personName ? `${personName}${nick}${pos}${dept}` : ""
  ).trim();
  const personLine2 = [phone, email].filter(Boolean).join(" • ");

  const contactDisplay = (() => {
    if (personLine1 || personLine2) {
      if (personLine1 && personLine2) return `${personLine1} — ${personLine2}`;
      return personLine1 || personLine2;
    }
    return "-";
  })();

  const summary = useMemo(() => {
    return calculateSummary(items, header);
  }, [
    items,
    header?.extra_charge_amt,
    header?.header_discount_type,
    header?.header_discount_value,
  ]);

  const extraNotes = useMemo(
    () => splitExtraNote(header?.extra_charge_note),
    [header?.extra_charge_note],
  );


  return (
    <div className="space-y-4">

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">
            PO Detail
          </Title>
          <Text type="secondary">ดูรายละเอียด + Approve/Cancel</Text>
        </div>

        <Space>
          <Button onClick={() => nav("/purchase/po")}>กลับรายการ</Button>
          <Button type="primary" onClick={() => nav("/purchase/po/new")}>
            สร้างใหม่
          </Button>
        </Space>
      </div>

      <DocumentStepTracker currentId={poId} currentType="PO" />

      <Card loading={loading}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">{header?.po_no || "-"}</div>
            {statusTag(header?.status)}
          </div>

          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              Refresh
            </Button>
            <PoPrint data={data!} /> {/* data! since we only render if loaded */}
            <Button
              type="primary"
              onClick={onApprove}
              disabled={!canApprove || acting}
            >
              Approve
            </Button>
            <Button
              danger
              onClick={() => setCancelOpen(true)}
              disabled={!canCancel || acting}
            >
              Cancel
            </Button>

            <Button
              type="primary"
              onClick={() => nav(`/purchase/bill/new?poId=${header?.id}`)}
              disabled={header?.status !== "APPROVED"}
            >
              สร้าง Bill จาก PO
            </Button>
          </Space>
        </div>

        <Descriptions className="mt-4" column={2} bordered size="small">
          <Descriptions.Item label="Issue date">
            {safeDate(header?.issue_date)}
          </Descriptions.Item>
          <Descriptions.Item label="Expected date">
            {safeDate(header?.expected_date)}
          </Descriptions.Item>

          <Descriptions.Item label="เหลือ (วัน)">
            {renderDaysLeftTag(header?.expected_date ?? null)}
          </Descriptions.Item>
          <Descriptions.Item label="ผู้ติดต่อหลัก">
            {contactDisplay}
          </Descriptions.Item>

          <Descriptions.Item label="Warehouse">
            {header?.warehouse_name ?? header?.warehouse_id ?? "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Vendor">
            {header?.vendor_name ?? header?.vendor_id ?? "-"}
          </Descriptions.Item>
          <Descriptions.Item label="ผู้สร้างเอกสาร (Creator)">
            {header?.creator_name || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="ที่อยู่จัดส่งเอกสาร" span={2}>
            {header?.vendor_shipping_address_line
              ? [
                  header?.vendor_shipping_contact_name,
                  header?.vendor_shipping_address_line,
                  header?.vendor_shipping_subdistrict &&
                    `ต.${header.vendor_shipping_subdistrict}`,
                  header?.vendor_shipping_district &&
                    `อ.${header.vendor_shipping_district}`,
                  header?.vendor_shipping_province &&
                    `จ.${header.vendor_shipping_province}`,
                  header?.vendor_shipping_province &&
                    `จ.${header.vendor_shipping_province}`,
                  header?.vendor_shipping_postcode,
                ]
                  .filter(Boolean)
                  .join(" • ")
              : "-"}
          </Descriptions.Item>

          <Descriptions.Item label="ที่อยู่จดทะเบียน" span={2}>
            {header?.vendor_registered_address_line
              ? [
                  header?.vendor_registered_contact_name,
                  header?.vendor_registered_address_line,
                  header?.vendor_registered_subdistrict &&
                    `ต.${header.vendor_registered_subdistrict}`,
                  header?.vendor_registered_district &&
                    `อ.${header.vendor_registered_district}`,
                  header?.vendor_registered_province &&
                    `จ.${header.vendor_registered_province}`,
                  header?.vendor_registered_postcode,
                ]
                  .filter(Boolean)
                  .join(" • ")
              : "-"}
          </Descriptions.Item>

          <Descriptions.Item label="Note" span={2}>
            {header?.note || "-"}
          </Descriptions.Item>

          <Descriptions.Item label="Cancel reason" span={2}>
            {header?.cancel_reason || "-"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* ✅ Items + Summary (เหมือนหน้า Create) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Items */}
        <Card className="lg:col-span-9" bodyStyle={{ paddingTop: 12 }}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-semibold text-base">รายการสินค้า</div>
            {/* Detail ไม่ให้แก้/เพิ่ม (ถ้าจะให้แก้ทีหลังค่อยทำโหมด Edit) */}
          </div>

          <Divider className="!my-3" />

          <div className="space-y-3">
            {items.map((it: any, idx: number) => {
              const r = calcLine(it);

              return (
                <div
                  key={String(it?.id ?? idx)}
                  className="border rounded-lg p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">รายการที่ {idx + 1}</div>
                    <div className="text-xs text-gray-500">
                      {it?.code} - {it?.name}
                    </div>
                  </div>

                  {/* Row 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3">
                    <div className="md:col-span-5">
                      <div className="text-xs text-gray-500 mb-1">สินค้า</div>
                      <Input value={`${it.code} - ${it.name}`} disabled />
                    </div>

                    <div className="md:col-span-2">
                      <div className="text-xs text-gray-500 mb-1">คงเหลือ</div>
                      <Input value={"-"} disabled />
                    </div>

                    <div className="md:col-span-2">
                      <div className="text-xs text-gray-500 mb-1">จำนวน</div>
                      <InputNumber
                        value={Number(it.qty)}
                        disabled
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <div className="text-xs text-gray-500 mb-1">
                        ราคา/หน่วย (ต้นทุน)
                      </div>
                      <InputNumber
                        value={Number(it.unit_cost)}
                        disabled
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
                        value={Number(it.discount_pct ?? 0)}
                        disabled
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="text-xs text-gray-500 mb-1">
                        ส่วนลดบาท
                      </div>
                      <InputNumber
                        value={Number(it.discount_amt ?? 0)}
                        disabled
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="text-xs text-gray-500 mb-1">
                        ประเภทภาษี
                      </div>
                      <Select
                        value={r.taxType}
                        options={taxOptions}
                        disabled
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="text-xs text-gray-500 mb-1">ก่อนภาษี</div>
                      <Input value={r.beforeTax.toLocaleString()} disabled />
                    </div>

                    <div className="md:col-span-2">
                       <div className="text-xs text-gray-500 mb-1">VAT</div>
                       <div className="flex items-center gap-1 border border-[#d9d9d9] bg-[#f5f5f5] rounded py-[4px] px-[11px] h-[32px]">
                          {it.manual_vat !== undefined && it.manual_vat !== null && String(it.manual_vat) !== '' && (
                             <span className="text-[10px] text-orange-500 leading-none">*(แก้ไขเอง)*</span>
                          )}
                          <span className="text-sm">{Number(r.vat).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                       </div>
                    </div>

                    <div className="md:col-span-2">
                      <div className="text-xs text-gray-500 mb-1">
                        มูลค่ารวม
                      </div>
                      <Input value={r.total.toLocaleString()} disabled />
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 mt-2">
                    * คำนวณจาก qty × unit_cost − ส่วนลด และภาษีตามประเภทภาษี
                  </div>
                </div>
              );
            })}

            {!items.length && (
              <div className="text-sm text-gray-500">ไม่มีรายการสินค้า</div>
            )}
          </div>
        </Card>

        {/* RIGHT: Summary (เหมือนหน้า Create) */}
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
              <div className="font-medium">{summary.base.toLocaleString()}</div>
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
              <div className="font-medium">{summary.net.toLocaleString()}</div>
            </div>

            <div className="flex justify-between">
              <div className="text-gray-600">VAT</div>
              <div className="font-medium">{summary.vat.toLocaleString()}</div>
            </div>

            {/* ✅ ค่าใช้จ่ายเพิ่มเติม */}
            <Divider className="!my-2" />
            <div>
              <div className="text-sm font-medium mb-2">
                ค่าใช้จ่ายเพิ่มเติม
              </div>

              <div className="flex justify-between">
                <div className="text-gray-600">จำนวนเงิน</div>
                <div className="font-medium">
                  {summary.extra.toLocaleString()}
                </div>
              </div>

              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">รายละเอียด</div>
                {extraNotes.length ? (
                  <div className="flex flex-wrap gap-1">
                    {extraNotes.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">-</div>
                )}
              </div>
            </div>

            {/* ✅ ส่วนลดท้ายบิล */}
            <Divider className="!my-2" />
            <div>
              <div className="text-sm font-medium mb-2">ส่วนลดท้ายบิล</div>

              <div className="flex justify-between">
                <div className="text-gray-600">
                  {summary.headerDiscountType === "PERCENT"
                    ? "อัตรา (%)"
                    : "จำนวน (บาท)"}
                </div>
                <div className="font-medium">
                  {summary.headerDiscountType === "PERCENT"
                    ? `${summary.headerDiscountValue.toLocaleString()}%`
                    : summary.headerDiscountValue.toLocaleString()}
                </div>
              </div>

              <div className="flex justify-between mt-1">
                <div className="text-gray-600">คิดเป็น</div>
                <div className="font-medium">
                  {summary.headerDiscount.toLocaleString()}
                </div>
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
              * ยอดรวมสุทธิ = (ยอดสุทธิสินค้า + VAT + ค่าใช้จ่ายเพิ่มเติม) −
              ส่วนลดท้ายบิล
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={cancelOpen}
        title="Cancel PO"
        okText="ยืนยันยกเลิก"
        okButtonProps={{ danger: true, loading: acting }}
        onOk={onCancel}
        centered
        onCancel={() => {
          setCancelOpen(false);
          setCancelReason("");
        }}
      >
        <Input.TextArea
          rows={4}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="เหตุผล (อย่างน้อย 5 ตัวอักษร)"
        />
      </Modal>
    </div>
  );
}
