// BillListPage.tsx
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Button, Card, Input, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { listBill, type BillListRow, type BillStatus } from "./purchaseApi";
import { ReloadOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

function statusTag(s: BillStatus) {
  if (s === "APPROVED") return <Tag color="green">APPROVED</Tag>;
  if (s === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  return <Tag color="gold">DRAFT</Tag>;
}

export default function BillListPage() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | BillStatus>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BillListRow[]>([]);
  const [total, setTotal] = useState(0);

  async function load() {
    try {
      setLoading(true);
      const r = await listBill({ q: q.trim() || undefined, status, page, pageSize });
      setRows(Array.isArray(r?.rows) ? r.rows : []);
      setTotal(Number(r?.total || 0));
    } catch (e: any) {
      message.error(e?.response?.data?.message || "โหลด Bill ไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const columns: ColumnsType<BillListRow> = useMemo(
    () => [
      {
        title: "เลขที่ Bill",
        dataIndex: "bill_no",
        key: "bill_no",
        width: 180,
        render: (v, r) => (
          <Button type="link" onClick={() => nav(`/purchase/bill/${r.id}`)} style={{ padding: 0 }}>
            {v}
          </Button>
        ),
      },
      { title: "ใบกำกับภาษี", dataIndex: "tax_invoice_no", key: "tax_invoice_no", width: 180 },
      {
        title: "วันที่",
        dataIndex: "issue_date",
        key: "issue_date",
        width: 130,
        render: (v) => (v ? dayjs(v).format("DD/MM/YYYY") : "-"),
      },
      {
        title: "คู่ค้า",
        dataIndex: "vendor_name",
        key: "vendor_name",
        ellipsis: true,
      },
      {
        title: "คลัง",
        dataIndex: "warehouse_name",
        key: "warehouse_name",
        ellipsis: true,
      },
      {
        title: "จำนวนรายการ",
        dataIndex: "item_count",
        key: "item_count",
        width: 120,
        render: (v) => (v ?? "-"),
      },
      {
        title: "มูลค่ารวม",
        dataIndex: "total_amount",
        key: "total_amount",
        width: 140,
        render: (v) => (v != null ? Number(v).toLocaleString() : "-"),
      },
      {
        title: "สถานะ",
        dataIndex: "status",
        key: "status",
        width: 120,
        filters: [
          { text: "DRAFT", value: "DRAFT" },
          { text: "APPROVED", value: "APPROVED" },
          { text: "CANCELLED", value: "CANCELLED" },
        ],
        render: (v) => statusTag(v as BillStatus),
      },
    ],
    [nav],
  );

  const onTableChange: any = (_pagination: any, filters: any, _sorter: any) => {
    const st = (filters?.status?.[0] as BillStatus) || "";
    if (st !== status) {
      setStatus(st);
      setPage(1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">
            Bills (บันทึกซื้อ)
          </Title>
          <Text type="secondary">รายการ Bill ทั้งหมด + ค้นหา/กรอง</Text>
        </div>

        <Space>
          <Button onClick={() => nav("/purchase/bill/new")} type="primary">
            สร้าง Bill
          </Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      <Card>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา: bill_no / tax_invoice_no / vendor"
            style={{ width: 320 }}
            allowClear
          />
          <Select
            value={status}
            onChange={(v) => setStatus(v)}
            style={{ width: 180 }}
            options={[
              { value: "", label: "ทุกสถานะ" },
              { value: "DRAFT", label: "DRAFT" },
              { value: "APPROVED", label: "APPROVED" },
              { value: "CANCELLED", label: "CANCELLED" },
            ]}
          />
          <Button
            onClick={() => {
              setPage(1);
              load();
            }}
            type="primary"
            loading={loading}
          >
            ค้นหา
          </Button>
        </div>
      </Card>

      <Card>
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
