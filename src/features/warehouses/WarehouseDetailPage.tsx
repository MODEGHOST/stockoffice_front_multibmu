import { useEffect, useMemo, useState } from "react";
import { Button, Card, Descriptions, Input, Space, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate, useParams } from "react-router-dom";
import { getWarehouse, stockSummary, type StockSummaryRow, type WarehouseRow } from "./warehouseApi";
import FifoHistoryModal from "./FifoHistoryModal";

type Row = {
  product_id: number;
  product_code: string;
  product_name: string;
  qty: number;
  updated_at?: string;
};

export default function WarehouseDetailPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const warehouseId = Number(id);

  const [loading, setLoading] = useState(false);
  const [warehouse, setWarehouse] = useState<WarehouseRow | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  const [lotsOpen, setLotsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Row | null>(null);
  const [lotsTitle, setLotsTitle] = useState<string>("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const code = (r.product_code ?? "").toLowerCase();
      const name = (r.product_name ?? "").toLowerCase();
      return code.includes(needle) || name.includes(needle);
    });
  }, [rows, q]);

  const totals = useMemo(() => {
    let items = 0;
    let qty = 0;
    for (const r of filtered) {
      items += 1;
      qty += Number(r.qty || 0);
    }
    return { items, qty };
  }, [filtered]);

  async function load() {
    if (!warehouseId) return;
    setLoading(true);
    try {
      const [w, sum] = await Promise.all([getWarehouse(warehouseId), stockSummary()]);
      setWarehouse(w);

      const whRows = (sum || [])
        .filter((s: StockSummaryRow) => Number(s.warehouse_id) === warehouseId)
        .map((s) => ({
          product_id: Number(s.product_id),
          product_code: s.product_code,
          product_name: s.product_name,
          qty: Number(s.qty || 0),
          updated_at: s.updated_at,
        }))
        .filter((x) => x.qty !== 0);

      setRows(whRows);
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "โหลดข้อมูลโกดังไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  async function openLots(r: Row) {
    setSelectedProduct(r);
    setLotsTitle(`${r.product_code} - ${r.product_name}`);
    setLotsOpen(true);
  }

  // ✅ table products in warehouse
  const columns: ColumnsType<Row> = [
    {
      title: "รหัสสินค้า",
      dataIndex: "product_code",
      key: "product_code",
      width: 160,
      sorter: (a, b) => (a.product_code || "").localeCompare(b.product_code || ""),
      sortDirections: ["ascend", "descend"],
    },
    {
      title: "ชื่อสินค้า",
      dataIndex: "product_name",
      key: "product_name",
      sorter: (a, b) => (a.product_name || "").localeCompare(b.product_name || ""),
      sortDirections: ["ascend", "descend"],
    },
    {
      title: "จำนวนสินค้า",
      dataIndex: "qty",
      key: "qty",
      width: 160,
      align: "right",
      sorter: (a, b) => Number(a.qty || 0) - Number(b.qty || 0),
      sortDirections: ["ascend", "descend"],
      render: (v) => Number(v || 0).toLocaleString(),
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 160,
      render: (_, r) => (
        <Button onClick={() => openLots(r)}>
          ดู Lots (FIFO)
        </Button>
      ),
    },
  ];



  const active = (warehouse?.is_active ?? 1) === 1;

  return (
    <div className="p-4">
      <Card
        loading={loading}
        title={
          <Space>
            <span>รายละเอียดคลัง</span>
            {warehouse ? <Tag color={active ? "green" : "default"}>{active ? "Active" : "Inactive"}</Tag> : null}
          </Space>
        }
        extra={
          <Space>
            <Button onClick={() => nav("/warehouses")}>กลับ</Button>
            <Button onClick={load} loading={loading}>รีโหลด</Button>
          </Space>
        }
      >
        {warehouse ? (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="รหัสคลัง">{warehouse.code}</Descriptions.Item>
              <Descriptions.Item label="ชื่อคลัง">{warehouse.name}</Descriptions.Item>
              <Descriptions.Item label="ที่ตั้ง (ชื่อเรียก)">{warehouse.location || "-"}</Descriptions.Item>
              <Descriptions.Item label="ที่อยู่เต็ม">
                {[
                  warehouse.sub_district && `ต.${warehouse.sub_district}`,
                  warehouse.district && `อ.${warehouse.district}`,
                  warehouse.province && `จ.${warehouse.province}`,
                  warehouse.zip_code
                ].filter(Boolean).join(" ") || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="รายละเอียด">{warehouse.description || "-"}</Descriptions.Item>
              <Descriptions.Item label="Warehouse ID">{warehouse.id}</Descriptions.Item>
              <Descriptions.Item label="Company ID">{warehouse.company_id}</Descriptions.Item>
            </Descriptions>

            <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
              <Space>
                <Input
                  placeholder="ค้นหา รหัส/ชื่อสินค้า"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ width: 280 }}
                  allowClear
                />
              </Space>

              <Space>
                <div className="text-right">
                  <div className="text-xs text-gray-500">จำนวนสินค้า</div>
                  <div className="text-base font-semibold">{totals.items.toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Qty รวม</div>
                  <div className="text-base font-semibold">{totals.qty.toLocaleString()}</div>
                </div>
              </Space>
            </div>

            <Card className="mt-4" title="สินค้าภายในโกดัง">
              <Table
                rowKey="product_id"
                columns={columns}
                dataSource={filtered}
                pagination={{ pageSize: 20 }}
              />
            </Card>

            {lotsOpen && warehouse && (
              <FifoHistoryModal
                open={lotsOpen}
                onCancel={() => setLotsOpen(false)}
                productId={selectedProduct?.product_id || 0}
                productName={lotsTitle}
                warehouseId={warehouse.id}
              />
            )}
          </>
        ) : (
          <div className="text-gray-600">ไม่พบโกดังนี้</div>
        )}
      </Card>
    </div>
  );
}
