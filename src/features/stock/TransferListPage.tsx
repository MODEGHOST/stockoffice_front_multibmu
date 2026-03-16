import { useState } from "react";
import { Table, Button, Tag, Space, Input, Select } from "antd";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listTransfers } from "./transferApi";
import type { TransferListRow } from "./transferApi";

export default function TransferListPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["transfers", q, status, page],
    queryFn: () => listTransfers({ q, status, page, pageSize }),
  });

  const columns = [
    {
      title: "เลขที่",
      dataIndex: "doc_no",
      key: "doc_no",
      render: (val: string, record: TransferListRow) => (
        <Link to={`/stock/transfers/${record.id}`} className="text-blue-600 hover:underline">
          {val}
        </Link>
      ),
    },
    { title: "วันที่", dataIndex: "issue_date", key: "issue_date" },
    { title: "คลังต้นทาง", dataIndex: "source_warehouse_name", key: "source_warehouse_name" },
    { title: "คลังปลายทาง", dataIndex: "target_warehouse_name", key: "target_warehouse_name" },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      render: (val: string) => {
        let color = "default";
        if (val === "APPROVED") color = "success";
        if (val === "CANCELLED") color = "error";
        return <Tag color={color}>{val}</Tag>;
      },
    },
  ];

  return (
    <div className="bg-white p-6 rounded shadow">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">ใบโอนย้ายคลังสินค้า (Stock Transfer)</h1>
        <Link to="/stock/transfers/new">
          <Button type="primary">สร้างใบโอน (TF)</Button>
        </Link>
      </div>

      <Space className="mb-4">
        <Input.Search
          placeholder="ค้นหาเลขที่โอน..."
          onSearch={(val) => { setQ(val); setPage(1); }}
          allowClear
          style={{ width: 250 }}
        />
        <Select
          allowClear
          placeholder="ทุกสถานะ"
          style={{ width: 150 }}
          onChange={(val) => { setStatus(val || ""); setPage(1); }}
          options={[
            { label: "DRAFT", value: "DRAFT" },
            { label: "APPROVED", value: "APPROVED" },
            { label: "CANCELLED", value: "CANCELLED" },
          ]}
        />
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data?.rows || []}
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          onChange: (p) => setPage(p),
        }}
      />
    </div>
  );
}
