import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Tag,
  Typography,
  message,
  Row,
  Col,
  Table,
} from "antd";
import { PlusOutlined, ReloadOutlined, EditOutlined } from "@ant-design/icons";
import {
  createWarehouse,
  listWarehouses,
  setWarehouseActive,
  updateWarehouse,
  stockSummary,
  type WarehouseRow,
  type StockSummaryRow,
} from "./warehouseApi";
import { hasPermission } from "../auth/authStore";
import { useNavigate } from "react-router-dom";
import AddressSelect from "../../components/AddressSelect";

const { Title, Text } = Typography;

type FormValues = {
  code: string;
  name: string;
  location?: string | null;
  address?: {
    province: string | null;
    district: string | null;
    sub_district: string | null;
    zip_code: string | null;
  };
  description?: string | null;
  is_active?: boolean;
};

type WarehouseAgg = {
  itemsCount: number;
  totalQty: number;
  lastUpdatedAt?: string;
};

type CompanyAgg = {
  itemsCount: number; // จำนวนสินค้าไม่ซ้ำที่มีสต๊อก
  totalQty: number; // qty รวมทุกคลัง
  topItems: {
    product_id: number;
    product_code: string;
    product_name: string;
    qty: number;
  }[];
  lastUpdatedAt?: string;
};

export default function WarehouseListPage() {
  const nav = useNavigate();
  const canManage = hasPermission("master.warehouse.manage");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [summary, setSummary] = useState<StockSummaryRow[]>([]);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [companyOpen, setCompanyOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [w, s] = await Promise.all([listWarehouses(), stockSummary()]);
      setRows(Array.isArray(w) ? w : []);
      setSummary(Array.isArray(s) ? s : []);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || e?.message || "โหลดข้อมูลไม่สำเร็จ",
        2,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManage) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const aggByWarehouseId = useMemo(() => {
    const map = new Map<number, WarehouseAgg>();

    for (const r of summary) {
      const whId = Number(r.warehouse_id);
      const qty = Number(r.qty || 0);
      if (!whId) continue;

      if (!map.has(whId))
        map.set(whId, { itemsCount: 0, totalQty: 0, lastUpdatedAt: undefined });
      const cur = map.get(whId)!;

      if (qty !== 0) cur.itemsCount += 1;
      cur.totalQty += qty;

      if (r.updated_at) {
        if (
          !cur.lastUpdatedAt ||
          String(r.updated_at) > String(cur.lastUpdatedAt)
        ) {
          cur.lastUpdatedAt = r.updated_at;
        }
      }
    }

    return map;
  }, [summary]);

  const companyAgg = useMemo<CompanyAgg>(() => {
    const map = new Map<
      number,
      {
        product_id: number;
        product_code: string;
        product_name: string;
        qty: number;
      }
    >();
    let totalQty = 0;
    let lastUpdatedAt: string | undefined = undefined;

    for (const r of summary) {
      const pid = Number(r.product_id);
      const qty = Number(r.qty || 0);
      if (!pid || qty === 0) continue;

      totalQty += qty;

      if (r.updated_at) {
        if (!lastUpdatedAt || String(r.updated_at) > String(lastUpdatedAt))
          lastUpdatedAt = r.updated_at;
      }

      if (!map.has(pid)) {
        map.set(pid, {
          product_id: pid,
          product_code: r.product_code,
          product_name: r.product_name,
          qty: qty,
        });
      } else {
        map.get(pid)!.qty += qty;
      }
    }

    const list = Array.from(map.values())
      .filter((x) => x.qty !== 0)
      .sort((a, b) => b.qty - a.qty);

    return {
      itemsCount: list.length,
      totalQty,
      topItems: list.slice(0, 10),
      lastUpdatedAt,
    };
  }, [summary]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((r) => {
      const code = (r.code ?? "").toLowerCase();
      const name = (r.name ?? "").toLowerCase();
      const loc = (r.location ?? "").toLowerCase();
      const desc = (r.description ?? "").toLowerCase();
      return (
        code.includes(needle) ||
        name.includes(needle) ||
        loc.includes(needle) ||
        desc.includes(needle)
      );
    });
  }, [rows, q]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setOpen(true);
  }

  function openEdit(row: WarehouseRow) {
    setEditing(row);
    form.setFieldsValue({
      code: row.code,
      name: row.name,
      location: row.location ?? null,
      address: {
        province: row.province ?? null,
        district: row.district ?? null,
        sub_district: row.sub_district ?? null,
        zip_code: row.zip_code ?? null,
      },
      description: row.description ?? null,
      is_active: (row.is_active ?? 1) === 1,
    });
    setOpen(true);
  }

  async function submit(values: FormValues) {
    setSaving(true);
    try {
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        location: values.location ? values.location.trim() : null,
        province: values.address?.province || null,
        district: values.address?.district || null,
        sub_district: values.address?.sub_district || null,
        zip_code: values.address?.zip_code || null,
        description: values.description ? values.description.trim() : null,
        is_active: values.is_active ? 1 : 0,
      };

      if (editing) {
        await updateWarehouse(editing.id, payload);
        message.success("แก้ไขคลังแล้ว", 1.2);
      } else {
        await createWarehouse(payload);
        message.success("เพิ่มคลังแล้ว", 1.2);
      }

      setOpen(false);
      await load();
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || e?.message || "บันทึกไม่สำเร็จ",
        2,
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: WarehouseRow, next: boolean) {
    try {
      await setWarehouseActive(row.id, next ? 1 : 0);
      message.success("อัปเดตสถานะแล้ว", 1.2);
      await load();
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || e?.message || "อัปเดตสถานะไม่สำเร็จ",
        2,
      );
    }
  }

  if (!canManage) {
    return (
      <Card>
        <Title level={4} className="!mb-1">
          Warehouses
        </Title>
        <Text type="secondary">คุณไม่มีสิทธิ master.warehouse.manage</Text>
      </Card>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">
            คลังสินค้า
          </Title>
          <Text type="secondary">
            ภาพรวมคลัง (คลิกการ์ดเพื่อดูสินค้าในคลัง)
          </Text>
        </div>

        <Space wrap>
          <Input
            placeholder="ค้นหา code / ชื่อคลัง / ที่ตั้ง / รายละเอียด"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 320 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            รีเฟรช
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            เพิ่มคลัง
          </Button>
        </Space>
      </div>

      {/* ✅ Company summary card */}
      <Card
        hoverable
        onClick={() => nav("/stock/company")}
        loading={loading}
        style={{
          borderRadius: 16,
          border: "2px solid #E5E7EB",
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        }}
        title="คลังรวมทั้งบริษัท"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-500">จำนวนสินค้า (มีสต๊อก)</div>
            <div className="text-3xl font-semibold">
              {companyAgg.itemsCount.toLocaleString()}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500">จำนวนสินค้า รวมทุกคลัง</div>
            <div className="text-3xl font-semibold">
              {companyAgg.totalQty.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold mb-2">
            รายการสินค้า (Top 10)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {companyAgg.topItems.length === 0 ? (
              <div className="text-gray-500">ยังไม่มีสินค้าในสต๊อก</div>
            ) : (
              companyAgg.topItems.map((p) => (
                <div
                  key={p.product_id}
                  className="flex items-center justify-between rounded-xl px-3 py-2"
                  style={{ background: "#FAFAFA", border: "1px solid #EEF2F7" }}
                >
                  <div className="min-w-0">
                    <div className="font-medium">{p.product_code}</div>
                    <div className="text-xs text-gray-600 truncate">
                      {p.product_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">จำนวนสินค้า</div>
                    <div className="font-semibold">
                      {p.qty.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="text-xs text-gray-500 mt-3">
            อัปเดตล่าสุด:{" "}
            {companyAgg.lastUpdatedAt ? String(companyAgg.lastUpdatedAt) : "-"}
          </div>
        </div>
      </Card>

      {/* warehouse cards */}
      <Row gutter={[16, 16]}>
        {filtered.map((w) => {
          const active = (w.is_active ?? 1) === 1;
          const agg = aggByWarehouseId.get(w.id) || {
            itemsCount: 0,
            totalQty: 0,
            lastUpdatedAt: undefined,
          };

          return (
            <Col key={w.id} xs={24} sm={24} md={12} lg={12} xl={8}>
              <Card
                hoverable
                loading={loading}
                onClick={() => nav(`/warehouses/${w.id}`)}
                styles={{
                  header: { padding: "12px 16px" },
                  body: { padding: 16 },
                }}
                style={{
                  borderRadius: 16,
                  border: "2px solid #E5E7EB",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                }}
                title={
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-base leading-tight">
                        {w.code}
                      </div>
                      <div className="text-sm text-gray-600 truncate">
                        {w.name}
                      </div>
                    </div>
                    <Tag color={active ? "green" : "default"} className="!m-0">
                      {active ? "Active" : "Inactive"}
                    </Tag>
                  </div>
                }
                extra={
                  <Space onClick={(e) => e.stopPropagation()}>
                    <Switch
                      size="small"
                      checked={active}
                      onClick={(_, e) => e.stopPropagation()}
                      onChange={(v) => toggleActive(w, v)}
                    />
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(w);
                      }}
                    >
                      แก้ไข
                    </Button>
                  </Space>
                }
              >
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    <span className="text-gray-500">ที่ตั้ง (ชื่อเรียก):</span>{" "}
                    {w.location || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">ที่อยู่:</span>{" "}
                    {[w.sub_district && `ต.${w.sub_district}`, w.district && `อ.${w.district}`, w.province && `จ.${w.province}`, w.zip_code]
                      .filter(Boolean)
                      .join(" ") || "-"}
                  </div>
                  <div className="line-clamp-2">
                    <span className="text-gray-500">รายละเอียด:</span>{" "}
                    {w.description || "-"}
                  </div>
                </div>

                <div
                  className="mt-4 grid grid-cols-2 gap-3 rounded-xl px-4 py-3"
                  style={{ border: "1px solid #EEF2F7", background: "#FAFAFA" }}
                >
                  <div className="text-center">
                    <div className="text-xs text-gray-500">สินค้า (มีของ)</div>
                    <div className="text-2xl font-semibold leading-tight">
                      {agg.itemsCount}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">จำนวนสินค้า รวม</div>
                    <div className="text-2xl font-semibold leading-tight">
                      {agg.totalQty}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mt-3">
                  อัปเดตล่าสุด:{" "}
                  {agg.lastUpdatedAt ? String(agg.lastUpdatedAt) : "-"}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* modal */}
      <Modal
        open={open}
        title={editing ? "แก้ไขคลัง" : "เพิ่มคลัง"}
        onCancel={() => setOpen(false)}
        okText={editing ? "บันทึก" : "สร้าง"}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
        centered
        width={900}
      >
        <Form form={form} layout="vertical" onFinish={submit} className="mt-4">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="code"
                label="รหัสคลัง"
                rules={[{ required: true, message: "กรอกรหัสคลัง" }]}
              >
                <Input placeholder="เช่น W-001" />
              </Form.Item>
            </Col>
            
            <Col span={8}>
              <Form.Item
                name="name"
                label="ชื่อคลัง"
                rules={[{ required: true, message: "กรอกชื่อคลัง" }]}
              >
                <Input placeholder="เช่น Main Warehouse" />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item name="description" label="รายละเอียด (ถ้ามี)">
                <Input placeholder="เช่น คลังหลักของบริษัท" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="location" label="ที่ตั้ง (ชื่อเรียก ถ้ามี)">
            <Input placeholder="เช่น กรุงเทพ / นนทบุรี" />
          </Form.Item>

          <Form.Item name="address" label="ที่อยู่คลังสินค้า (ถ้ามี)">
            <AddressSelect />
          </Form.Item>

          <Form.Item name="is_active" label="สถานะ" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={companyOpen}
        onCancel={() => setCompanyOpen(false)}
        footer={null}
        width={900}
        centered
        title="รายละเอียดคลังรวมทั้งบริษัท"
        destroyOnClose
      >
        {/* summary header */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-500">จำนวนสินค้า (มีสต๊อก)</div>
            <div className="text-xl font-semibold">
              {companyAgg.itemsCount.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">จำนวนสินค้า รวมทุกคลัง</div>
            <div className="text-xl font-semibold">
              {companyAgg.totalQty.toLocaleString()}
            </div>
          </div>
        </div>

        {/* table */}
        <Table
          rowKey="product_id"
          dataSource={companyAgg.topItems}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "รหัสสินค้า",
              dataIndex: "product_code",
              sorter: (a, b) => a.product_code.localeCompare(b.product_code),
            },
            {
              title: "ชื่อสินค้า",
              dataIndex: "product_name",
              sorter: (a, b) => a.product_name.localeCompare(b.product_name),
            },
            {
              title: "จำนวน (Qty)",
              dataIndex: "qty",
              align: "right",
              sorter: (a, b) => a.qty - b.qty,
              render: (v: number) => v.toLocaleString(),
            },
          ]}
        />

        <div className="text-xs text-gray-500 mt-3">
          อัปเดตล่าสุด:{" "}
          {companyAgg.lastUpdatedAt ? String(companyAgg.lastUpdatedAt) : "-"}
        </div>
      </Modal>
    </div>
  );
}
