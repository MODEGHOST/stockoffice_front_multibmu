import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Table, Tag, Typography, message, Skeleton, Result, Space, Modal } from "antd";
import { ArrowLeftOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { getCount, approveCount, cancelCount } from "./countApi";
import type { CountItem } from "./countApi";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export default function CountDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const queryClient = useQueryClient();

  const countId = Number(id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["countDetail", countId],
    queryFn: () => getCount(countId),
    enabled: !!countId,
  });

  const appMutation = useMutation({
    mutationFn: approveCount,
    onSuccess: (res: any) => {
      if (res?.adjustmentCreated) {
        message.success(`อนุมัติสำเร็จ! ระบบสร้างใบ ADJ: ${res.adjustmentDocNo} เพื่อปรับยอดส่วนต่างให้แล้ว`);
      } else {
        message.success("อนุมัติสำเร็จ! ไม่มียอดคลาดเคลื่อน");
      }
      queryClient.invalidateQueries({ queryKey: ["countDetail", countId] });
      queryClient.invalidateQueries({ queryKey: ["counts"] });
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.message || "อนุมัติไม่สำเร็จ");
    },
  });

  const cxMutation = useMutation({
    mutationFn: cancelCount,
    onSuccess: () => {
      message.success("ยกเลิกสำเร็จ!");
      queryClient.invalidateQueries({ queryKey: ["countDetail", countId] });
      queryClient.invalidateQueries({ queryKey: ["counts"] });
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.message || "ยกเลิกไม่สำเร็จ");
    },
  });

  const handleApprove = () => {
    Modal.confirm({
      title: "ยืนยันผลการตรวจนับสต็อก?",
      content: "เมื่ออนุมัติแล้ว หากมียอดนับจริง (Counted) ไม่ตรงกับ ในระบบ (System) ระบบจะสร้างใบ ADJ เพื่อปรับยอดอัตโนมัติ การดำเนินการนี้ไม่สามารถย้อนกลับได้",
      onOk: () => appMutation.mutate(countId),
      okText: "ยืนยันผล",
      cancelText: "ปิด",
      centered: true,
    });
  };

  const handleCancel = () => {
    Modal.confirm({
      title: "ยืนยันการยกเลิก?",
      content: "คุณแน่ใจหรือไม่ที่จะยกเลิกเอกสารนี้?",
      onOk: () => cxMutation.mutate(countId),
      okText: "ยืนยัน",
      cancelText: "ปิด",
      centered: true,
      okButtonProps: { danger: true },
    });
  };

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (isError || !data) return <Result status="404" title="ไม่พบข้อมูล" />;

  const { header, items } = data;

  let hStatusColor = "default";
  if (header.status === "APPROVED") hStatusColor = "success";
  if (header.status === "CANCELLED") hStatusColor = "error";

  const columns = [
    {
      title: "สินคัา",
      render: (_: any, r: CountItem) => `${r.product_code} - ${r.product_name}`,
    },
    {
      title: "ยอดในระบบ (System Qty)",
      dataIndex: "system_qty",
      align: "right" as const,
      render: (v: number) => <Text type="secondary">{Number(v).toLocaleString()}</Text>
    },
    {
      title: "ยอดนับจริง (Counted Qty)",
      dataIndex: "counted_qty",
      align: "right" as const,
      render: (v: number) => <Text strong>{Number(v).toLocaleString()}</Text>
    },
    {
      title: "ส่วนต่าง (Variance)",
      dataIndex: "variance_qty",
      align: "right" as const,
      render: (v: number) => {
        const val = Number(v);
        if (val === 0) return <Text type="success">ตรงกัน</Text>;
        if (val > 0) return <Text type="success">เกิน +{val.toLocaleString()}</Text>;
        return <Text type="danger">ขาด {val.toLocaleString()}</Text>;
      }
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/stock/counts")} />
          <Title level={3} className="!mb-0">รายละเอียดการตรวจนับ: {header.doc_no}</Title>
          <Tag color={hStatusColor} className="ml-2 text-sm">
            {header.status}
          </Tag>
        </div>
        <Space>
          {header.status === "DRAFT" && (
            <>
              <Button danger onClick={handleCancel} loading={cxMutation.isPending}>
                ยกเลิก (Cancel)
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleApprove} loading={appMutation.isPending}>
                ยืนยันผลการตรวจนับ (Approve)
              </Button>
            </>
          )}
        </Space>
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <Text type="secondary" className="block text-xs">วันที่ตรวจนับ</Text>
            <Text className="font-semibold">{dayjs(header.issue_date).format("DD/MM/YYYY")}</Text>
          </div>
          <div>
            <Text type="secondary" className="block text-xs">คลังสินค้า</Text>
            <Text className="font-semibold">{header.warehouse_name}</Text>
          </div>
          <div>
            <Text type="secondary" className="block text-xs">ADJ Reference</Text>
            {header.adjustment_id && header.adjustment_doc_no ? (
              <Link to={`/stock/adjustments/${header.adjustment_id}`} className="text-blue-600 font-semibold hover:underline">
                {header.adjustment_doc_no}
              </Link>
            ) : (
               <Text className="font-semibold">-</Text>
            )}
          </div>
          <div>
            <Text type="secondary" className="block text-xs">หมายเหตุ</Text>
            <Text>{header.note || "-"}</Text>
          </div>
        </div>
      </Card>

      <Card title={`ผลการเปรียบเทียบ (${items.length} รายการ)`} bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
}
