import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Table, Tag, Typography, message, Skeleton, Result, Space, Modal } from "antd";
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { getTransfer, approveTransfer, cancelTransfer } from "./transferApi";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export default function TransferDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const queryClient = useQueryClient();

  const transferId = Number(id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["transferDetail", transferId],
    queryFn: () => getTransfer(transferId),
    enabled: !!transferId,
  });

  const appMutation = useMutation({
    mutationFn: approveTransfer,
    onSuccess: () => {
      message.success("อนุมัติสำเร็จ!");
      queryClient.invalidateQueries({ queryKey: ["transferDetail", transferId] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.message || "อนุมัติไม่สำเร็จ");
    },
  });

  const cxMutation = useMutation({
    mutationFn: cancelTransfer,
    onSuccess: () => {
      message.success("ยกเลิกสำเร็จ!");
      queryClient.invalidateQueries({ queryKey: ["transferDetail", transferId] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.message || "ยกเลิกไม่สำเร็จ");
    },
  });

  const handleApprove = () => {
    Modal.confirm({
      title: "ยืนยันการอนุมัติการโอนย้าย?",
      content: "เมื่ออนุมัติแล้ว ระบบจะตัดสต็อกออกจากคลังต้นทาง และเพิ่มให้คลังปลายทางทันที (FIFO) การกระทำนี้ไม่สามารถย้อนกลับได้",
      onOk: () => appMutation.mutate(transferId),
      okText: "ยืนยัน",
      cancelText: "ปิด",
      centered: true,
    });
  };

  const handleCancel = () => {
    Modal.confirm({
      title: "ยืนยันการยกเลิก?",
      content: "คุณแน่ใจหรือไม่ที่จะยกเลิกเอกสารนี้?",
      onOk: () => cxMutation.mutate(transferId),
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
      render: (_: any, r: any) => `${r.product_code} - ${r.product_name}`,
    },
    {
      title: "จำนวน",
      dataIndex: "qty",
      align: "right" as const,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => nav("/stock/transfers")} />
          <Title level={3} className="!mb-0">รายละเอียดใบโอนย้าย: {header.doc_no}</Title>
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
                อนุมัติ (Approve)
              </Button>
            </>
          )}
        </Space>
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <Text type="secondary" className="block text-xs">วันที่เอกสาร</Text>
            <Text className="font-semibold">{dayjs(header.issue_date).format("DD/MM/YYYY")}</Text>
          </div>
          <div>
            <Text type="secondary" className="block text-xs">คลังสินค้าต้นทาง</Text>
            <Text className="font-semibold">{header.source_warehouse_name}</Text>
          </div>
          <div>
            <Text type="secondary" className="block text-xs">คลังสินค้าปลายทาง</Text>
            <Text className="font-semibold">{header.target_warehouse_name}</Text>
          </div>
          <div>
            <Text type="secondary" className="block text-xs">หมายเหตุ</Text>
            <Text>{header.note || "-"}</Text>
          </div>
        </div>
      </Card>

      <Card title={`รายการสินค้า (${items.length} รายการ)`} bodyStyle={{ padding: 0 }}>
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
