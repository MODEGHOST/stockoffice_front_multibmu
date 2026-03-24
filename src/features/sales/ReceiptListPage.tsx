import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Space, Table, Tag, message } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { useQuery } from "@tanstack/react-query";
import { ReloadOutlined } from "@ant-design/icons";

type SaleRow = {
  id: number;
  receipt_no: string;
  invoice_no: string;
  status: string;
  total: number;
  created_at: string;
};

export default function ReceiptListPage() {
  const nav = useNavigate();
  const QUERY_KEY = ["sales-receipts"];

  const [q, setQ] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [sortKey, setSortKey] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(q);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [q]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [...QUERY_KEY, searchQuery, page, pageSize, sortKey, sortOrder],
    queryFn: async () => {
      const p: Record<string, any> = { page, limit: pageSize, has_receipt: "true" };
      if (searchQuery.trim()) p.q = searchQuery.trim();
      if (sortKey) {
        p.sortKey = sortKey;
        p.sortOrder = sortOrder;
      }
      const { data } = await api.get("/sales/invoice", { params: p });
      return {
        rows: Array.isArray(data?.rows) ? data.rows : [],
        total: Number(data?.total || 0),
      };
    },
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;

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
      title: "เลขที่ใบเสร็จ",
      dataIndex: "receipt_no",
      key: "receipt_no",
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
      title: "ยอดเงิน",
      dataIndex: "total",
      key: "total",
      align: "right",
      width: 150,
      sorter: true,
      render: (v) => Number(v || 0).toLocaleString(),
    },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      width: 120,
      sorter: true,
      render: (v) => <Tag>{v}</Tag>,
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
        title="ใบเสร็จรับเงิน (Receipts)"
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
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
              Refresh
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={isLoading}
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
