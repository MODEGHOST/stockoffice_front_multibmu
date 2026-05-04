import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Descriptions, Divider, Modal, Space, Tag, Typography, message, Input } from "antd";
import { approveGrn, cancelGrn, getGrn, type GrnDetail } from "./purchaseApi";
import DocumentStepTracker from "./DocumentStepTracker";
import { GrnPrint } from "./GrnPrint";
import { ReloadOutlined } from "@ant-design/icons";
import { getVendor } from "../vendors/vendorApi";
import { getWarehouse } from "../warehouses/warehouseApi";
import { calculateSummary, calcLine } from "./purchaseUtils";

const { Title, Text } = Typography;

function statusTag(s?: string) {
  if (s === "APPROVED") return <Tag color="green">APPROVED</Tag>;
  if (s === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  return <Tag color="gold">DRAFT</Tag>;
}


export default function GrnDetailPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const grnId = Number(id);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GrnDetail | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelStepOpen, setCancelStepOpen] = useState(false);
  const [cancelStepReason, setCancelStepReason] = useState("");
  const [acting, setActing] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const r = await getGrn(grnId);

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
      message.error(e?.response?.data?.message || "โหลด GRN ไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(grnId) || grnId <= 0) return;
    load();
  }, [grnId]);

  const header = data?.header;
  const items = data?.items ?? [];

  const totals = useMemo(() => {
    return calculateSummary(items, header);
  }, [items, header]);

  const canApprove = header?.status === "DRAFT";
  const canCancel = header?.status === "DRAFT" || header?.status === "APPROVED";

  async function onApprove() {
    Modal.confirm({
      title: "Approve GRN?",
      content: "เมื่ออนุมัติแล้ว ระบบจะเพิ่มสต็อก + สร้าง lot และ stock_moves",
      okText: "Approve",
      cancelText: "ยกเลิก",
      centered: true,
      async onOk() {
        try {
          setActing(true);
          await approveGrn(grnId);
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
      await cancelGrn(grnId, reason);
      message.success("ยกเลิก GRN แล้ว", 1.2);
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
      await cancelGrn(grnId, reason);
      setCancelStepOpen(false);
      setCancelStepReason("");
      if (header?.bill_id) {
        message.success("ยกเลิก GRN แล้ว กลับไปหน้า Bill", 1.2);
        nav(`/purchase/bill/${header.bill_id}`);
      } else if (header?.po_id) {
        message.success("ยกเลิก GRN แล้ว กลับไปหน้า PO", 1.2);
        nav(`/purchase/po/${header.po_id}`);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || "ยกเลิกไม่สำเร็จ", 2);
    } finally {
      setActing(false);
    }
  }

  const hasPreviousStep = !!(header?.bill_id || header?.po_id);
  const prevStepLabel = header?.bill_id
    ? `Bill #${header.bill_id}`
    : header?.po_id
      ? `PO #${header.po_id}`
      : "";

  const vendorText = header?.vendor_name ? header.vendor_name : header?.vendor_id ?? "-";
  const whText = header?.warehouse_name ? header.warehouse_name : header?.warehouse_id ?? "-";

  return (
    <div className="space-y-4">

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">
            GRN Detail
          </Title>
          <Text type="secondary">ดูรายละเอียด + Approve/Cancel</Text>
        </div>

        <Space>
          <Button onClick={() => nav("/purchase/grn")}>กลับรายการ</Button>
          <Button type="primary" onClick={() => nav("/purchase/grn/new")}>
            สร้างใหม่
          </Button>
        </Space>
      </div>

      <DocumentStepTracker currentId={grnId} currentType="GRN" />

      <Card loading={loading}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">{header?.grn_no || "-"}</div>
            {statusTag(header?.status)}
          </div>

          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              Refresh
            </Button>
            <GrnPrint data={data!} />
            <Button type="primary" onClick={onApprove} disabled={!canApprove || acting}>
              Approve
            </Button>
            <Button danger onClick={() => setCancelOpen(true)} disabled={!canCancel || acting}>
              Cancel
            </Button>
            {hasPreviousStep && (
              <Button danger onClick={() => setCancelStepOpen(true)} disabled={!canCancel || acting}>
                Cancel Step
              </Button>
            )}
          </Space>
        </div>

        <Descriptions className="mt-4" column={2} bordered size="small">
          <Descriptions.Item label="Issue date">
            {header?.issue_date ? dayjs(header.issue_date).format("DD/MM/YYYY") : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Status">{header?.status || "-"}</Descriptions.Item>

          <Descriptions.Item label="Vendor">{vendorText}</Descriptions.Item>
          <Descriptions.Item label="Warehouse">{whText}</Descriptions.Item>

          <Descriptions.Item label="PO Ref">
              {header?.po_id ? (
                  <a onClick={() => nav(`/purchase/po/${header.po_id}`)} className="text-blue-600 hover:underline cursor-pointer">
                      #{header.po_id} (เปิด PO)
                  </a>
              ) : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Bill Ref">
               {header?.bill_id ? (
                  <a onClick={() => nav(`/purchase/bill/${header.bill_id}`)} className="text-blue-600 hover:underline cursor-pointer">
                      #{header.bill_id} (เปิด Bill)
                  </a>
              ) : "-"}
          </Descriptions.Item>

          <Descriptions.Item label="Note" span={2}>
            {header?.note || "-"}
          </Descriptions.Item>

          <Descriptions.Item label="Cancel reason" span={2}>
            {header?.cancel_reason || "-"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Items + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Card className="lg:col-span-9" title={`รายการสินค้า (${items.length})`}>
             <div className="space-y-3">
                {items.map((it: any, idx: number) => {
                    const r = calcLine(it);
                    return (
                        <div key={idx} className="border rounded-lg p-3 bg-slate-50">
                            <div className="flex justify-between items-start">
                                 <div>
                                    <div className="font-medium text-base">{it.name}</div>
                                    <div className="text-sm text-gray-500">{it.code}</div>
                                 </div>
                                 <div className="text-right">
                                    <div className="font-semibold">{Number(it.qty).toLocaleString()} หน่วย</div>
                                 </div>
                            </div>
                            
                            <Divider className="!my-2" />
                            
                             <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                 <div>
                                    <div className="text-gray-500 text-xs">ต้นทุน/หน่วย</div>
                                    <div>{Number(it.unit_cost).toLocaleString()}</div>
                                 </div>
                                 <div>
                                    <div className="text-gray-500 text-xs">ส่วนลด</div>
                                    {r.discount > 0 ? <div className="text-red-500">-{r.discount.toLocaleString()}</div> : "-"}
                                 </div>
                                 <div>
                                    <div className="text-gray-500 text-xs">ก่อนภาษี ({r.taxType})</div>
                                    <div>{r.beforeTax.toLocaleString()}</div>
                                 </div>
                                 <div>
                                    <div className="text-gray-500 text-xs flex items-center gap-1">
                                        <span>VAT</span>
                                        {it.manual_vat !== undefined && it.manual_vat !== null && String(it.manual_vat) !== '' && (
                                            <span className="text-[10px] text-orange-500 leading-none">*(แก้ไขเอง)*</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span>{r.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <div className="text-gray-500 text-xs">รวม</div>
                                    <div className="font-medium">{r.total.toLocaleString()}</div>
                                 </div>
                            </div>
                        </div>
                    );
                })}
                {!items.length && <div className="text-center text-gray-400 py-4">ไม่มีรายการสินค้า</div>}
             </div>
          </Card>

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
                    
                    {totals.extra > 0 && (
                        <div className="flex justify-between">
                            <div className="text-gray-600">ค่าใช้จ่ายเพิ่มเติม</div>
                            <div className="font-medium">{totals.extra.toLocaleString()}</div>
                        </div>
                    )}
                    
                    {/* Header Discount */}
                    <Divider className="!my-2" />
                    <div>
                        <div className="text-sm font-medium mb-2">ส่วนลดท้ายบิล</div>
                        <div className="flex justify-between">
                            <div className="text-gray-600">
                                {header?.header_discount_type === "PERCENT" ? "อัตรา (%)" : "จำนวน (บาท)"}
                            </div>
                            <div className="font-medium">
                                {header?.header_discount_type === "PERCENT" 
                                    ? `${Number(header?.header_discount_value || 0).toLocaleString()}%`
                                    : Number(header?.header_discount_value || 0).toLocaleString()
                                }
                            </div>
                        </div>
                        <div className="flex justify-between mt-1">
                            <div className="text-gray-600">คิดเป็น</div>
                            <div className="font-medium text-red-500">-{totals.headerDiscount.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="flex justify-between">
                        <div className="text-gray-600">ยอดรวมสุทธิ</div>
                        <div className="text-lg font-semibold">{totals.grandTotal.toLocaleString()}</div>
                    </div>
                     <div className="text-xs text-gray-500 mt-2">
                        * แสดงตามข้อมูลที่บันทึก (ถ้า Backend ยังไม่รองรับ อาจแสดงเป็น 0)
                     </div>
                </div>
          </Card>
      </div>

      <Modal
        open={cancelOpen}
        title="Cancel GRN"
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
        title={`Cancel Step — ยกเลิก GRN และกลับสู่ ${prevStepLabel}`}
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
          GRN นี้จะถูกยกเลิก และระบบจะพาคุณกลับไปหน้า {prevStepLabel}
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
