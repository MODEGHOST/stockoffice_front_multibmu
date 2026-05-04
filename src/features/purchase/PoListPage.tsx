import { useState } from "react";
import { Button, Card, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { listPo, type PoListRow } from "./purchaseApi";
import { useQuery } from "@tanstack/react-query";
import { CloseOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;

function statusTag(s: PoListRow["status"]) {
  if (s === "APPROVED") return <Tag color="green">APPROVED</Tag>;
  if (s === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  return <Tag color="gold">DRAFT</Tag>;
}

function daysLeft(expected_date?: string | null) {
  if (!expected_date) return null;
  const end = dayjs(expected_date);
  if (!end.isValid()) return null;
  // เทียบแบบวัน (ตัดเวลา)
  const diff = end.startOf("day").diff(dayjs().startOf("day"), "day");
  return diff;
}

export default function PoListPage() {
  const nav = useNavigate();
  const QUERY_KEY = ["purchase-orders"];

  const [q, setQ] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<"" | PoListRow["status"]>("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [sortKey, setSortKey] = useState<"" | "po_no" | "vendor_name" | "warehouse_name" | "status" | "issue_date" | "expected_date" | "days_left">("");
  const [sortOrder, setSortOrder] = useState<"" | "asc" | "desc">("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: [...QUERY_KEY, searchQuery, status, page, pageSize, sortKey, sortOrder],
    queryFn: async () => {
      const p: Record<string, any> = {
        q: searchQuery.trim(),
        status,
        page,
        pageSize,
        sortKey: sortKey || undefined,
        sortOrder: sortOrder || undefined,
      };
      return await listPo(p as any);
    },
  });

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const total = Number(data?.total || 0);

  function handleSearch() {
    setSearchQuery(q.trim());
    setPage(1);
  }

  function handleClearSearch() {
    setQ("");
    setSearchQuery("");
    setPage(1);
  }

  const columns: ColumnsType<PoListRow> = [
    {
      title: "PO No",
      dataIndex: "po_no",
      key: "po_no",
      width: 170,
      sorter: true,
    },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      width: 140,
      filters: [
        { text: "DRAFT", value: "DRAFT" },
        { text: "APPROVED", value: "APPROVED" },
        { text: "CANCELLED", value: "CANCELLED" },
      ],
      render: (s) => statusTag(s),
      sorter: true,
    },
    {
      title: "วันที่ออก",
      dataIndex: "issue_date",
      key: "issue_date",
      width: 140,
      sorter: true,
      render: (v) => (v ? dayjs(v).format("DD/MM/YYYY") : "-"),
    },
    {
      title: "กำหนดรับ",
      dataIndex: "expected_date",
      key: "expected_date",
      width: 140,
      render: (v) => (v ? dayjs(v).format("DD/MM/YYYY") : "-"),
      sorter: true,
    },
    {
      title: "เหลือ (วัน)",
      key: "days_left",
      width: 120,
      align: "right",
      sorter: true,
      render: (_: any, r: PoListRow) => {
        const d = daysLeft(r.expected_date ?? null);
        if (d === null) return "-";
        if (d < 0) return <Tag color="red">{`${d} วัน`}</Tag>;
        if (d === 0) return <Tag color="orange">วันนี้</Tag>;
        return <Tag color="blue">{`${d} วัน`}</Tag>;
      },
    },
    {
      title: "Vendor",
      dataIndex: "vendor_name",
      key: "vendor_name",
      sorter: true,
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse_name",
      key: "warehouse_name",
      sorter: true,
    },
    {
      title: "Items",
      dataIndex: "item_count",
      key: "item_count",
      width: 90,
      align: "right",
      render: (v) => v ?? "-",
    },
    {
      title: "Total",
      dataIndex: "total_amount",
      key: "total_amount",
      width: 140,
      align: "right",
      render: (v) => (typeof v === "number" ? v.toLocaleString() : "-"),
    },
    {
      title: "",
      key: "action",
      width: 110,
      render: (_, r) => <Button onClick={() => nav(`/purchase/po/${r.id}`)}>เปิด</Button>,
    },
  ];

  const onTableChange: TableProps<PoListRow>["onChange"] = (_pagination, filters, sorter) => {
    // filter สถานะ (ถ้ากด filter ที่หัวตาราง)
    const st = (filters?.status?.[0] as any) || "";
    if (st !== status) {
      setStatus(st);
      setPage(1);
    }

    // sorter
    if (Array.isArray(sorter)) return;
    const order = sorter.order; // "ascend" | "descend" | undefined
    const field = (sorter.field || sorter.columnKey) as string | undefined;

    if (!order || !field) {
      setSortKey("");
      setSortOrder("");
      return;
    }

    // map field -> sortKey
    const sk =
      field === "po_no"
        ? "po_no"
        : field === "vendor_name"
          ? "vendor_name"
          : field === "warehouse_name"
            ? "warehouse_name"
            : field === "status"
              ? "status"
              : field === "issue_date"
                ? "issue_date"
                : field === "expected_date"
                  ? "expected_date"
                  : field === "days_left"
                    ? "days_left"
                    : "";

    setSortKey(sk as any);
    setSortOrder(order === "ascend" ? "asc" : "desc");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">ใบสั่งซื้อ (PO)</Title>
          <Text type="secondary">Purchase Order</Text>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
            Refresh
          </Button>
          <Button type="primary" onClick={() => nav("/purchase/po/new")}>สร้าง PO</Button>
        </Space>
      </div>

      <Card>
        <Space wrap>
          <Input
            placeholder="ค้นหา PO No / Vendor / Warehouse"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 340 }}
          />
          <Select
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            style={{ width: 220 }}
            options={[
              { value: "", label: "สถานะ: ทั้งหมด" },
              { value: "DRAFT", label: "DRAFT" },
              { value: "APPROVED", label: "APPROVED" },
              { value: "CANCELLED", label: "CANCELLED" },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={isLoading}>
            Search
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleClearSearch} disabled={!q && !searchQuery}>
            Clear
          </Button>
        </Space>
      </Card>

      <Card>
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
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>
    </div>
  );
}
