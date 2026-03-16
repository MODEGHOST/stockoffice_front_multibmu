import { useEffect, useState, useMemo } from "react";
import { Form, DatePicker, Select, Button, Input, Table, Card, Typography, message, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { createBillingNote } from "./billingNoteApi";
import api from "../../lib/api";
import { hasPermission } from "../auth/authStore";
import type { VendorRow } from "../vendors/vendorApi";

const { Title, Text } = Typography;

export default function BillingNoteCreatePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  const canManage = hasPermission("sales.inv.manage") || hasPermission("sales.manage");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [customers, setCustomers] = useState<VendorRow[]>([]);
  const [availableIvs, setAvailableIvs] = useState<any[]>([]);
  
  const selectedCustomerId = Form.useWatch("customer_id", form);
  const selectedSalesIds = Form.useWatch("sales_ids", form) || [];

  // Load Customers (vendors with type CUSTOMER or BOTH)
  useEffect(() => {
    async function loadCustomers() {
      try {
        const { data } = await api.get("/vendors");
        const list = Array.isArray(data) ? data : [];
        setCustomers(list.filter((v: VendorRow) => v.type === "CUSTOMER" || v.type === "BOTH"));
      } catch (e: any) {
        message.error("ไม่สามารถโหลดรายชื่อลูกค้าได้");
      }
    }
    loadCustomers();
  }, []);

  // Load available Invoices for selected customer
  useEffect(() => {
    if (!selectedCustomerId) {
      setAvailableIvs([]);
      form.setFieldsValue({ sales_ids: [] });
      return;
    }
    
    async function loadIvs() {
      setLoading(true);
      try {
        // Find IVs for this customer that are CONFIRMED or SHIPPED.
        // We assume we can fetch all sales and filter, or just query.
        // Quick way: use /sales/invoice?limit=1000 and filter locally
        const { data } = await api.get("/sales/invoice", { params: { limit: 1000 } });
        const rows = data.rows || [];
        
        // Filter: same customer, status IN (CONFIRMED, SHIPPED), and UNPAID/PARTIAL
        const validIvs = rows.filter((r: any) => 
          (r.status === "CONFIRMED" || r.status === "SHIPPED") &&
          r.payment_status !== "PAID" &&
          r.customer_id === selectedCustomerId
        );
        
        setAvailableIvs(validIvs);
      } catch (e) {
        message.error("ไม่สามารถโหลดใบกำกับภาษีได้");
      } finally {
        setLoading(false);
      }
    }
    loadIvs();
  }, [selectedCustomerId, form]);

  const totalAmount = useMemo(() => {
    return availableIvs
      .filter(iv => selectedSalesIds.includes(iv.id))
      .reduce((sum, iv) => sum + Number(iv.balance_due !== undefined ? iv.balance_due : (iv.total || 0)), 0);
  }, [availableIvs, selectedSalesIds]);

  async function onFinish(values: any) {
    if (!values.sales_ids || values.sales_ids.length === 0) {
      return message.error("กรุณาเลือกเอกสารอย่างน้อย 1 รายการ");
    }

    setSaving(true);
    try {
      const payload = {
        customer_id: values.customer_id,
        issue_date: values.issue_date.format("YYYY-MM-DD"),
        due_date: values.due_date ? values.due_date.format("YYYY-MM-DD") : null,
        note: values.note || null,
        sales_ids: values.sales_ids,
      };

      const res = await createBillingNote(payload);
      message.success(`สร้างใบวางบิลสำเร็จ (${res.doc_no})`);
      navigate("/sales/billing-notes");
    } catch (e: any) {
      message.error(e?.response?.data?.message || "สร้างใบวางบิลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const ivColumns = [
    { title: "เลขที่", dataIndex: "invoice_no", key: "invoice_no", render: (v: string) => <span className="font-medium">{v}</span> },
    { title: "วันที่", dataIndex: "issue_date", key: "issue_date", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "-" },
    { title: "สถานะ", dataIndex: "status", key: "status", render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: "ลูกหนี้", dataIndex: "customer_name", key: "customer_name" },
    { title: "สถานะชำระ", dataIndex: "payment_status", key: "payment_status", render: (v: string) => {
        if (v === 'PAID') return <Tag color="green">ชำระแล้ว</Tag>;
        if (v === 'PARTIAL') return <Tag color="orange">ชำระบางส่วน</Tag>;
        return <Tag color="default">ยังไม่ชำระ</Tag>;
    } },
    { title: "ยอดคงค้าง", dataIndex: "balance_due", key: "balance_due", align: "right" as const, render: (v: number, record: any) => Number(v !== undefined && v !== null ? v : (record.total || 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 }) },
  ];

  if (!canManage) {
    return (
      <Card>
        <Title level={4}>วางบิล</Title>
        <Text type="secondary">คุณไม่มีสิทธิใช้งาน</Text>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Title level={3} className="!mb-1">
          สร้างใบวางบิล
        </Title>
        <Button onClick={() => navigate(-1)}>กลับ</Button>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ issue_date: dayjs() }}>
        <Card className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="customer_id" label="ลูกค้า" rules={[{ required: true, message: "เลือกเลือกลูกค้า" }]}>
              <Select
                showSearch
                placeholder="ค้นหาลูกค้า..."
                optionFilterProp="children"
                options={customers.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
              />
            </Form.Item>
            
            <div className="hidden md:block"></div>

            <Form.Item name="issue_date" label="วันที่เอกสาร" rules={[{ required: true, message: "เลือกวันที่" }]}>
              <DatePicker format="DD/MM/YYYY" className="w-full" />
            </Form.Item>

            <Form.Item name="due_date" label="วันครบกำหนด (ถ้ามี)">
              <DatePicker format="DD/MM/YYYY" className="w-full" />
            </Form.Item>

            <Form.Item name="note" label="หมายเหตุ" className="md:col-span-2">
              <Input.TextArea rows={2} placeholder="บันทึกย่อ..." />
            </Form.Item>
          </div>
        </Card>

        {selectedCustomerId && (
          <Card title="เลือกเอกสาร (IV) เพื่อวางบิล" className="mb-4">
            <Form.Item name="sales_ids" rules={[{ required: true, message: "" }]} valuePropName="value">
              <Table
                rowKey="id"
                loading={loading}
                columns={ivColumns}
                dataSource={availableIvs}
                pagination={false}
                rowSelection={{
                  type: 'checkbox',
                  selectedRowKeys: selectedSalesIds,
                  onChange: (keys) => {
                    form.setFieldsValue({ sales_ids: keys });
                  }
                }}
              />
            </Form.Item>

            <div className="flex justify-end mt-4">
              <div className="text-right">
                <Text type="secondary">ยอดรวม</Text>
                <Title level={3} className="!m-0 text-blue-600">
                  {totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </Title>
              </div>
            </div>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={() => navigate(-1)}>ยกเลิก</Button>
          <Button type="primary" htmlType="submit" loading={saving} disabled={selectedSalesIds.length === 0}>
            บันทึกใบวางบิล
          </Button>
        </div>
      </Form>
    </div>
  );
}
