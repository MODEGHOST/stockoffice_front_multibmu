import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined, ReloadOutlined, EditOutlined } from "@ant-design/icons";
import {
  createProduct,
  listProducts,
  setProductActive,
  updateProduct,
  type ProductRow,
} from "./productApi";
import { hasPermission } from "../auth/authStore";

const { Title, Text } = Typography;

type FormValues = {
  code?: string;
  name: string;
  unit?: string | null;
  sell_price?: number;
  is_active?: boolean;
  is_vat?: boolean;
};

export default function ProductListPage() {
  const canManage = hasPermission("master.product.manage");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  async function load() {
    setLoading(true);
    try {
      const r = await listProducts();
      setRows(r);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "โหลดสินค้าไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManage) load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      return (
        r.code.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle)
      );
    });
  }, [rows, q]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      sell_price: 0,
      is_active: true,
      is_vat: true,
    });
    setOpen(true);
  }

  function openEdit(row: ProductRow) {
    setEditing(row);
    form.setFieldsValue({
      code: row.code,
      name: row.name,
      unit: row.unit,
      sell_price: Number(row.sell_price ?? 0),
      is_active: row.is_active === 1,
      is_vat: row.is_vat === 1,
    });
    setOpen(true);
  }

  async function submit(values: FormValues) {
    setSaving(true);
    try {
      const payload = {
        code: values.code?.trim(),
        name: values.name.trim(),
        unit: values.unit ?? null,
        sell_price: Number(values.sell_price ?? 0),
        is_active: values.is_active ? 1 : 0,
        is_vat: values.is_vat ? 1 : 0,
      };

      if (editing) {
        await updateProduct(editing.id, payload);
        message.success("แก้ไขสินค้าแล้ว", 1.2);
      } else {
        await createProduct(payload);
        message.success("เพิ่มสินค้าแล้ว", 1.2);
      }

      setOpen(false);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "บันทึกไม่สำเร็จ", 2);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: ProductRow, next: boolean) {
    try {
      await setProductActive(row.id, next ? 1 : 0);
      message.success("อัปเดตสถานะแล้ว", 1.2);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "อัปเดตสถานะไม่สำเร็จ", 2);
    }
  }

  const columns = [
    {
      title: "รหัสสินค้า",
      dataIndex: "code",
      sorter: (a: ProductRow, b: ProductRow) =>
        a.code.localeCompare(b.code),
    },
    {
      title: "ชื่อสินค้า",
      dataIndex: "name",
      sorter: (a: ProductRow, b: ProductRow) =>
        a.name.localeCompare(b.name),
      render: (v: any, r: ProductRow) => (
        <div>
          <div className="font-medium">{v}</div>
          <div className="text-xs text-gray-500">
            {r.unit ? `หน่วย: ${r.unit}` : ""}
          </div>
        </div>
      ),
    },
    {
      title: "ราคาขาย",
      dataIndex: "sell_price",
      align: "right" as const,
      sorter: (a: ProductRow, b: ProductRow) =>
        a.sell_price - b.sell_price,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: "VAT",
      dataIndex: "is_vat",
      filters: [
        { text: "มี VAT", value: 1 },
        { text: "ไม่มี VAT", value: 0 },
      ],
      onFilter: (v: any, r: ProductRow) => r.is_vat === v,
      render: (v: number) =>
        v === 1 ? <Tag color="green">VAT</Tag> : <Tag>NO VAT</Tag>,
    },
    {
      title: "สถานะ",
      dataIndex: "is_active",
      filters: [
        { text: "Active", value: 1 },
        { text: "Inactive", value: 0 },
      ],
      onFilter: (v: any, r: ProductRow) => r.is_active === v,
      render: (_: any, r: ProductRow) => {
        const active = r.is_active === 1;
        return (
          <Space>
            <Tag color={active ? "green" : "default"}>
              {active ? "Active" : "Inactive"}
            </Tag>
            <Switch
              size="small"
              checked={active}
              disabled={!canManage}
              onChange={(v) => toggleActive(r, v)}
            />
          </Space>
        );
      },
    },
    {
      title: "",
      render: (_: any, r: ProductRow) => (
        <Button
          icon={<EditOutlined />}
          onClick={() => openEdit(r)}
          disabled={!canManage}
        >
          แก้ไข
        </Button>
      ),
    },
  ];

  if (!canManage) {
    return (
      <Card>
        <Title level={4}>Products</Title>
        <Text type="secondary">คุณไม่มีสิทธิ master.product.manage</Text>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between flex-wrap gap-2">
        <div>
          <Title level={3}>Products</Title>
          <Text type="secondary">จัดการสินค้า</Text>
        </div>

        <Space>
          <Input
            placeholder="ค้นหา code / ชื่อ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            เพิ่มสินค้า
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns as any}
          dataSource={filtered}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        open={open}
        title={editing ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
        centered
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="code" label="รหัสสินค้า">
            <Input disabled placeholder="ระบบสร้างให้อัตโนมัติ" />
          </Form.Item>

          <Form.Item name="name" label="ชื่อสินค้า" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="unit" label="หน่วย">
            <Input />
          </Form.Item>

          <Form.Item name="sell_price" label="ราคาขาย">
            <InputNumber className="w-full" min={0} />
          </Form.Item>

          <Form.Item name="is_vat" label="VAT" valuePropName="checked">
            <Switch checkedChildren="มี VAT" unCheckedChildren="ไม่มี VAT" />
          </Form.Item>

          <Form.Item name="is_active" label="สถานะ" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
