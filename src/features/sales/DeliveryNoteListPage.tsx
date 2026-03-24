import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Space, Table, Tag, message } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

type SaleRow = {
  id: number;
  delivery_no: string;
  invoice_no: string;
  status: string;
  shipped_at: string;
  issue_date: string;
};

export default function DeliveryNoteListPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [sortKey, setSortKey] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const params = useMemo(() => {
    // Delivery Note list: filter by existence of delivery_no
    const p: Record<string, any> = { page, limit: pageSize, has_delivery: "true" };
    if (q.trim()) p.q = q.trim();
    if (sortKey) {
       p.sortKey = sortKey;
       p.sortOrder = sortOrder;
    }
    return p;
  }, [q, page, pageSize, sortKey, sortOrder]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/sales/invoice", { params });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "โหลดข้อมูลไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const onTableChange: TableProps<SaleRow>["onChange"] = (pagination, _filters, sorter) => {
     setPage(pagination.current || 1);
     setPageSize(pagination.pageSize || 20);

     if (Array.isArray(sorter)) return;
     const field = sorter.field as string;
     const order = sorter.order;

     if (field && order) {
        setSortKey(field);
        setSortOrder(order === "ascend" ? "asc" : "desc");
     } else {
        setSortKey("");
        setSortOrder("desc");
     }
  };

  const columns: ColumnsType<SaleRow> = [
    {
      title: "เลขที่ใบส่งของ",
      dataIndex: "delivery_no",
      key: "delivery_no",
      sorter: true,
      render: (v: string, r: SaleRow) => (
        <Button type="link" onClick={() => nav(`/sales/invoice/${r.id}`)}>
          {v || "-"}
        </Button>
      ),
    },
    {
      title: "อ้างอิง IV",
      dataIndex: "invoice_no",
      key: "invoice_no",
      sorter: true,
    },
    {
      title: "วันที่ส่ง",
      dataIndex: "shipped_at",
      key: "shipped_at",
      width: 150,
      sorter: true,
      render: (v) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "-",
    },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      width: 120,
      sorter: true,
      render: () => <Tag color="green">Shipped</Tag>,
    },
    {
      title: "Action",
      key: "actions",
      width: 100,
      render: (_: unknown, r: SaleRow) => (
        <Button size="small" onClick={() => nav(`/sales/invoice/${r.id}`)}>ดูรายละเอียด</Button>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Card
        title="ใบส่งของ (Delivery Notes)"
        extra={
          <Space>
            <Input
              placeholder="ค้นหา..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              style={{ width: 240 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              Refresh
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          onChange={onTableChange}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
          }}
        />
      </Card>
    </div>
  );
}
