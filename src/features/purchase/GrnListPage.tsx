import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Button, Card, Input, Space, Typography, message, Table, Tag, Select } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { listGrn, type GrnListRow } from "./purchaseApi";
import { CloseOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

function statusTag(s: GrnListRow["status"]) {
  if (s === "APPROVED") return <Tag color="green">APPROVED</Tag>;
  if (s === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  return <Tag color="gold">DRAFT</Tag>;
}

export default function GrnListPage() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<"" | GrnListRow["status"]>("");
  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState<GrnListRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc" | "">("");

  const params = useMemo(
    () => ({
      q: searchQuery,
      status,
      page,
      pageSize,
      sort_by: sortBy || undefined,
      sort_dir: (sortDir || undefined) as "asc" | "desc" | undefined,
    }),
    [searchQuery, status, page, pageSize, sortBy, sortDir],
  );

  async function load() {
    try {
      setLoading(true);
      const r = await listGrn(params);
      setRows(Array.isArray(r?.rows) ? r.rows : []);
      setTotal(Number(r?.total || 0));
    } catch (e: any) {
      message.error(e?.response?.data?.message || "โหลดรายการ GRN ไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.status, params.page, params.pageSize, params.sort_by, params.sort_dir]);

  const columns: ColumnsType<GrnListRow> = [
    {
      title: "GRN No",
      dataIndex: "grn_no",
      key: "grn_no",
      width: 160,
      sorter: true,
      render: (v, r) => (
        <Button type="link" onClick={() => nav(`/purchase/grn/${r.id}`)} style={{ padding: 0 }}>
          {v}
        </Button>
      ),
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
    },
    {
      title: "วันที่",
      dataIndex: "issue_date",
      key: "issue_date",
      width: 140,
      render: (v) => (v ? dayjs(v).format("DD/MM/YYYY") : "-"),
    },
    { title: "Vendor", dataIndex: "vendor_name", key: "vendor_name" },
    { title: "Warehouse", dataIndex: "warehouse_name", key: "warehouse_name" },
    {
      title: "Items",
      dataIndex: "item_count",
      key: "item_count",
      width: 90,
      align: "right",
      render: (v) => (v ?? "-"),
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
      render: (_, r) => <Button onClick={() => nav(`/purchase/grn/${r.id}`)}>เปิด</Button>,
    },
  ];

  const onTableChange: NonNullable<TableProps<GrnListRow>["onChange"]> = (_pagination, filters, sorter) => {
    const st = (filters?.status?.[0] as GrnListRow["status"]) || "";
    if (st !== status) {
      setStatus(st);
      setPage(1);
    }

    if (!Array.isArray(sorter)) {
      const order = sorter.order;
      const field = (sorter.field ?? sorter.columnKey) as string | undefined;
      if (!order || !field) {
        setSortBy("");
        setSortDir("");
      } else {
        setSortBy(field);
        setSortDir(order === "ascend" ? "asc" : "desc");
      }
    }
  }

  function handleSearch() {
    setSearchQuery(q.trim());
    setPage(1);
  }

  function handleClearSearch() {
    setQ("");
    setSearchQuery("");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">
            ใบรายการรับสินค้าเข้าคลัง
          </Title>
          <Text type="secondary">รายการรับสินค้าเข้า (Goods Receipt Note)</Text>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" onClick={() => nav("/purchase/grn/new")}>
            สร้าง GRN
          </Button>
        </Space>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Space wrap>
            <Input
              placeholder="ค้นหา GRN No / Vendor / Warehouse"
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
              style={{ width: 200 }}
              options={[
                { value: "", label: "สถานะ: ทั้งหมด" },
                { value: "DRAFT", label: "DRAFT" },
                { value: "APPROVED", label: "APPROVED" },
                { value: "CANCELLED", label: "CANCELLED" },
              ]}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={loading}
            >
              Search
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={handleClearSearch}
              disabled={!q && !searchQuery}
            >
              Clear
            </Button>
          </Space>
        </div>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          onChange={onTableChange}
          scroll={{ x: "max-content" }}
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
