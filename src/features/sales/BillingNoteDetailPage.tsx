import { useEffect, useState } from "react";
import { 
  Button, Card, Typography, Space, Table, Tag, Descriptions, 
  message, Spin, Modal, InputNumber, Divider
} from "antd";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { getBillingNote, cancelBillingNote, payBillingNote, type BillingNoteDetail, type BillingNoteItem } from "./billingNoteApi";
import { hasPermission } from "../auth/authStore";

const { Title, Text } = Typography;

export default function BillingNoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canManage = hasPermission("sales.inv.manage") || hasPermission("sales.manage");

  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<BillingNoteDetail | null>(null);
  const [items, setItems] = useState<BillingNoteItem[]>([]);

  const [acting, setActing] = useState(false);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [payAmount, setPayAmount] = useState<number | null>(null);

  async function loadData() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getBillingNote(Number(id));
      setHeader(res.header as BillingNoteDetail);
      setItems(res.items);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line
  }, [id]);

  if (loading) return <div className="p-8 text-center"><Spin /></div>;
  if (!header) return <div className="p-8 text-center text-red-500">ไม่พบเอกสารใบวางบิล</div>;

  const totalBalanceDue = items.reduce((sum, it) => sum + Number(it.balance_due || 0), 0);
  const allPaid = items.length > 0 && items.every(it => it.payment_status === "PAID");

  async function handleCancel() {
    if (!window.confirm("ยืนยันยกเลิกใบวางบิลนี้?")) return;
    try {
      setActing(true);
      await cancelBillingNote(Number(id));
      message.success("ยกเลิกสำเร็จ");
      loadData();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "ยกเลิกไม่สำเร็จ");
    } finally {
      setActing(false);
    }
  }

  async function handlePaySubmit() {
    if (payAmount === null || payAmount <= 0) {
      return message.error("กรุณาระบุจำนวนเงินที่รับชำระ");
    }
    if (payAmount > totalBalanceDue) {
      return message.error("ยอดชำระเงินมากกว่ายอดคงค้างทั้งหมด");
    }

    Modal.confirm({
      title: "ยืนยันการรับชำระเงิน?",
      content: `คุณกำลังจะรับชำระเงินจำนวน ${Number(payAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท ใช่หรือไม่?`,
      okText: "ยืนยัน",
      cancelText: "ยกเลิก",
      centered: true,
      onOk: async () => {
        try {
          setActing(true);
          const res = await payBillingNote(Number(id), payAmount);
          message.success(`รับชำระเงินสำเร็จ (ออกใบเสร็จ: ${res.receipt_no})`);
          setPayModalVisible(false);
          loadData();
        } catch (e: any) {
          message.error(e?.response?.data?.message || "รับชำระเงินไม่สำเร็จ");
        } finally {
          setActing(false);
        }
      }
    });
  }

  const columns = [
    { title: "เลขที่ IV", dataIndex: "invoice_no" },
    { title: "วันที่อ้างอิง", dataIndex: "issue_date", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "-" },
    { 
      title: "สถานะชำระ", 
      dataIndex: "payment_status",
      render: (v: string) => {
        if (v === 'PAID') return <Tag color="green">PAID</Tag>;
        if (v === 'PARTIAL') return <Tag color="orange">PARTIAL</Tag>;
        return <Tag color="default">UNPAID</Tag>;
      } 
    },
    { 
      title: "ยอดเต็ม", 
      dataIndex: "total", 
      align: "right" as const,
      render: (v: number) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 }) 
    },
    { 
      title: "ชำระแล้ว", 
      dataIndex: "paid_amount", 
      align: "right" as const,
      render: (v: number) => <Text type="success">{Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</Text>
    },
    { 
      title: "คงค้าง", 
      dataIndex: "balance_due", 
      align: "right" as const,
      render: (v: number) => <Text type="danger">{Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</Text>
    },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto print:m-0 print:p-0 print:max-w-none">
      {/* Action Bar (Hidden in standard screen print) */}
      <div className="flex justify-between items-center print:hidden">
        <Space>
          <Button onClick={() => navigate("/sales/billing-notes")}>กลับ</Button>
          <Button onClick={handlePrint}>พิมพ์ (Print A4)</Button>
        </Space>
        
        {canManage && header.status !== "CANCELLED" && (
          <Space>
            {allPaid ? (
               <Tag color="green" className="text-sm px-4 py-1">ชำระครบถ้วนแล้ว</Tag>
            ) : (
               <Button type="primary" className="bg-purple-600 hover:bg-purple-500" onClick={() => {
                 setPayAmount(totalBalanceDue); // Default to full amount
                 setPayModalVisible(true);
               }}>
                 รับชำระเงิน (สร้าง RE)
               </Button>
            )}
            <Button danger onClick={handleCancel} disabled={acting || allPaid}>ยกเลิก (Cancel)</Button>
          </Space>
        )}
      </div>

      {/* Main Document Content */}
      <Card className="print:shadow-none print:border-none print:m-0 print:p-0">
        <div className="text-center mb-8">
          <Title level={3}>ใบวางบิล / ใบแจ้งหนี้ (Billing Note)</Title>
          {header.status === "CANCELLED" && <Tag color="red" className="text-base mt-2">ยกเลิกแล้ว (CANCELLED)</Tag>}
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
             <Text strong className="block mb-2 text-gray-500">ข้อมูลลูกค้า</Text>
             <div className="p-4 bg-gray-50 rounded min-h-[120px]">
                <div className="font-bold text-lg mb-1">{header.customer_name || "-"}</div>
                {header.customer_address && <div className="text-gray-600 mb-1">{header.customer_address}</div>}
                {header.customer_tax_id && <div className="text-gray-500 text-sm">เลขประจำตัวผู้เสียภาษี: {header.customer_tax_id}</div>}
             </div>
          </div>
          <div>
            <Descriptions column={1} size="small" bordered className="bg-white">
              <Descriptions.Item label="เลขที่ใบวางบิล">{header.doc_no}</Descriptions.Item>
              <Descriptions.Item label="วันที่ออก">
                {header.doc_date ? dayjs(header.doc_date).format("DD/MM/YYYY") : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="กำหนดชำระ">
                {header.due_date ? dayjs(header.due_date).format("DD/MM/YYYY") : "-"}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </div>

        <Table 
          dataSource={items} 
          columns={columns} 
          rowKey="item_id"
          pagination={false}
          size="middle"
          bordered
        />

        <div className="flex justify-end mt-8">
          <div className="w-80">
            <div className="flex justify-between py-2 border-b">
              <Text>ยอดชำระรวมทั้งสิ้น</Text>
              <Text strong className="text-lg">{Number(header.total_amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</Text>
            </div>
            <div className="flex justify-between py-2 border-b">
               <Text>ยอดคงค้างปัจจุปัน</Text>
               <Text strong className="text-lg text-red-600">{Number(totalBalanceDue || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</Text>
            </div>
          </div>
        </div>

        {header.note && (
          <div className="mt-8 pt-4 border-t text-sm text-gray-600">
             <Text strong>หมายเหตุ:</Text> <br/>
             {header.note}
          </div>
        )}

      </Card>

      {/* Payment Modal */}
      <Modal
         title="รับชำระเงิน (สร้างใบเสร็จรับเงิน RE)"
         open={payModalVisible}
         onCancel={() => !acting && setPayModalVisible(false)}
         onOk={handlePaySubmit}
         okText="ถัดไป (ตรวจสอบยอด)"
         cancelText="ยกเลิก"
         confirmLoading={acting}
         centered
      >
         <div className="py-4">
            <div className="mb-4">
               <div className="text-gray-500 mb-1">ยอดคงค้างทั้งหมด (ใบวางบิลนี้):</div>
               <div className="text-2xl font-bold text-red-600">{Number(totalBalanceDue).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</div>
            </div>
            
            <Divider />

            <div className="mb-2">
               <label className="block text-gray-700 font-medium mb-1">ระบุจำนวนเงินที่รับชำระ (บาท)</label>
               <InputNumber 
                 className="w-full text-lg" 
                 size="large"
                 min={0.01}
                 max={totalBalanceDue}
                 value={payAmount}
                 onChange={v => setPayAmount(v as number)}
                 placeholder="ตัวอย่าง: 2000"
               />
            </div>
            <div className="text-xs text-gray-500 mt-2">
              * หากชำระไม่เต็มจำนวน ระบบจะหักยอดจากใบแจ้งหนี้ (IV) เรียงตามลำดับแรกสุดก่อน
            </div>
         </div>
      </Modal>

      {/* Basic Print Styles Generator */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:m-0 { margin: 0 !important; }
          .print\\:p-0 { padding: 0 !important; }
          
          /* Only show the Card contents */
          .ant-card, .ant-card * {
            visibility: visible;
          }
          .ant-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          /* Hide the action bar */
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
