import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, Tag, Input, Select, Button, Modal } from "antd";
import api from "../../lib/api";
import dayjs from "dayjs";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<string | null>(null);

  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", { page, limit, search, actionFilter, entityFilter }],
    queryFn: async () => {
      const res = await api.get("/admin/audit-logs", {
        params: {
          page,
          limit,
          q: search,
          action: actionFilter || undefined,
          entity_type: entityFilter || undefined
        }
      });
      return res.data;
    }
  });

  const columns = [
    {
      title: "วัน-เวลา (Date)",
      dataIndex: "created_at",
      key: "created_at",
      render: (text: string) => dayjs(text).format("DD/MM/YYYY HH:mm:ss")
    },
    {
      title: "ผู้ใช้งาน (User)",
      key: "user",
      render: (_: any, r: any) => `${r.first_name} ${r.last_name || ""} (${r.email})`
    },
    {
      title: "การกระทำ (Action)",
      dataIndex: "action",
      key: "action",
      render: (text: string) => {
        const colorMap: Record<string, string> = { CREATE: "green", UPDATE: "orange", DELETE: "red", CANCEL: "volcano", LOGIN: "blue" };
        return <Tag color={colorMap[text] || "default"}>{text}</Tag>;
      }
    },
    {
      title: "ตารางที่ถูกแก้ไข (Entity)",
      dataIndex: "entity_type",
      key: "entity_type",
      render: (text: string, r: any) => `${text} #${r.entity_id}`
    },
    {
      title: "ข้อมูล (Data)",
      key: "data",
      render: (_: any, r: any) => (
        <Button size="small" type="link" onClick={() => setSelectedLog(r)}>
          ดูข้อมูลที่เปลี่ยน
        </Button>
      )
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ประวัติการใช้งาน (Audit Logs)</h1>
          <p className="text-gray-500">ตรวจสอบการเพิ่ม/ลบ/แก้ไขข้อมูลทั้งหมดในระบบ</p>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <Input.Search 
          placeholder="ค้นหาชื่อ, รหัส..." 
          onSearch={(v) => { setSearch(v); setPage(1); }} 
          style={{ width: 300 }} 
          allowClear 
        />
        <Select 
          placeholder="ทุก Action" 
          allowClear 
          style={{ width: 150 }} 
          onChange={(v) => { setActionFilter(v); setPage(1); }}
          options={[
             { value: "CREATE", label: "CREATE (สร้าง)" },
             { value: "UPDATE", label: "UPDATE (แก้ไข)" },
             { value: "DELETE", label: "DELETE (ลบ)" },
             { value: "CANCEL", label: "CANCEL (ยกเลิก)" }
          ]}
        />
        <Select 
          placeholder="ทุก Table" 
          allowClear 
          style={{ width: 150 }} 
          onChange={(v) => { setEntityFilter(v); setPage(1); }}
          options={[
             { value: "PRODUCT", label: "สินค้า (PRODUCT)" },
             { value: "VENDOR", label: "ผู้จำหน่าย (VENDOR)" },
             { value: "INVOICE", label: "ใบแจ้งหนี้/ขาย (INVOICE)" }
          ]}
        />
      </div>

      <Table 
        columns={columns}
        dataSource={data?.rows || []}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize: limit,
          total: data?.total || 0,
          onChange: (p, s) => { setPage(p); setLimit(s); }
        }}
        size="middle"
      />

      <Modal
        title={`รายละเอียดการเปลี่ยนแปลง (ID: #${selectedLog?.id})`}
        open={!!selectedLog}
        onCancel={() => setSelectedLog(null)}
        footer={null}
        width={800}
      >
        <div className="grid grid-cols-2 gap-4">
           <div>
             <h3 className="font-bold text-red-600 mb-2">ข้อมูลเก่า (Old Values)</h3>
             <pre className="bg-red-50 p-4 rounded-lg overflow-auto max-h-[400px] text-xs">
               {selectedLog?.old_values ? JSON.stringify(JSON.parse(selectedLog.old_values), null, 2) : "ไม่มี (N/A)"}
             </pre>
           </div>
           <div>
             <h3 className="font-bold text-green-600 mb-2">ข้อมูลใหม่ (New Values)</h3>
             <pre className="bg-green-50 p-4 rounded-lg overflow-auto max-h-[400px] text-xs">
               {selectedLog?.new_values ? JSON.stringify(JSON.parse(selectedLog.new_values), null, 2) : "ไม่มี (N/A)"}
             </pre>
           </div>
        </div>
      </Modal>
    </div>
  );
}
