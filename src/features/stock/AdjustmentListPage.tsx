import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Button, Card, Input, Space, Typography, message, Table, Tag, Select } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { listAdjustments, type AdjustmentListRow } from "./stockApi";
import { ReloadOutlined, PlusOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

function statusTag(s: AdjustmentListRow["status"]) {
  if (s === "APPROVED") return <Tag color="green">APPROVED</Tag>;
  if (s === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  return <Tag color="gold">DRAFT</Tag>;
}

export default function AdjustmentListPage() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | AdjustmentListRow["status"]>("");
  const [loading, setLoading] = useState(false);

  const [rows, setRows] = useState<AdjustmentListRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const params = useMemo(
    () => ({
      q: q.trim(),
      status,
      page,
      pageSize,
    }),
    [q, status, page, pageSize],
  );

  async function load() {
    try {
      setLoading(true);
      const r = await listAdjustments(params);
      setRows(Array.isArray(r?.rows) ? r.rows : []);
      setTotal(Number(r?.total || 0));
    } catch (e: any) {
      message.error(e?.response?.data?.message || "โหลดรายการไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.status, params.page, params.pageSize]);

  const columns: ColumnsType<AdjustmentListRow> = [
    { title: "Doc No", dataIndex: "doc_no", key: "doc_no", width: 160 },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s) => statusTag(s),
    },
    {
      title: "วันที่",
      dataIndex: "issue_date", // Monitor if backend sends 'issue_date' or 'created_at'
      key: "issue_date",
      width: 140,
      render: (v) => (v ? dayjs(v).format("DD/MM/YYYY") : "-"),
    },
    { title: "Warehouse", dataIndex: "warehouse_name", key: "warehouse_name", width: 150 },
    { title: "เหตุผล", dataIndex: "reason", key: "reason" },
    { title: "ผู้สร้าง", dataIndex: "created_by_name", key: "created_by_name", width: 150 },
    {
      title: "",
      key: "action",
      width: 100,
      render: (_, r) => <Button onClick={() => nav(`/stock/adjustments/${r.id}`)}>เปิด</Button>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">ใบปรับปรุงยอดสต็อก</Title>
          <Text type="secondary">Stock Adjustment Note</Text>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => nav("/stock/adjustments/new")}>
            สร้างรายการ
          </Button>
        </Space>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Space wrap>
            <Input
              placeholder="ค้นหา Doc No / เหตุผล"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              allowClear
              style={{ width: 300 }}
            />

            <Select
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              style={{ width: 150 }}
              options={[
                { value: "", label: "สถานะ: ทั้งหมด" },
                { value: "DRAFT", label: "DRAFT" },
                { value: "APPROVED", label: "APPROVED" },
                { value: "CANCELLED", label: "CANCELLED" },
              ]}
            />
          </Space>
        </div>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
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
