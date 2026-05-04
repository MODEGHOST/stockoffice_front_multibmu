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
import { approveBill, cancelBill, getBill, type BillDetail } from "./purchaseApi";
import DocumentStepTracker from "./DocumentStepTracker";
import { BillPrint } from "./BillPrint";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getVendor } from "../vendors/vendorApi";
import { getWarehouse } from "../warehouses/warehouseApi";
import { calculateSummary, calcLine } from "./purchaseUtils";

const { Title, Text } = Typography;



function statusTag(s?: string) {
  if (s === "APPROVED") return <Tag color="green">APPROVED</Tag>;
  if (s === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  return <Tag color="gold">DRAFT</Tag>;
}


const taxOptions = [
  { value: "EXCLUDE_VAT_7", label: "แยกภาษี 7%" },
  { value: "INCLUDE_VAT_7", label: "รวมภาษี 7%" },
  { value: "NO_VAT", label: "ไม่มีภาษี" },
];

function safeDate(v?: string | null) {
  if (!v) return "-";
  const d = dayjs(v);
  return d.isValid() ? d.format("DD/MM/YYYY") : String(v);
}

function splitExtraNote(v?: any): string[] {
  if (v === null || v === undefined) return [];
  const s = String(v).trim();
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export default function BillDetailPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const billId = Number(id);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BillDetail | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelStepOpen, setCancelStepOpen] = useState(false);
  const [cancelStepReason, setCancelStepReason] = useState("");
  const [acting, setActing] = useState(false);


  async function load() {
    try {
      setLoading(true);
      const r = await getBill(billId);

      // Patch missing names if API didn't return them
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
      message.error(e?.response?.data?.message || "โหลด Bill ไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(billId) || billId <= 0) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId]);

  const header: any = data?.header;
  const items = data?.items ?? [];

  const canApprove = header?.status === "DRAFT";
  const canCancel = header?.status === "DRAFT" || header?.status === "APPROVED";
  const canCreateGrn = header?.status === "APPROVED";

  async function onApprove() {
    Modal.confirm({
      title: "Approve Bill?",
      content: "เมื่ออนุมัติแล้ว Bill จะล็อกเป็น APPROVED",
      okText: "Approve",
      cancelText: "ยกเลิก",
      centered: true,
      async onOk() {
        try {
          setActing(true);
          await approveBill(billId);
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
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      message.error("กรอกเหตุผลอย่างน้อย 5 ตัวอักษร", 2);
      return;
    }

    try {
      setActing(true);
      await cancelBill(billId, reason);
      message.success("ยกเลิก Bill แล้ว", 1.2);
      setCancelOpen(false);
      setCancelReason("");
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "ยกเลิกไม่สำเร็จ", 2);
    } finally {
      setActing(false);
    }
  }

  async function onCancelStep() {
    const reason = cancelStepReason.trim();
    if (reason.length < 5) {
      message.error("กรอกเหตุผลอย่างน้อย 5 ตัวอักษร", 2);
      return;
    }

    try {
      setActing(true);
      await cancelBill(billId, reason);
      message.success("ยกเลิก Bill แล้ว กลับไปหน้า PO", 1.2);
      setCancelStepOpen(false);
      setCancelStepReason("");
      nav(`/purchase/po/${header?.po_id}`);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "ยกเลิกไม่สำเร็จ", 2);
    } finally {
      setActing(false);
    }
  }

  // Map Header Fields (Using same logic as PO via utility)
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
            Bill Detail
          </Title>
          <Text type="secondary">ดูรายละเอียด + Approve/Cancel</Text>
        </div>

        <Space>
          <Button onClick={() => nav("/purchase/bill")}>กลับรายการ</Button>
          <Button type="primary" onClick={() => nav("/purchase/bill/new")}>
            สร้างใหม่
          </Button>
        </Space>
      </div>

      <DocumentStepTracker currentId={billId} currentType="BILL" />

      <Card loading={loading}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">{header?.bill_no || "-"}</div>
            {statusTag(header?.status)}
          </div>

          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              Refresh
            </Button>
            <BillPrint data={data!} />
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

            {header?.po_id && (
              <Button
                danger
                onClick={() => setCancelStepOpen(true)}
                disabled={!canCancel || acting}
              >
                Cancel Step
              </Button>
            )}

            <Button
              type="default"
              disabled={!canCreateGrn}
              onClick={() => nav(`/purchase/grn/new?billId=${billId}`)}
            >
              สร้าง GRN จาก Bill
            </Button>
          </Space>
        </div>

        <Descriptions className="mt-4" column={2} bordered size="small">
          <Descriptions.Item label="เลขที่ใบกำกับภาษี">
            {header?.tax_invoice_no || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Issue date">
            {safeDate(header?.issue_date)}
          </Descriptions.Item>
          
          <Descriptions.Item label="Paid date">
            {header?.paid_date ? (
              <Tag color="green">{safeDate(header?.paid_date)}</Tag>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </Descriptions.Item>

          <Descriptions.Item label="PO Ref">
             {header?.po_id ? (
                 <a onClick={() => nav(`/purchase/po/${header.po_id}`)} className="text-blue-600 hover:underline cursor-pointer">
                     #{header.po_id} (เปิด PO)
                 </a>
             ) : "-"}
          </Descriptions.Item>
          
          <Descriptions.Item label="Vendor">
            {header?.vendor_name ?? header?.vendor_id ?? "-"}
          </Descriptions.Item>

          <Descriptions.Item label="Warehouse">
            {header?.warehouse_name ?? header?.warehouse_id ?? "-"}
          </Descriptions.Item>

          <Descriptions.Item label="ผู้ติดต่อหลัก">
             {header?.vendor_person_first_name 
               ? `${header.vendor_person_first_name} ${header.vendor_person_last_name || ""} ${header.vendor_person_phone ? `(${header.vendor_person_phone})` : ""}` 
               : "-"}
          </Descriptions.Item>

          <Descriptions.Item label="Note" span={2}>
            {header?.note || "-"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Items + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Items */}
        <Card className="lg:col-span-9" bodyStyle={{ paddingTop: 12 }}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-semibold text-base">รายการสินค้า</div>
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

                    <div className="md:col-span-4">
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
                </div>
              );
            })}

            {!items.length && (
              <div className="text-sm text-gray-500">ไม่มีรายการสินค้า</div>
            )}
          </div>
        </Card>

        {/* RIGHT: Summary */}
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

            {/* Extra Charge */}
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

            {/* Header Discount */}
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
        title="Cancel Bill"
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

      <Modal
        open={cancelStepOpen}
        title="Cancel Step — ยกเลิก Bill และกลับสู่ PO"
        okText="ยืนยันยกเลิก Step"
        okButtonProps={{ danger: true, loading: acting }}
        onOk={onCancelStep}
        centered
        onCancel={() => {
          setCancelStepOpen(false);
          setCancelStepReason("");
        }}
      >
        <p className="mb-3 text-gray-600">
          Bill นี้จะถูกยกเลิก และระบบจะพาคุณกลับไปหน้า PO #{header?.po_id}
        </p>
        <Input.TextArea
          rows={4}
          value={cancelStepReason}
          onChange={(e) => setCancelStepReason(e.target.value)}
          placeholder="เหตุผล (อย่างน้อย 5 ตัวอักษร)"
        />
      </Modal>
    </div>
  );
}
