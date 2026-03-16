import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { stockSummary, type StockSummaryRow } from "./warehouseApi";

const { Title, Text } = Typography;

type Row = {
  product_id: number;
  product_code: string;
  product_name: string;
  qty: number;
  updated_at?: string;
};

export default function CompanyStockPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const sum = await stockSummary();

      // รวม qty ทุกคลังด้วย product_id
      const map = new Map<number, Row>();
      for (const s of (sum || []) as StockSummaryRow[]) {
        const pid = Number(s.product_id);
        const qty = Number(s.qty || 0);
        if (!pid || qty === 0) continue;

        if (!map.has(pid)) {
          map.set(pid, {
            product_id: pid,
            product_code: s.product_code,
            product_name: s.product_name,
            qty,
            updated_at: s.updated_at,
          });
        } else {
          const cur = map.get(pid)!;
          cur.qty += qty;

          // last updated
          if (s.updated_at && (!cur.updated_at || String(s.updated_at) > String(cur.updated_at))) {
            cur.updated_at = s.updated_at;
          }
        }
      }

      const list = Array.from(map.values()).sort((a, b) => (b.qty || 0) - (a.qty || 0));
      setRows(list);
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "โหลดคลังรวมไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
    let lastUpdatedAt: string | undefined = undefined;

    for (const r of filtered) {
      items += 1;
      qty += Number(r.qty || 0);
      if (r.updated_at) {
        if (!lastUpdatedAt || String(r.updated_at) > String(lastUpdatedAt)) lastUpdatedAt = r.updated_at;
      }
    }

    return { items, qty, lastUpdatedAt };
  }, [filtered]);

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
  ];

  return (
    <div className="p-4">
      <Card
        loading={loading}
        title={
          <Space direction="vertical" size={0}>
            <Title level={4} className="!mb-0">รายละเอียดคลังรวมทั้งบริษัท</Title>
            <Text type="secondary">รวมสต๊อกจากทุกคลัง</Text>
          </Space>
        }
        extra={
          <Space>
            <Button onClick={() => nav("/warehouses")}>กลับ</Button>
            <Button onClick={load} loading={loading}>รีโหลด</Button>
          </Space>
        }
      >
        <div className="flex items-center justify-between mt-2 gap-3 flex-wrap">
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
              <div className="text-xs text-gray-500">จำนวนสินค้ารวม</div>
              <div className="text-base font-semibold">{totals.qty.toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">อัปเดตล่าสุด</div>
              <div className="text-base font-semibold">{totals.lastUpdatedAt ? String(totals.lastUpdatedAt) : "-"}</div>
            </div>
          </Space>
        </div>

        <Card className="mt-4" title="สินค้าทั้งหมดในบริษัท">
          <Table
            rowKey="product_id"
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 20 }}
          />
        </Card>
      </Card>
    </div>
  );
}
