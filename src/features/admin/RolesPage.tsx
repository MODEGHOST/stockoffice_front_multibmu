import { useEffect, useState } from "react";
import { Button, Card, Table, Modal, Form, Input, message, Tag, Space, Checkbox, Spin, Divider } from "antd";
import { PlusOutlined, SafetyCertificateOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import api from "../../lib/api";
import { getMeCache, subscribeAuth } from "../../features/auth/authStore";

type RoleRow = {
  id: number;
  code: string;
  name: string;
  is_system: number;
  is_active: number;
  company_id: number | null;
};

type PermRow = {
  id: number;
  code: string;
  name: string;
  module: string;
};

const PERM_THAI_MAP: Record<string, string> = {
  // Modules
  "master": "ข้อมูลระบบพื้นฐาน (Master)",
  "purchase": "ระบบจัดซื้อ (Purchase)",
  "sales": "ระบบงานขาย (Sales)",
  "stock": "ระบบคลังสินค้า (Stock)",
  "system": "ผู้ดูแลส่วนกลาง (System)",

  // Permissions
  "master.company.manage": "จัดการตั้งค่าบริษัท",
  "master.user.manage": "จัดการผู้ใช้งาน",
  "master.role.manage": "จัดการตำแหน่งและสิทธิ์",
  "master.permission.manage": "จัดการสิทธิ์ของระบบ",
  "master.vendor.manage": "จัดการผู้จำหน่าย",
  "master.product.manage": "จัดการสินค้าและบริการ",
  "master.warehouse.manage": "จัดการคลังเก็บสินค้า",

  "purchase.po.manage": "จัดการใบสั่งซื้อ (PO)",
  "purchase.grn.manage": "จัดการใบรับสินค้า (GRN)",
  "purchase.bill.manage": "จัดการบิลซื้อ (Bill)",

  "sales.inv.manage": "จัดการเอกสารงานขายทั้งหมด",

  "stock.view": "ดูข้อมูลสต๊อก",
  "stock.adjust.manage": "จัดการใบปรับปรุงสต๊อก (ADJ)",
  "stock.manage": "จัดการรายการโอนย้ายและตรวจนับ",
  
  "system.admin": "สิทธิ์จัดการระบบขั้นสูงสุด",
};

export default function RolesPage() {
  const [me, setMe] = useState(getMeCache());
  
  useEffect(() => {
    return subscribeAuth(() => setMe(getMeCache()));
  }, []);

  const userRoles = me?.roles || [];

  const getRank = (code: string) => {
    if (code === 'system_owner') return 1;
    if (code === 'company_owner') return 2;
    if (code === 'company_admin') return 3;
    if (code === 'company_manage') return 4;
    if (code === 'company_user') return 5;
    return 6; 
  };
  const highestUserRank = Math.min(...userRoles.map(getRank), 99);
  const isSystemOwner = highestUserRank === 1;

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal 1: Create/Edit Role
  const [openRole, setOpenRole] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [targetRole, setTargetRole] = useState<RoleRow | null>(null);
  const [roleForm] = Form.useForm();

  // Modal 2: Manage Permissions
  const [openPerms, setOpenPerms] = useState(false);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [allPerms, setAllPerms] = useState<PermRow[]>([]);
  const [selectedPermIds, setSelectedPermIds] = useState<number[]>([]);

  useEffect(() => {
    loadRoles();
    loadAllPerms();
  }, []);

  async function loadRoles() {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/roles");
      setRoles(data?.rows || []);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }

  async function loadAllPerms() {
    try {
      const { data } = await api.get("/admin/permissions");
      setAllPerms(data?.rows || []);
    } catch (e) {
      console.error(e);
    }
  }

  // --- Role CRUD ---
  const onOpenCreate = () => {
    setTargetRole(null);
    roleForm.resetFields();
    setOpenRole(true);
  };

  const onOpenEdit = (r: RoleRow) => {
    setTargetRole(r);
    roleForm.setFieldsValue({ name: r.name });
    setOpenRole(true);
  };

  const submitRole = async () => {
    const v = await roleForm.validateFields();
    setSavingRole(true);
    try {
      if (targetRole) {
        await api.put(`/admin/roles/${targetRole.id}`, { name: v.name });
        message.success("แก้ไข Role สำเร็จ");
      } else {
        await api.post(`/admin/roles`, { name: v.name, code: `role_${Date.now()}` });
        message.success("เพิ่ม Role สำเร็จ");
      }
      setOpenRole(false);
      loadRoles();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Failed to save role");
    } finally {
      setSavingRole(false);
    }
  };

  const onDeleteRole = async (r: RoleRow) => {
    if (!window.confirm(`ยืนยันการลบตำแหน่ง "${r.name}" หรือไม่?`)) return;
    try {
      await api.delete(`/admin/roles/${r.id}`);
      message.success("ลบ Role สำเร็จ");
      loadRoles();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Cannot delete role");
    }
  };

  // --- Permissions Management ---
  const onOpenManagePerms = async (r: RoleRow) => {
    setTargetRole(r);
    setOpenPerms(true);
    setLoadingPerms(true);
    setSelectedPermIds([]);
    try {
      const { data } = await api.get(`/admin/roles/${r.id}/permissions`);
      setSelectedPermIds(data?.permission_ids || []);
    } catch (e: any) {
      message.error("Failed to load permissions");
    } finally {
      setLoadingPerms(false);
    }
  };

  const submitPerms = async () => {
    if (!targetRole) return;
    setSavingPerms(true);
    try {
      await api.put(`/admin/roles/${targetRole.id}/permissions`, {
        permission_ids: selectedPermIds,
      });
      message.success("อัปเดตสิทธิ์การใช้งานสำเร็จ");
      setOpenPerms(false);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Failed to save permissions");
    } finally {
      setSavingPerms(false);
    }
  };

  const togglePerm = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedPermIds(prev => [...prev, id]);
    } else {
      setSelectedPermIds(prev => prev.filter(x => x !== id));
    }
  };

  // Group perms by module
  const groupedPerms = allPerms.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {} as Record<string, PermRow[]>);

  const columns = [
    { 
      title: "ลำดับ", 
      key: "seq", 
      width: 60,
      render: (_: any, __: any, index: number) => index + 1
    },
    { 
      title: "ประเภท", 
      render: (_: any, r: RoleRow) => r.company_id === null ? <Tag color="orange">ระบบหลัก (Global)</Tag> : <Tag color="blue">บริษัท (Custom)</Tag>
    },
    { title: "ชื่อตำแหน่ง", dataIndex: "name", className: "font-semibold" },
    {
      title: "จัดการ",
      render: (_: any, r: RoleRow) => {
        const isCustom = r.company_id !== null;
        const rowRank = getRank(r.code);
        
        // Rule 1: Cannot manage roles higher to yourself
        // (Company Owner (2) can manage Admin (3) because 2 < 3)
        // Let's also allow them to view/manage their OWN rank level (<=)
        const canManage = highestUserRank <= rowRank || highestUserRank === 1;

        return (
          <Space>
            {r.code !== "system_owner" ? (
              <Button 
                size="small" 
                type="primary" 
                icon={<SafetyCertificateOutlined />} 
                onClick={() => onOpenManagePerms(r)}
                disabled={!canManage}
              >
                จัดการสิทธิ์การใช้งาน
              </Button>
            ) : (
              <Tag color="red" className="m-0 font-bold border-0 bg-red-50 text-red-600">Super Admin (All Access)</Tag>
            )}
            {isCustom && (
              <>
                <Button size="small" icon={<EditOutlined />} onClick={() => onOpenEdit(r)} disabled={highestUserRank > 2}>แก้ไขชื่อ</Button>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteRole(r)} disabled={highestUserRank > 2}>ลบ</Button>
              </>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <Card
        className="rounded-xl shadow-sm border-gray-100"
        title={
          <div className="font-semibold text-gray-700 flex items-center gap-2">
            <SafetyCertificateOutlined className="text-orange-500" /> 
            จัดการสิทธิ์การใช้งาน (Roles & Permissions)
          </div>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={onOpenCreate} className="px-6 rounded-lg">
            สร้างตำแหน่งใหม่
          </Button>
        }
      >
        <Table
          scroll={{ x: 'max-content' }}
          rowKey="id"
          loading={loading}
          dataSource={roles}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* Role Form Modal */}
      <Modal
        title={targetRole ? "แก้ไขชื่อตำแหน่ง" : "สร้างตำแหน่งใหม่"}
        open={openRole}
        onCancel={() => setOpenRole(false)}
        onOk={submitRole}
        confirmLoading={savingRole}
      >
        <Form layout="vertical" form={roleForm} className="mt-4">
          <Form.Item name="name" label="ชื่อตำแหน่ง (Role Name)" rules={[{ required: true }]}>
            <Input size="large" placeholder="เช่น ผู้จัดการฝ่ายขาย, ฝ่ายสต๊อก ฯลฯ" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Permissions Manage Modal */}
      <Modal
        title={
          <div>
            <span className="text-gray-500 text-sm">กำหนดสิทธิ์ของตำแหน่ง:</span><br/>
            <span className="text-xl text-orange-600 font-bold">{targetRole?.name}</span>
          </div>
        }
        open={openPerms}
        onCancel={() => setOpenPerms(false)}
        onOk={submitPerms}
        confirmLoading={savingPerms}
        width={700}
        bodyStyle={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 10 }}
      >
        {loadingPerms ? (
          <div className="text-center p-10"><Spin size="large"/></div>
        ) : (
          <div className="mt-4 flex flex-col gap-6">
            <div className="flex justify-end">
              <Checkbox 
                checked={selectedPermIds.length === allPerms.length && allPerms.length > 0}
                indeterminate={selectedPermIds.length > 0 && selectedPermIds.length < allPerms.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedPermIds(allPerms.map(p => p.id));
                  } else {
                    setSelectedPermIds([]);
                  }
                }}
                className="font-bold text-orange-600"
              >
                เลือกทั้งหมด (Select All)
              </Checkbox>
            </div>
            {Object.keys(groupedPerms).map(mod => (
              <div key={mod} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-bold text-gray-800 m-0 mb-3 bg-gray-200 px-3 py-1 inline-block rounded">
                  {PERM_THAI_MAP[mod] || mod}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groupedPerms[mod].map(p => (
                    <Checkbox 
                      key={p.id}
                      checked={selectedPermIds.includes(p.id)}
                      onChange={(e) => togglePerm(p.id, e.target.checked)}
                      className="text-gray-700"
                    >
                      <span className="font-medium text-blue-900">{PERM_THAI_MAP[p.code] || p.name}</span>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{p.code}</div>
                    </Checkbox>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
