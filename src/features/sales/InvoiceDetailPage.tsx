import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
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
  Row,
  Col,
} from "antd";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import api from "../../lib/api";
import { type Line, recalcLine, calcTotals, fmt } from "./invoiceCalc";
import SalesStepTracker from "./SalesStepTracker";
import { ReloadOutlined } from "@ant-design/icons";
import { InvoicePrintButton } from "./InvoicePrintButton";
import { financeApi, type FinanceAccount } from "../finance/financeApi";

const { Title, Text } = Typography;

type Header = {
  id: number;
  quotation_no: string;
  quotation_date: string;
  invoice_no: string | null;
  delivery_no: string | null;
  delivery_date: string | null;

  receipt_no: string | null;
  receipt_date: string | null;
  tax_invoice_no: string | null;
  tax_invoice_date: string | null;

  status: "QUOTATION" | "DRAFT" | "CONFIRMED" | "SHIPPED" | "CANCELLED";
  issue_date: string;
  valid_until: string | null;
  note: string | null;

  subtotal: number;
  tax: number;
  total: number;
  grand_total?: number; // In case we add discount logic later
  paid_amount?: number;
  balance_due?: number;
  payment_status?: "UNPAID" | "PARTIAL" | "PAID";

  deposit: number;
  stock_deducted_at: "INVOICE" | "SHIPMENT" | "MANUAL";
  cogs_total: number;

  seller_id: number | null;
  warehouse_id: number;

  created_at: string;
  confirmed_at: string | null;
  shipped_at?: string | null;
  approved_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;

  // Extra fields for display if joined (or we fetch separately)
  customer_name?: string;
  warehouse_name?: string;
};

type Item = {
  id: number;
  product_id: number;
  code?: string;
  name: string;

  quantity: number;
  price: number;

  discount_percent: number;
  discount_amount: number;

  vat_mode: "EXCL" | "INCL" | "NONE";
  vat_rate: number;

  commission_mode: "PERCENT" | "AMOUNT";
  commission_value: number;

  withholding_rate: number;

  total: number;
  cogs_total: number;
  
  // Calculated fields
  commission_per_unit?: number;
  commission_total?: number;
  withholding_amount?: number;
  amount_before_vat?: number;
};

function statusTag(s: Header["status"]) {
  if (s === "QUOTATION") return <Tag color="gold">DRAFT</Tag>; // Display as DRAFT
  if (s === "CONFIRMED") return <Tag color="green">APPROVED</Tag>; // Display as APPROVED
  if (s === "SHIPPED") return <Tag color="blue">COMPLETED</Tag>; // Display as COMPLETED
  if (s === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  return <Tag>{s}</Tag>;
}

function safeDate(v?: string | null) {
  if (!v) return "-";
  const d = dayjs(v);
  return d.isValid() ? d.format("DD/MM/YYYY") : String(v);
}

export default function InvoiceDetailPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const saleId = Number(id);

  const [loading, setLoading] = useState(false);
  const [header, setHeader] = useState<Header | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [modal, contextHolder] = Modal.useModal();
  
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [acting, setActing] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStockDeductAt, setConfirmStockDeductAt] = useState<"INVOICE" | "SHIPMENT">("INVOICE");
  const [issueTax, setIssueTax] = useState(false);

  // Payment State
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState<number | undefined>(undefined);
  const [paymentIssueTax, setPaymentIssueTax] = useState(false);

  // Computed permissions
  const canConfirm = header?.status === "QUOTATION" || header?.status === "DRAFT";
  const canShip = header?.status === "CONFIRMED";
  const canCancel =
    header?.status === "QUOTATION" ||
    header?.status === "DRAFT" ||
    header?.status === "CONFIRMED" ||
    header?.status === "SHIPPED";
  const canReceivePayment = header?.status === "CONFIRMED" || header?.status === "SHIPPED";
  const canIssueTax = header?.status === "CONFIRMED" || header?.status === "SHIPPED";

  async function load() {
    if (!saleId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/sales/invoice/${saleId}`);
      setHeader(data?.header || null);
      setItems(Array.isArray(data?.items) ? data.items : []);

      const fAccs = await financeApi.list();
      setFinanceAccounts(fAccs.filter(a => a.is_active));
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "โหลดใบขายไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  async function postAction(path: string, body?: unknown) {
    const { data } = await api.post(path, body ?? {});
    return data;
  }

  async function onConfirm() {
    if (!header) return;
    setIssueTax(false); // Reset to default when opening a new modal
    setConfirmOpen(true);
  }

  async function handleConfirmSubmit() {
    if (!header) return;
    try {
      setActing(true);
      const res = await postAction(`/sales/invoice/${saleId}/confirm`, {
        stock_deducted_at: confirmStockDeductAt,
        issue_tax: issueTax
      });
      message.success(`ยืนยันสำเร็จ: ${res.invoice_no}`, 2);
      setConfirmOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "ยืนยันไม่สำเร็จ", 2);
    } finally {
      setActing(false);
    }
  }

  async function onShip() {
    if (!header) return;
    const willDeduct = header.stock_deducted_at === "SHIPMENT";
    let wantTax = false;
    
    // Custom modal content with Checkbox
    const ok = await new Promise((resolve) => {
      let currentTaxOption = false;
      modal.confirm({
        title: "Ship Goods (Delivery Note)",
        content: (
          <div className="mt-2">
            <p className="mb-3">
               ต้องการเปลี่ยนสถานะเป็น SHIPPED และออกเลข DO ใช่ไหม? {willDeduct ? "(จะตัดสต็อกในขั้นตอนนี้)" : ""}
            </p>
            {!header.tax_invoice_no && (
              <Checkbox onChange={(e) => (currentTaxOption = e.target.checked)}>
                ออกใบกำกับภาษีพร้อมกัน (DO/TAX)
              </Checkbox>
            )}
          </div>
        ),
        okText: "Ship",
        cancelText: "ยกเลิก",
        centered: true,
        onOk: () => {
           wantTax = currentTaxOption;
           resolve(true);
        },
        onCancel: () => resolve(false)
      });
    });
    
    if (!ok) return;

    try {
      setActing(true);
      const res = await postAction(`/sales/invoice/${saleId}/ship`, { issue_tax: wantTax });
      message.success(`จัดส่งสำเร็จ: ${res.delivery_no}`, 2);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "จัดส่งไม่สำเร็จ", 2);
    } finally {
      setActing(false);
    }
  }

  async function onCancel() {
    if (!header) return;
    try {
      if ((cancelReason || "").trim().length < 5) {
        message.error("กรุณากรอกเหตุผลอย่างน้อย 5 ตัวอักษร", 2);
        return;
      }
      setActing(true);
      await postAction(`/sales/invoice/${saleId}/cancel`, { reason: cancelReason.trim() });
      message.success("ยกเลิกสำเร็จ", 2);
      setCancelOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "ยกเลิกไม่สำเร็จ", 2);
    } finally {
      setActing(false);
    }
  }

  async function onPayment() {
    if (!header) return;
    setPaymentIssueTax(false);
    setPaymentAccountId(undefined);
    setPaymentOpen(true);
  }

  async function handlePaymentSubmit() {
    if (!header) return;
    if (!paymentAccountId) {
       message.error("กรุณาเลือกช่องทางการรับเงิน");
       return;
    }
    try {
      setActing(true);
      const res = await postAction(`/sales/invoice/${saleId}/payment`, { 
        issue_tax: paymentIssueTax,
        finance_account_id: paymentAccountId
      });
      message.success(`ออกใบเสร็จสำเร็จ: ${res.receipt_no}`, 2);
      setPaymentOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "ทำรายการไม่สำเร็จ", 2);
    } finally {
      setActing(false);
    }
  }

  async function onTaxInvoice() {
    if (!header) return;
    const ok = await modal.confirm({
      title: "Issue Tax Invoice",
      content: "ยืนยันการออกใบกำกับภาษีเต็มรูป (Tax-xxxx)?",
      okText: "Issue Tax",
      cancelText: "ยกเลิก",
      centered: true,
    });
    if (!ok) return;

    try {
      setActing(true);
      const res = await postAction(`/sales/invoice/${saleId}/tax-invoice`);
      message.success(`ออกใบกำกับสำเร็จ: ${res.tax_invoice_no}`, 2);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "ทำรายการไม่สำเร็จ", 2);
    } finally {
      setActing(false);
    }
  }

  const computedLines: Line[] = useMemo(() => {
    return items.map((it) =>
      recalcLine({
        key: String(it.id),
        product_id: it.product_id,
        product_label: `${it.code ? it.code + " - " : ""}${it.name}`,
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
        discount_percent: Number(it.discount_percent || 0),
        discount_amount: Number(it.discount_amount || 0),
        vat_mode: (it.vat_mode || "EXCL") as any,
        vat_rate: Number(it.vat_rate ?? 7),
        commission_mode: (it.commission_mode || "PERCENT") as any,
        commission_value: Number(it.commission_value || 0),
        withholding_rate: Number(it.withholding_rate || 0),
      }),
    );
  }, [items]);

  const totals = useMemo(() => calcTotals(computedLines), [computedLines]);

  return (
    <div className="space-y-4">
      {contextHolder}
      
      {/* Header Section */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">
             {header?.invoice_no ? "รายละเอียดใบแจ้งหนี้ (Invoice)" : "รายละเอียดใบเสนอราคา (Quotation)"}
          </Title>
          <Text type="secondary">ดูรายละเอียด + อนุมัติ/ยกเลิก</Text>
        </div>

        <Space>
           {/* Back button goes back in history */}
           <Button onClick={() => nav(-1)}>กลับ</Button>
           <Button type="primary" onClick={() => nav("/sales/invoice/new")}>สร้างใหม่</Button>
        </Space>
      </div>

      <SalesStepTracker header={header} />

      <Card loading={loading}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
             <div className="flex items-center gap-2">
                 <div className="text-lg font-semibold">
                    {header?.invoice_no || header?.quotation_no || "-"}
                 </div>
                 {header ? statusTag(header.status) : null}
                 {header?.payment_status === 'PAID' && <Tag color="green">PAID</Tag>}
                 {header?.payment_status === 'PARTIAL' && <Tag color="orange">PARTIAL</Tag>}
                 {header?.payment_status === 'UNPAID' && <Tag color="default">UNPAID</Tag>}
             </div>

             <Space>
                <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                   Refresh
                </Button>

                {/* Print Button Component */}
                <InvoicePrintButton header={header} items={items} />
                 
                {/* Approve / Confirm Button */}
                <Button 
                   type="primary" 
                   onClick={onConfirm} 
                   disabled={!canConfirm || acting}
                   className={canConfirm ? "bg-blue-600" : ""}
                >
                   อนุมัติ (Approve)
                </Button>

                {/* Cancel Button */}
                <Button 
                   danger 
                   onClick={() => setCancelOpen(true)} 
                   disabled={!canCancel || acting}
                >
                   ยกเลิก (Cancel)
                </Button>

                {/* Create DO (Ship) */}
                <Button 
                   type="primary"
                   className="bg-green-600 hover:bg-green-500" 
                   onClick={onShip} 
                   disabled={!canShip || acting}
                >
                   สร้างใบส่งของ (DO)
                </Button>

                {/* Deduct Stock (Manual) */}
                 {header?.status === "CONFIRMED" && header?.stock_deducted_at === "SHIPMENT" && (
                  <Button 
                    className="bg-orange-600 hover:bg-orange-500 text-white" 
                    onClick={async () => {
                      const ok = await modal.confirm({
                        title: "Deduct Stock",
                        content: "ตัดสต็อกแบบแมนนวลสำหรับรายการนี้ทันที?",
                        okText: "Deduct",
                        cancelText: "ยกเลิก",
                        centered: true,
                      });
                      if (!ok) return;
                      try {
                        setActing(true);
                        await postAction(`/sales/invoice/${saleId}/deduct-stock`);
                        message.success("สั่งตัดสต็อกสำเร็จ", 2);
                        load();
                      } catch (e: any) {
                        message.error(e?.response?.data?.message || e?.message || "ตัดสต็อกไม่สำเร็จ", 2);
                      } finally {
                        setActing(false);
                      }
                    }} 
                    disabled={acting}
                  >
                    ตัดสต็อก (Manual)
                  </Button>
                )}

                {/* Receive Payment */}
                 <Button 
                    className="bg-purple-600 hover:bg-purple-500 text-white" 
                    onClick={onPayment} 
                    disabled={!canReceivePayment || !!header?.receipt_no || acting}
                >
                    รับชำระเงิน (RE)
                </Button>

                {/* Tax Invoice */}
                <Button 
                    className="bg-cyan-600 hover:bg-cyan-500 text-white" 
                    onClick={onTaxInvoice} 
                    disabled={!canIssueTax || !!header?.tax_invoice_no || acting}
                >
                    ใบกำกับภาษี (TAX)
                </Button>
             </Space>
          </div>

          <Descriptions className="mt-4" column={2} bordered size="small">
              <Descriptions.Item label="เลขที่ใบเสนอราคา (QT)">{header?.quotation_no}</Descriptions.Item>
              <Descriptions.Item label="วันที่เสนอราคา">{safeDate(header?.quotation_date)}</Descriptions.Item>
              
              <Descriptions.Item label="เลขที่ใบแจ้งหนี้ (IV)">{header?.invoice_no || "-"}</Descriptions.Item>
              <Descriptions.Item label="วันที่ออกใบแจ้งหนี้">{safeDate(header?.issue_date)}</Descriptions.Item>
              
              <Descriptions.Item label="เลขที่ใบส่งของ (DO)">{header?.delivery_no || "-"}</Descriptions.Item>
              <Descriptions.Item label="เลขที่ใบเสร็จรับเงิน (RE)">{header?.receipt_no || "-"}</Descriptions.Item>
              
              <Descriptions.Item label="เลขที่ใบกำกับภาษี (TAX)">{header?.tax_invoice_no || "-"}</Descriptions.Item>
              <Descriptions.Item label="ยืนราคาถึงวันที่">{safeDate(header?.valid_until)}</Descriptions.Item>

              <Descriptions.Item label="การตัดสต็อก">
                 {header?.stock_deducted_at === "INVOICE" 
                   ? <Tag color="orange">เมื่อออกใบแจ้งหนี้ (IV)</Tag> 
                   : header?.stock_deducted_at === "MANUAL"
                   ? <Tag color="magenta">แมนนวลโดยผู้ใช้ (MANUAL)</Tag>
                   : <Tag color="cyan">เมื่อออกใบส่งของ (DO)</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="คลังสินค้า (Warehouse)">{header?.warehouse_id}</Descriptions.Item>
              
              <Descriptions.Item label="หมายเหตุ" span={2}>{header?.note || "-"}</Descriptions.Item>
              {header?.cancel_reason && <Descriptions.Item label="เหตุผลที่ยกเลิก" span={2} contentStyle={{ color: "red" }}>{header.cancel_reason}</Descriptions.Item>}
          </Descriptions>
      </Card>

      {/* Items & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
         {/* Left: Items */}
         <Card className="lg:col-span-9" bodyStyle={{ paddingTop: 12 }}>
             <div className="font-semibold text-base mb-3">รายการสินค้า</div>
             <Divider className="!my-3" />
             <div className="space-y-3">
                 {computedLines.map((line, idx) => {
                   const vatUiStr = line.vat_mode === "NONE" ? "ไม่มี VAT" : line.vat_mode === "EXCL" && line.vat_rate === 0 ? "VAT 0%" : line.vat_mode === "INCL" ? "รวมภาษี 7%" : "แยกภาษี 7%";
                   const commModeStr = line.commission_mode === "PERCENT" ? "เปอร์เซ็นต์" : "จำนวนเงิน";

                   return (
                    <div key={line.key} className="border rounded-lg p-3 bg-white">
                        <div className="font-medium mb-3 text-gray-700">รายการที่ {idx + 1}</div>

                        {/* Row 1 */}
                        <Row gutter={[16, 16]}>
                          <Col xs={24} lg={12} xl={11}>
                            <div className="text-xs text-gray-500 mb-1">สินค้า</div>
                            <Input value={line.product_label} readOnly />
                          </Col>
                          <Col xs={12} lg={4} xl={4}>
                            <div className="text-xs text-gray-500 mb-1">คงเหลือ</div>
                            <Input value="-" disabled />
                          </Col>
                          <Col xs={12} lg={4} xl={4}>
                            <div className="text-xs text-gray-500 mb-1">จำนวน</div>
                            <InputNumber value={line.quantity} readOnly className="w-full" />
                          </Col>
                          <Col xs={12} lg={4} xl={5}>
                            <div className="text-xs text-gray-500 mb-1">ราคา/หน่วย</div>
                            <InputNumber value={line.price} readOnly className="w-full" />
                          </Col>
                        </Row>

                        <Divider className="!my-4" />

                        {/* Row 2 */}
                        <Row gutter={[16, 16]} align="middle">
                          <Col xs={24} xl={16}>
                            <Row gutter={[16, 16]}>
                              <Col xs={12} md={6}>
                                <div className="text-xs text-gray-500 mb-1">ส่วนลด (%)</div>
                                <InputNumber value={line.discount_percent} readOnly className="w-full" />
                              </Col>
                              <Col xs={12} md={6}>
                                <div className="text-xs text-gray-500 mb-1">ส่วนลดบาท</div>
                                <InputNumber value={line.discount_amount} readOnly className="w-full" />
                              </Col>
                              <Col xs={24} md={12}>
                                <div className="text-xs text-gray-500 mb-1">ประเภทภาษี</div>
                                <Input value={vatUiStr} readOnly className="w-full" />
                              </Col>
                            </Row>
                          </Col>
                          <Col xs={24} xl={8}>
                            <Row gutter={[16, 16]}>
                              <Col xs={12}>
                                <div className="text-xs text-gray-500 mb-1">ก่อนภาษี</div>
                                <Input value={fmt(line.amount_before_vat || 0)} readOnly />
                              </Col>
                              <Col xs={12}>
                                <div className="text-xs text-gray-500 mb-1">มูลค่ารวม</div>
                                <Input value={fmt(line.total || 0)} readOnly />
                              </Col>
                            </Row>
                          </Col>
                        </Row>

                        <Divider className="!my-4" />

                        {/* Row 3 */}
                        <Row gutter={[16, 16]}>
                          <Col xs={24}>
                            <Row gutter={[16, 16]}>
                              <Col xs={24} md={8}>
                                <div className="text-xs text-gray-500 mb-1">ประเภทคอม</div>
                                <Input value={commModeStr} readOnly className="w-full" />
                              </Col>
                              <Col xs={24} md={16}>
                                <div className="text-xs text-gray-500 mb-1">ตั้งค่า % / เงิน</div>
                                <InputNumber 
                                  value={line.commission_value} 
                                  readOnly 
                                  addonAfter={line.commission_mode === "PERCENT" ? "%" : "บาท"} 
                                  className="w-full" 
                                />
                              </Col>
                            </Row>
                          </Col>
                        </Row>

                        <Row gutter={[16, 16]} className="mt-3">
                          <Col xs={24}>
                            <Row gutter={[16, 16]}>
                              <Col xs={12} md={6}>
                                <div className="text-xs text-gray-500 mb-1">คอม/หน่วย</div>
                                <Input value={fmt(line.commission_per_unit || 0)} readOnly />
                              </Col>
                              <Col xs={12} md={6}>
                                <div className="text-xs text-gray-500 mb-1">คอมรวม</div>
                                <Input value={fmt(line.commission_total || 0)} readOnly />
                              </Col>
                              <Col xs={12} md={6}>
                                <div className="text-xs text-gray-500 mb-1">หัก ณ (%)</div>
                                <InputNumber value={line.withholding_rate} readOnly className="w-full" />
                              </Col>
                              <Col xs={12} md={6}>
                                <div className="text-xs text-gray-500 mb-1">หัก ณ (บาท)</div>
                                <Input value={fmt(line.withholding_amount || 0)} readOnly />
                              </Col>
                            </Row>
                          </Col>
                        </Row>

                    </div>
                 );
                 })}
                 {!computedLines.length && <div className="text-gray-500">ไม่มีรายการสินค้า</div>}
             </div>
         </Card>

         {/* Right: Summary */}
         <Card className="lg:col-span-3" title="สรุปข้อมูล">
             <div className="space-y-3">
                 <div className="flex justify-between">
                     <Text type="secondary">รวมจำนวน</Text>
                     <div className="font-medium">{fmt(totals.qty)}</div>
                 </div>
                 <div className="flex justify-between">
                     <Text type="secondary">รวมก่อนภาษี</Text>
                     <div className="font-medium">{fmt(totals.beforeVat)}</div>
                 </div>
                 <div className="flex justify-between">
                     <Text type="secondary">ภาษีมูลค่าเพิ่ม</Text>
                     <div className="font-medium">{fmt(totals.vat)}</div>
                 </div>
                 <Divider className="!my-2" />
                 <div className="flex justify-between">
                     <Text type="secondary">ยอดรวมสุทธิ</Text>
                     <div className="text-lg font-semibold">{fmt(totals.total)}</div>
                 </div>
                 <div className="flex justify-between">
                     <Text type="secondary">หัก ณ ที่จ่าย</Text>
                     <div className="font-medium">{fmt(totals.withholdingTotal)}</div>
                 </div>
                 <Divider className="!my-2" />
                   <div className="flex justify-between">
                     <Text type="secondary">ยอดสุทธิหลังหัก ณ</Text>
                     <div className="text-lg font-semibold text-green-700">{fmt(totals.netAfterWithholding)}</div>
                 </div>
                 <Divider className="!my-2" />
                 <div className="flex justify-between">
                     <Text type="secondary">ชำระแล้ว (Paid Amount)</Text>
                     <div className="font-medium text-blue-600">{fmt(header?.paid_amount ?? 0)}</div>
                 </div>
                 <div className="flex justify-between">
                     <Text type="secondary">ยอดคงค้าง (Balance Due)</Text>
                     <div className="text-lg font-semibold text-red-600">{fmt(header?.balance_due ?? totals.netAfterWithholding)}</div>
                 </div>
             </div>
         </Card>
      </div>

      <Modal
        open={confirmOpen}
        title="Approve Sale (Confirm to Invoice)"
        okText="Approve"
        okButtonProps={{ loading: acting }}
        onOk={handleConfirmSubmit}
        centered
        onCancel={() => setConfirmOpen(false)}
      >
        <div className="space-y-4 py-2">
          <p>เปลี่ยนสถานะเป็น CONFIRMED และออกเลข IV</p>
          <div>
            <div className="mb-1 text-sm">ตัดสต็อกเมื่อ (Deduct Stock At)</div>
            <Select
              className="w-full"
              value={confirmStockDeductAt}
              onChange={setConfirmStockDeductAt}
              options={[
                { label: "Invoice (ตัดทันทีเมื่อ Confirm)", value: "INVOICE" },
                { label: "Shipment (ตัดเมื่อส่งของ)", value: "SHIPMENT" },
              ]}
            />
          </div>
          {confirmStockDeductAt === "INVOICE" ? (
             <p className="text-orange-500 text-sm">ระบบจะทำการตัดสต็อกทันทีหลังกดยืนยัน</p>
          ) : (
             <p className="text-cyan-500 text-sm">ระบบจะยังไม่ตัดสต็อกตอนนี้ (จะตัดเมื่อส่งของมาถึงหน้า DO)</p>
          )}

          {!header?.tax_invoice_no && (
            <div className="mt-3 pt-3 border-t">
              <Checkbox checked={issueTax} onChange={(e) => setIssueTax(e.target.checked)}>
                ออกใบกำกับภาษีพร้อมกัน (IV/TAX)
              </Checkbox>
            </div>
          )}
        </div>
      </Modal>

       <Modal
        open={cancelOpen}
        title="Cancel Sale"
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
        open={paymentOpen}
        title="Receive Payment"
        okText="Confirm RE"
        okButtonProps={{ loading: acting }}
        onOk={handlePaymentSubmit}
        centered
        onCancel={() => setPaymentOpen(false)}
      >
        <div className="space-y-4 py-2">
          <p>ยืนยันการรับชำระเงินและออกเลข RE?</p>
          <div>
            <div className="mb-1 text-sm">ช่องทางการรับเงิน <span className="text-red-500">*</span></div>
            <Select
              className="w-full"
              value={paymentAccountId}
              onChange={setPaymentAccountId}
              placeholder="เลือกช่องทางการรับเงิน"
              options={financeAccounts.map((a) => ({
                label: `[${a.type}] ${a.name} ${a.balance != null ? `(คงเหลือ ${Number(a.balance).toLocaleString()})` : ""}`,
                value: a.id,
              }))}
            />
          </div>
          {!header?.tax_invoice_no && (
            <div className="mt-3 pt-3 border-t">
              <Checkbox checked={paymentIssueTax} onChange={(e) => setPaymentIssueTax(e.target.checked)}>
                ออกใบกำกับภาษีพร้อมกัน (RE/TAX)
              </Checkbox>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}
