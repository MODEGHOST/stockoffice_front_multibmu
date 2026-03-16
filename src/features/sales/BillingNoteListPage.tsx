import { useEffect, useState } from "react";
import { Table, Button, Input, Tag, Card, Typography, Space, message } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { listBillingNotes, cancelBillingNote } from "./billingNoteApi";
import type { BillingNoteRow } from "./billingNoteApi";
import { hasPermission } from "../auth/authStore";

const { Title } = Typography;

export default function BillingNoteListPage() {
  const navigate = useNavigate();
  const canManage = hasPermission("sales.inv.manage") || hasPermission("sales.manage");

  const [rows, setRows] = useState<BillingNoteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await listBillingNotes({ q, page, limit });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [page]);

  async function handleCancel(id: number) {
    if (!window.confirm("ยืนยันยกเลิกใบวางบิลนี้?")) return;
    try {
      await cancelBillingNote(id);
      message.success("ยกเลิกสำเร็จ");
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "ไม่สามารถยกเลิกได้");
    }
  }

  const columns: ColumnsType<BillingNoteRow> = [
    {
      title: "เลขที่",
      dataIndex: "doc_no",
      key: "doc_no",
      render: (v, r) => (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            // We haven't created the view page yet, but eventually it should be:
            navigate(`/sales/billing-notes/${r.id}`);
            message.info("สามารถนำเอกสารใบวางบิลนี้ไปส่งให้ลูกค้าเพื่อเรียกเก็บเงินได้ครับ (หน้ารายละเอียดยังอยู่ระหว่างพัฒนา)");
          }}
          className="font-medium text-blue-600 hover:underline"
        >
          {v}
        </a>
      ),
    },
    {
      title: "วันที่เอกสาร",
      dataIndex: "doc_date",
      key: "doc_date",
      render: (v) => v ? dayjs(v).format("DD/MM/YYYY") : "-",
    },
    {
      title: "ลูกค้า",
      dataIndex: "customer_name",
      key: "customer_name",
      render: (v, r) => (
        <div className="leading-tight">
          <div className="font-medium">{v || "-"}</div>
          <div className="text-xs text-gray-400">{r.customer_code}</div>
        </div>
      )
    },
    {
      title: "วันครบกำหนด",
      dataIndex: "due_date",
      key: "due_date",
      render: (v) => v ? dayjs(v).format("DD/MM/YYYY") : "-",
    },
    {
      title: "ยอดสุทธิ",
      dataIndex: "total_amount",
      key: "total",
      align: "right",
      render: (v) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 }),
    },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      render: (v) => {
        let color = "default";
        if (v === "ISSUED") color = "blue";
        if (v === "CANCELLED") color = "red";
        return <Tag color={color}>{v}</Tag>;
      },
    },
    {
      title: "จัดการ",
      key: "action",
      align: "center",
      render: (_, r) => {
        if (!canManage) return null;
        if (r.status === "CANCELLED") return null;
        return (
          <Space>
            <Button size="small" danger onClick={() => handleCancel(r.id)}>ยกเลิก</Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} className="!mb-1">
            ใบวางบิล (Billing Note)
          </Title>
        </div>
        <Space>
          <Input 
            placeholder="ค้นหาเลขที่/รายชื่อ..." 
            allowClear 
            value={q}
            onChange={e => setQ(e.target.value)}
            onPressEnter={() => { setPage(1); load(); }}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            รีเฟรช
          </Button>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/sales/billing-notes/new")}>
              สร้างใบวางบิล
            </Button>
          )}
        </Space>
      </div>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            onChange: (p) => setPage(p),
          }}
        />
      </Card>
    </div>
  );
}
