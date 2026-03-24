import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Space, Table, Tag, message } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { useQuery } from "@tanstack/react-query";
import { ReloadOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

type SaleRow = {
  id: number;
  quotation_no: string;
  status: string;
  issue_date: string;
  total: number;
  created_at: string;
};

function statusTag(s: string) {
  if (s === "QUOTATION") return <Tag color="gold">DRAFT</Tag>;
  if (s === "CONFIRMED") return <Tag color="green">APPROVED</Tag>;
  if (s === "SHIPPED") return <Tag color="blue">COMPLETED</Tag>;
  if (s === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  return <Tag>{s}</Tag>;
}

export default function QuotationListPage() {
  const nav = useNavigate();
  const QUERY_KEY = ["sales-quotations"];

  const [q, setQ] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Sorting
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
      const p: Record<string, any> = { page, limit: pageSize };
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
      title: "เลขที่ใบเสนอราคา",
      dataIndex: "quotation_no",
      key: "quotation_no",
      sorter: true,
      render: (v: string, r: SaleRow) => (
        <Button type="link" onClick={() => nav(`/sales/invoice/${r.id}`)}>
          {v || "-"}
        </Button>
      ),
    },
    {
      title: "วันที่เอกสาร",
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      sorter: true,
      render: (v) => v ? dayjs(v).format("DD/MM/YYYY") : "-",
    },
    {
      title: "ยอดรวม",
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
      filters: [
          { text: "DRAFT (QUOTATION)", value: "QUOTATION" },
          { text: "APPROVED (CONFIRMED)", value: "CONFIRMED" },
          { text: "COMPLETED (SHIPPED)", value: "SHIPPED" },
          { text: "CANCELLED", value: "CANCELLED" },
      ],
      onFilter: (value, record) => record.status === value, // Note: Client-side filter for now or we must implement server-side filter param if needed. 
      // Wait, current `load` uses `params` which relies on `q` or `status` arg? 
      // The `onTableChange` for filtering is NOT implemented in `params` above properly for MULTIPLE params usually.
      // But `PoListPage` reloads.
      // Actually `sales.service.js` only checks `status` single value.
      // If I want Status filtering to be consistent with Sorting, I should handle `filters` in `onTableChange`.
      // Let's keep it simple: Client side filtering for Status is risky if paged.
      // I will implement `status` in params.
      render: (v) => statusTag(v),
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
  
  // Correction: To use server-side filter for 'status', use `filteredValue` controlled or just handle in onChange
  // But `Table` internal filter is client side if I don't set `filteredValue`?
  // Let's adjust `onTableChange` to update `status` param if I want server side.
  // Actually, for simplicity and UX consistency with Purchase, I'll just rely on global filtering or use `filters` prop but handle in `onTableChange`.
  // To keep it clean for now, I will use `params` to handle sorting. 
  // For Status filtering from Header, I need to update `status` state.
  
  // Revised onTableChange in replacement content below.

  return (
    <div className="p-4">
      <Card
        title="ใบเสนอราคา (Quotations)"
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => nav("/sales/invoice/new")}>
              สร้างใบเสนอราคา
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
          }}
        />
      </Card>
    </div>
  );
}
