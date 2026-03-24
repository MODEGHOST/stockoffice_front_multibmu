import { useEffect, useState } from "react";
import { Button, Card, Table, Modal, Form, Input, message } from "antd";
import { PlusOutlined, BankOutlined } from "@ant-design/icons";
import api from "../../lib/api";
import dayjs from "dayjs";

type CompanyRow = {
  id: number;
  name: string;
  tax_id: string;
  phone: string;
  email: string;
  address: string;
  created_at: string;
};

export default function CompanyManagePage() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/companies");
      setRows(data || []);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await api.post("/admin/companies", values);
      message.success("เพิ่มบริษัทเรียบร้อย (Company created)");
      setOpen(false);
      form.resetFields();
      load();
    } catch (e: any) {
      if (e.errorFields) return; // validation error
      message.error(e?.response?.data?.message || "Failed to create company");
    } finally {
      setSubmitting(false);
    }
  }

  const columns = [
    { title: "ID", dataIndex: "id", key: "id", width: 60 },
    { 
      title: "Company Name", 
      dataIndex: "name", 
      key: "name",
      render: (v: string) => <span className="font-semibold text-orange-600">{v}</span>
    },
    { title: "Tax ID", dataIndex: "tax_id", key: "tax_id" },
    { title: "Phone", dataIndex: "phone", key: "phone" },
    { title: "Email", dataIndex: "email", key: "email" },
    { 
      title: "Created At", 
      dataIndex: "created_at", 
      key: "created_at",
      render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "-"
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BankOutlined className="text-3xl text-orange-500" />
          <h1 className="text-2xl font-bold m-0 text-gray-800">จัดการบริษัทลูกค้า (Manage Companies)</h1>
        </div>
        <Button 
          type="primary" 
          size="large"
          icon={<PlusOutlined />} 
          className="rounded-lg"
          onClick={() => {
            form.resetFields();
            setOpen(true);
          }}
        >
          เพิ่มบริษัทใหม่ (New Company)
        </Button>
      </div>

      <Card className="rounded-xl shadow-sm border border-gray-100 overflow-hidden" bodyStyle={{ padding: 0 }}>
        <Table
          scroll={{ x: 'max-content' }}
          dataSource={rows}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2 text-lg text-gray-800">
            <BankOutlined className="text-orange-500 text-2xl" />
            เพิ่มบริษัทใหม่ (Create New Company)
          </div>
        }
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSave}
        confirmLoading={submitting}
        okText="สร้างบริษัท"
        cancelText="ยกเลิก"
        width={600}
        centered
      >
        <Form layout="vertical" form={form} className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <Form.Item name="name" label={<span className="font-medium text-gray-700">ชื่อบริษัท (Company Name)</span>} rules={[{ required: true, message: "กรุณาระบุชื่อบริษัท" }]}>
              <Input size="large" placeholder="ระบุชื่อบริษัท..." />
            </Form.Item>
            <Form.Item 
              name="tax_id" 
              label={<span className="font-medium text-gray-700">เลขผู้เสียภาษี (Tax ID)</span>}
              rules={[
                { pattern: /^[0-9]{13}$/, message: "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก" }
              ]}
            >
              <Input size="large" maxLength={13} placeholder="ระบุเลขภาษี (ถ้ามี)..." />
            </Form.Item>
            <Form.Item 
              name="phone" 
              label={<span className="font-medium text-gray-700">เบอร์โทรศัพท์ (Phone)</span>}
              rules={[
                { pattern: /^[0-9]{9,10}$/, message: "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก" }
              ]}
            >
              <Input size="large" maxLength={10} placeholder="ระบุเบอร์โทร..." />
            </Form.Item>
            <Form.Item 
              name="email" 
              label={<span className="font-medium text-gray-700">อีเมล (Email)</span>}
              rules={[
                { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" }
              ]}
            >
              <Input size="large" placeholder="ระบุอีเมล..." />
            </Form.Item>
          </div>
          <Form.Item name="address" label={<span className="font-medium text-gray-700">ที่อยู่ (Address)</span>}>
            <Input.TextArea rows={3} size="large" placeholder="ที่อยู่บริษัท..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
