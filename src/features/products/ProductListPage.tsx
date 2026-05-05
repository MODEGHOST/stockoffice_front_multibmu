import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import type { TableProps } from "antd/es/table";
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  QrcodeOutlined,
  PrinterOutlined,
  SearchOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useReactToPrint } from "react-to-print";
import { ProductQRCodePrint } from "./ProductQRCodePrint";
import ProductUnitAutocomplete from "./ProductUnitAutocomplete";
import {
  createProduct,
  getNextProductCode,
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
  const queryClient = useQueryClient();
  const QUERY_KEY = ["products"];

  const [q, setQ] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<string>("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingNextCode, setLoadingNextCode] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [duplicateNameError, setDuplicateNameError] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const [printRow, setPrintRow] = useState<ProductRow | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const printComponentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printComponentRef,
    documentTitle: printRow ? `QR_${printRow.code}` : "QRCode",
  });

  // Fetch Data using React Query
  const { data, isLoading, refetch } = useQuery({
    queryKey: [...QUERY_KEY, searchQuery, page, pageSize, sortKey, sortOrder],
    queryFn: () => listProducts({ q: searchQuery, page, limit: pageSize, sortKey, sortOrder }),
    enabled: !!canManage,
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;

  function handleSearch() {
    setSearchQuery(q.trim());
    setPage(1);
  }

  function handleClearSearch() {
    setQ("");
    setSearchQuery("");
    setPage(1);
  }

  function updateCanSubmit() {
    const values = form.getFieldsValue();
    const hasName = Boolean(values.name?.trim());
    const hasUnit = Boolean(values.unit?.trim());
    const hasSellPrice = values.sell_price !== undefined && values.sell_price !== null && Number(values.sell_price) >= 0;
    setCanSubmit(hasName && hasUnit && hasSellPrice);
  }

  function showDuplicateNameError(messageText: string) {
    form.setFields([{ name: "name", errors: [messageText] }]);
    setDuplicateNameError(false);
    window.requestAnimationFrame(() => setDuplicateNameError(true));
  }

  async function openCreate() {
    setEditing(null);
    form.resetFields();
    setDuplicateNameError(false);
    form.setFieldsValue({
      code: "",
      sell_price: 0,
      is_active: true,
      is_vat: true,
    });
    setCanSubmit(false);
    setOpen(true);

    try {
      setLoadingNextCode(true);
      const code = await getNextProductCode();
      form.setFieldValue("code", code);
    } catch (e) {
      console.error(e);
      message.warning("โหลดรหัสสินค้าถัดไปไม่สำเร็จ ระบบจะสร้างให้ตอนบันทึก", 2);
    } finally {
      setLoadingNextCode(false);
    }
  }

  function openEdit(row: ProductRow) {
    setEditing(row);
    setDuplicateNameError(false);
    form.setFieldsValue({
      code: row.code,
      name: row.name,
      unit: row.unit,
      sell_price: Number(row.sell_price ?? 0),
      is_active: row.is_active === 1,
      is_vat: row.is_vat === 1,
    });
    setCanSubmit(Boolean(row.name?.trim()) && Boolean(row.unit?.trim()) && row.sell_price !== null && row.sell_price !== undefined);
    setOpen(true);
  }

  async function submit(values: FormValues) {
    setSaving(true);
    try {
      const payload = {
        code: editing ? values.code?.trim() : undefined,
        name: values.name.trim(),
        unit: values.unit?.trim() || null,
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

      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setOpen(false);
      setDuplicateNameError(false);
    } catch (e: any) {
      const errorMessage = e?.response?.data?.message || "บันทึกไม่สำเร็จ";
      if (String(errorMessage).includes("อยู่ในคลังสินค้าแล้ว")) {
        showDuplicateNameError(errorMessage);
      }
      message.error(errorMessage, 2);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: ProductRow, next: boolean) {
    try {
      await setProductActive(row.id, next ? 1 : 0);
      message.success("อัปเดตสถานะแล้ว", 1.2);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (e: any) {
      message.error(e?.response?.data?.message || "อัปเดตสถานะไม่สำเร็จ", 2);
    }
  }

  const onTableChange: TableProps<ProductRow>["onChange"] = (pagination, _filters, sorter) => {
    setPage(pagination.current || 1);
    setPageSize(pagination.pageSize || 20);

    if (Array.isArray(sorter)) return;
    const field = sorter.field as string;
    const order = sorter.order;

    if (field && order) {
      setSortKey(field);
      setSortOrder(order === "ascend" ? "asc" : "desc");
    } else {
      setSortKey("id");
      setSortOrder("desc");
    }
  };

  const columns = [
    {
      title: "รหัสสินค้า",
      dataIndex: "code",
      sorter: true,
    },
    {
      title: "ชื่อสินค้า",
      dataIndex: "name",
      sorter: true,
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
      sorter: true,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: "VAT",
      dataIndex: "is_vat",
      sorter: true,
      render: (v: number) =>
        v === 1 ? <Tag color="green">VAT</Tag> : <Tag>NO VAT</Tag>,
    },
    {
      title: "สถานะ",
      dataIndex: "is_active",
      sorter: true,
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
      title: "จัดการ",
      render: (_: any, r: ProductRow) => (
        <Space>
          <Button
            type="dashed"
            icon={<QrcodeOutlined />}
            onClick={() => {
              setPrintRow(r);
              setPrintModalOpen(true);
            }}
          >
            พิมพ์ QR
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => openEdit(r)}
            disabled={!canManage}
          >
            แก้ไข
          </Button>
        </Space>
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
            onPressEnter={handleSearch}
            style={{ width: 240 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={isLoading}>
            Search
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleClearSearch} disabled={!q && !searchQuery}>
            Clear
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
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
          loading={isLoading}
          columns={columns as any}
          dataSource={rows}
          onChange={onTableChange}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
          }}
        />
      </Card>

      <Modal
        open={open}
        title={editing ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
        onCancel={() => {
          setOpen(false);
          setDuplicateNameError(false);
        }}
        onOk={() => form.submit()}
        okButtonProps={{ disabled: !canSubmit }}
        confirmLoading={saving}
        destroyOnClose
        centered
        className={duplicateNameError ? "product-duplicate-modal" : undefined}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          onValuesChange={(changedValues) => {
            if ("name" in changedValues) {
              setDuplicateNameError(false);
              form.setFields([{ name: "name", errors: [] }]);
            }
            updateCanSubmit();
          }}
        >
          <Form.Item name="code" label="รหัสสินค้า">
            <Input
              disabled
              placeholder={loadingNextCode ? "กำลังโหลดรหัสสินค้า..." : "ระบบสร้างให้อัตโนมัติ"}
            />
          </Form.Item>

          <Form.Item name="name" label="ชื่อสินค้า" rules={[{ required: true, message: "กรอกชื่อสินค้า" }]}>
            <Input />
          </Form.Item>

          <Form.Item name="unit" label="หน่วย" rules={[{ required: true, message: "กรอกหน่วย" }]}>
            <ProductUnitAutocomplete />
          </Form.Item>

          <Form.Item
            name="sell_price"
            label="ราคาขาย"
            rules={[{ required: true, message: "กรอกราคาขาย" }]}
          >
            <InputNumber
              className="w-full"
              min={0}
              controls={false}
              inputMode="decimal"
              onKeyDown={(e) => {
                const allowedKeys = [
                  "Backspace",
                  "Delete",
                  "Tab",
                  "ArrowLeft",
                  "ArrowRight",
                  "Home",
                  "End",
                ];
                if (allowedKeys.includes(e.key) || e.metaKey || e.ctrlKey) return;
                if (!/^[0-9.]$/.test(e.key)) e.preventDefault();
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (!/^\d*\.?\d*$/.test(text)) e.preventDefault();
              }}
            />
          </Form.Item>

          <Form.Item name="is_vat" label="VAT" valuePropName="checked">
            <Switch checkedChildren="มี VAT" unCheckedChildren="ไม่มี VAT" />
          </Form.Item>

          <Form.Item name="is_active" label="สถานะ" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={printModalOpen}
        title={`พิมพ์สติ๊กเกอร์ QR Code: ${printRow?.code}`}
        onCancel={() => setPrintModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setPrintModalOpen(false)}>
            ปิด
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => handlePrint()}
          >
            สั่งพิมพ์ (Print)
          </Button>,
        ]}
        centered
        width={600}
      >
        <div className="bg-gray-100 p-8 rounded-lg flex items-center justify-center">
          {printRow && (
            <div className="shadow-lg bg-white">
              <ProductQRCodePrint product={printRow as any} ref={printComponentRef} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
