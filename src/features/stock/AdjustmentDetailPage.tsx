import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Descriptions,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Modal,
  Input,
} from "antd";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import {
  getAdjustment,
  approveAdjustment,
  cancelAdjustment,
  type AdjustmentDetail,
} from "./stockApi";
import { useWarehouses } from "../warehouses/warehouseApi";

const { Title } = Typography;

function statusTag(s: string) {
  if (s === "APPROVED") return <Tag color="green">APPROVED</Tag>;
  if (s === "CANCELLED") return <Tag color="red">CANCELLED</Tag>;
  return <Tag color="gold">DRAFT</Tag>;
}

export default function AdjustmentDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: warehouses } = useWarehouses();

  const [data, setData] = useState<AdjustmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    if (!id) return;
    try {
      setLoading(true);
      const r = await getAdjustment(Number(id));
      setData(r);
    } catch (e: any) {
      message.error("โหลดข้อมูลไม่สำเร็จ");
      nav("/stock/adjustments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleApprove = () => {
    Modal.confirm({
      title: "ยืนยันการอนุมัติ?",
      content: "เมื่ออนุมัติแล้วสต็อกจะถูกปรับทันที และไม่สามารถแก้ไขได้",
      onOk: async () => {
        try {
          setActionLoading(true);
          await approveAdjustment(Number(id));
          message.success("อนุมัติสำเร็จ");
          load();
        } catch (e: any) {
          message.error(e?.response?.data?.message || "ทำรายการไม่สำเร็จ");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleCancel = () => {
    let reason = "";
    Modal.confirm({
      title: "ยืนยันการยกเลิก?",
      content: (
        <div>
          <p>กรุณาระบุเหตุผลการยกเลิก:</p>
          <Input onChange={(e) => (reason = e.target.value)} />
        </div>
      ),
      onOk: async () => {
        if (!reason) return message.error("กรุณาระบุเหตุผล");
        try {
          setActionLoading(true);
          await cancelAdjustment(Number(id), reason);
          message.success("ยกเลิกสำเร็จ");
          load();
        } catch (e: any) {
          message.error(e?.response?.data?.message || "ทำรายการไม่สำเร็จ");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  if (!data) return null;

  const whName = warehouses?.find((w: any) => w.id === data.header.warehouse_id)?.name || "-";

  const columns = [
    { title: "สินค้า", render: (_: any, r: any) => `${r.code} - ${r.name}` },
    {
      title: "ประเภท",
      dataIndex: "direction",
      render: (v: string) =>
        v === "IN" ? <span className="text-green-600 font-bold">รับเข้า</span> : <span className="text-red-600 font-bold">จ่ายออก</span>,
    },
    { title: "จำนวน", dataIndex: "qty", align: "right" as const },
    {
      title: "ต้นทุน (เฉพาะรับเข้า)",
      dataIndex: "unit_cost",
      align: "right" as const,
      render: (v: any) => (v != null ? Number(v).toLocaleString() : "-"),
    },
    { title: "หมายเหตุ", dataIndex: "note" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/stock/adjustments")} />
          <div>
            <Title level={3} className="!mb-0">
              {data.header.doc_no}
            </Title>
            <Space>
              {statusTag(data.header.status)}
              <span className="text-gray-500">
                Created on {dayjs(data.header.created_at).format("DD/MM/YYYY HH:mm")}
              </span>
            </Space>
          </div>
        </div>

        <Space>
          {data.header.status === "DRAFT" && (
            <>
              <Button danger icon={<CloseOutlined />} onClick={handleCancel} loading={actionLoading}>
                ยกเลิก
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleApprove}
                loading={actionLoading}
              >
                อนุมัติ (ปรับสต็อก)
              </Button>
            </>
          )}
          {data.header.status === "APPROVED" && (
            <Button icon={<PrinterOutlined />}>พิมพ์</Button>
          )}
           {data.header.status === "APPROVED" && (
             <Button danger onClick={handleCancel}>Void / ยกเลิกรายการ</Button>
           )}
        </Space>
      </div>

      <Card>
        <Descriptions title="ข้อมูลเอกสาร" bordered column={{ xxl: 3, xl: 3, lg: 3, md: 3, sm: 1, xs: 1 }}>
          <Descriptions.Item label="คลังสินค้า">{whName}</Descriptions.Item>
          <Descriptions.Item label="วันที่เอกสาร">Created: {dayjs(data.header.created_at).format("DD/MM/YYYY")}</Descriptions.Item>
          <Descriptions.Item label="ผู้สร้าง">User ID: {data.header.created_by}</Descriptions.Item>
          <Descriptions.Item label="เหตุผล">{data.header.reason || "-"}</Descriptions.Item>
          {data.header.approved_at && (
            <Descriptions.Item label="อนุมัติเมื่อ">
              {dayjs(data.header.approved_at).format("DD/MM/YYYY HH:mm")}
            </Descriptions.Item>
          )}
          {data.header.cancelled_at && (
             <Descriptions.Item label="ยกเลิกเมื่อ">
              {dayjs(data.header.cancelled_at).format("DD/MM/YYYY HH:mm")} ({data.header.cancel_reason})
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="รายการสินค้า">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data.items}
          pagination={false}
          bordered
        />
      </Card>
    </div>
  );
}
