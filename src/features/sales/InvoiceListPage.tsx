import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Space, Table, Tag, message } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { useQuery } from "@tanstack/react-query";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

type InvoiceRow = {
  id: number;
  invoice_no: string;
  status: "DRAFT" | "CONFIRMED" | "SHIPPED" | "CANCELLED";
  payment_status?: "UNPAID" | "PARTIAL" | "PAID";
  balance_due?: number;
  issue_date: string;
  total: number;
};

function statusTag(s: InvoiceRow["status"]) {
  if (s === "DRAFT") return <Tag>Draft</Tag>;
  if (s === "CONFIRMED") return <Tag color="blue">Confirmed</Tag>;
  if (s === "SHIPPED") return <Tag color="green">Shipped</Tag>;
  return <Tag color="red">Cancelled</Tag>;
}

export default function InvoiceListPage() {
  const nav = useNavigate();
  const QUERY_KEY = ["sales-invoices"];

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
      const p: Record<string, any> = { page, limit: pageSize, has_invoice: "true" };
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

  const onTableChange: TableProps<InvoiceRow>["onChange"] = (pagination, _filters, sorter) => {
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

  const columns: ColumnsType<InvoiceRow> = [
    {
      title: "เลขที่ใบแจ้งหนี้",
      dataIndex: "invoice_no",
      key: "invoice_no",
      sorter: true,
      render: (v: string, r: InvoiceRow) => (
        <Button type="link" onClick={() => nav(`/sales/invoice/${r.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      width: 140,
      sorter: true,
      render: (v: InvoiceRow["status"]) => statusTag(v),
    },
    {
      title: "วันที่เอกสาร",
      dataIndex: "issue_date",
      key: "issue_date",
      width: 140,
      sorter: true,
      render: (v) => v ? dayjs(v).format("DD/MM/YYYY") : "-",
    },
    {
      title: "ยอดรวม",
      dataIndex: "total",
      key: "total",
      align: "right",
      width: 140,
      sorter: true,
      render: (v: number) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
    },
    {
      title: "ยอดคงค้าง",
      dataIndex: "balance_due",
      key: "balance_due",
      align: "right",
      width: 140,
      render: (v: number, r: InvoiceRow) => Number(v !== undefined ? v : (r.total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 }),
    },
    {
      title: "สถานะชำระ",
      dataIndex: "payment_status",
      key: "payment_status",
      width: 120,
      render: (v: string) => {
        if (v === 'PAID') return <Tag color="green">PAID</Tag>;
        if (v === 'PARTIAL') return <Tag color="orange">PARTIAL</Tag>;
        return <Tag color="default">UNPAID</Tag>;
      }
    },
    {
      title: "Action",
      key: "actions",
      width: 120,
      render: (_: unknown, r: InvoiceRow) => (
        <Button onClick={() => nav(`/sales/invoice/${r.id}`)}>ดูรายละเอียด</Button>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Card
        title="ใบแจ้งหนี้ (Invoices)"
        extra={
          <Space>
            <Input
              placeholder="ค้นหาเลข INV..."
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
            pageSizeOptions: [10, 20, 50, 100],
          }}
        />
      </Card>
    </div>
  );
}
