// src/features/admin/UsersPage.tsx
import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  message,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
} from "antd";
import { UsergroupAddOutlined, PlusOutlined, SafetyCertificateOutlined, KeyOutlined } from "@ant-design/icons";
import api from "../../lib/api";

type RoleRow = { id: number; code: string; name: string };

type UserRow = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  phone?: string;
  is_active: number | boolean;
  roles: RoleRow[];
};

export default function UsersPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);

  // create user
  const [openCreate, setOpenCreate] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [createForm] = Form.useForm();

  // role modal
  const [openRoles, setOpenRoles] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [roleForm] = Form.useForm();
  const [targetUser, setTargetUser] = useState<UserRow | null>(null);

  // reset password modal
  const [openResetPass, setOpenResetPass] = useState(false);
  const [savingResetPass, setSavingResetPass] = useState(false);
  const [resetPassForm] = Form.useForm();

  async function loadUsers(page = 1, limit = 20) {
    try {
      setLoading(true);

      // สำคัญ: ให้เรียก path ให้ "ตรงกับ api instance" ของคุณ
      // ถ้า api baseURL = "http://localhost:4000/api" => ใช้ "/admin/users"
      // ถ้า api baseURL = "http://localhost:4000" => ใช้ "/api/admin/users"
      const { data } = await api.get("/admin/users", {
        params: { page, limit },
      });

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
    } catch (e: any) {
      message.error(e?.response?.data?.message || "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function loadRoles() {
    try {
      const { data } = await api.get("/admin/roles");
      setRoles(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "โหลดรายการ Role ไม่สำเร็จ");
    }
  }

  useEffect(() => {
    loadUsers(1, 20);
  }, []);

  // ---------- Create ----------
  const onOpenCreate = () => {
    createForm.resetFields();
    createForm.setFieldsValue({ is_active: true });
    setOpenCreate(true);
  };

  const submitCreate = async () => {
    const v = await createForm.validateFields();
    setSavingCreate(true);
    try {
      await api.post("/admin/users", {
        first_name: v.first_name,
        last_name: v.last_name,
        email: v.email,
        phone: v.phone,
        password: v.password,
        display_name: v.display_name ?? null,
        is_active: Boolean(v.is_active),
        // ไม่ต้องส่ง role_ids ก็ได้ (ปล่อยให้ default [])
        // role_ids: [],
      });

      message.success("เพิ่มผู้ใช้สำเร็จ", 2);
      setOpenCreate(false);
      await loadUsers(1, 20);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "เพิ่มผู้ใช้ไม่สำเร็จ");
    } finally {
      setSavingCreate(false);
    }
  };

  // ---------- Roles ----------
  const onOpenRoleModal = async (u: UserRow) => {
    setTargetUser(u);
    await loadRoles();

    // preset role_ids จาก roles เดิมของ user
    roleForm.setFieldsValue({
      role_ids: (u.roles || []).map((r) => r.id),
    });

    setOpenRoles(true);
  };

  const submitRoles = async () => {
    const v = await roleForm.validateFields();

    setSavingRoles(true);
    try {
      await api.put(`/admin/users/${targetUser?.id}/roles`, {
        role_ids: v.role_id ? [v.role_id] : [],
      });

      message.success("บันทึก Role สำเร็จ", 2);
      setOpenRoles(false);
      await loadUsers(1, 20);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "บันทึก Role ไม่สำเร็จ");
    } finally {
      setSavingRoles(false);
    }
  };

  // ---------- Reset Password ----------
  const onOpenResetPass = (u: UserRow) => {
    setTargetUser(u);
    resetPassForm.resetFields();
    setOpenResetPass(true);
  };

  const submitResetPass = async () => {
    const v = await resetPassForm.validateFields();
    setSavingResetPass(true);
    try {
      // หมายเหตุ: อาจจะต้องปรับ URL หรือรูปแบบ parameter (เช่น password หรือ new_password) ตาม API ของ Backend
      await api.put(`/admin/users/${targetUser?.id}/reset-password`, {
        password: v.new_password,
      });

      message.success("รีเซ็ตรหัสผ่านสำเร็จ", 2);
      setOpenResetPass(false);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    } finally {
      setSavingResetPass(false);
    }
  };

  return (
    <div className="p-4">
      <Card
        className="rounded-xl shadow-sm border-gray-100"
        title={
          <div className="font-semibold text-gray-700 flex items-center gap-2">
            <UsergroupAddOutlined className="text-orange-500" /> 
            จัดการผู้ใช้ในบริษัท
          </div>
        }
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={onOpenCreate} className="px-6 rounded-lg">
              เพิ่มผู้ใช้
            </Button>
          </Space>
        }
      >
        <Table
          scroll={{ x: 'max-content' }}
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{
            total,
            pageSize: 20,
            onChange: (page, pageSize) => loadUsers(page, pageSize),
          }}
          columns={[
            { title: "Email", dataIndex: "email" },
            {
              title: "ชื่อ-นามสกุล",
              render: (_: any, u: UserRow) => {
                const full =
                  `${u.first_name || ""} ${u.last_name || ""}`.trim();
                return full || u.display_name || "-";
              },
            },
            {
              title: "Role",
              dataIndex: "roles",
              render: (rs: RoleRow[]) =>
                (rs || []).length ? (
                  rs.map((r) => <Tag color="blue" key={r.id}>{r.name || r.code}</Tag>)
                ) : (
                  <Tag color="default">ไม่มีสิทธิ์</Tag>
                ),
            },
            {
              title: "สถานะ",
              render: (_: any, u: UserRow) => {
                const active =
                  Number(u.is_active) === 1 || u.is_active === true;
                return active ? (
                  <Tag color="green">Active</Tag>
                ) : (
                  <Tag color="red">Inactive</Tag>
                );
              },
            },
            {
              title: "จัดการ",
              render: (_: any, u: UserRow) => (
                <Space>
                  <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => onOpenRoleModal(u)}>
                    กำหนด Role
                  </Button>
                  <Button size="small" danger icon={<KeyOutlined />} onClick={() => onOpenResetPass(u)}>
                    รีเซ็ต
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* ---------- Create Modal ---------- */}
      <Modal
        title="เพิ่มผู้ใช้"
        open={openCreate}
        onCancel={() => setOpenCreate(false)}
        onOk={submitCreate}
        okText="บันทึก"
        confirmLoading={savingCreate}
      >
        <Form layout="vertical" form={createForm}>
          <Form.Item
            name="first_name"
            label="ชื่อ"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="last_name"
            label="นามสกุล"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="email"
            label="อีเมล"
            rules={[
              { required: true, message: "กรุณาระบุอีเมล" },
              { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="phone"
            label="เบอร์โทร"
            rules={[
              { required: true, message: "กรุณาระบุเบอร์โทร" },
              { pattern: /^[0-9]{9,10}$/, message: "เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก" }
            ]}
          >
            <Input maxLength={10} />
          </Form.Item>

          <Form.Item
            name="password"
            label="รหัสผ่าน"
            rules={[{ required: true, min: 6 }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Form.Item name="display_name" label="Display Name (ถ้ามี)">
            <Input />
          </Form.Item>

          <Form.Item name="is_active" label="สถานะ" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---------- Roles Modal ---------- */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-lg text-gray-800">
            <SafetyCertificateOutlined className="text-orange-500 text-2xl" />
            กำหนดสิทธิ์การใช้งาน (Assign Role)
          </div>
        }
        open={openRoles}
        onCancel={() => setOpenRoles(false)}
        onOk={submitRoles}
        okText="ยืนยันการเปลี่ยนสิทธิ์"
        cancelText="ยกเลิก"
        centered
        confirmLoading={savingRoles}
        width={500}
      >
        <div className="bg-orange-50 rounded-lg p-4 mb-6 mt-2 border border-orange-100 flex items-center justify-between">
          <div>
             <div className="text-xs text-orange-600 font-semibold mb-1">กำลังจัดการสิทธิ์ของบัญชี:</div>
             <div className="text-gray-800 font-medium">{targetUser?.display_name || `${targetUser?.first_name || ""} ${targetUser?.last_name || ""}`.trim() || targetUser?.email}</div>
             <div className="text-gray-500 text-sm">{targetUser?.email}</div>
          </div>
        </div>

        <Form layout="vertical" form={roleForm} className="mt-4">
          <Form.Item
            name="role_id" 
            label={<span className="font-medium text-gray-700">เลือกระดับสิทธิ์ (Role)</span>}
            rules={[{ required: true, message: "กรุณาเลือก Role" }]}
          >
            <Select
              size="large"
              placeholder="-- กรุณาเลือกระดับสิทธิ์ --"
              showSearch
              optionFilterProp="label"
              style={{ width: "100%" }}
              options={[
                { value: null, label: "ไม่มีสิทธิ์ (None)" },
                ...roles.map((r) => ({
                  value: r.id,
                  label: `${r.code} - ${r.name}`,
                }))
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---------- Reset Password Modal ---------- */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-lg text-gray-800">
            <KeyOutlined className="text-red-500 text-2xl" />
            รีเซ็ตรหัสผ่าน (Reset Password)
          </div>
        }
        open={openResetPass}
        onCancel={() => setOpenResetPass(false)}
        onOk={submitResetPass}
        okText="ยืนยันการตั้งรหัสผ่านใหม่"
        cancelText="ยกเลิก"
        okButtonProps={{ danger: true }}
        centered
        confirmLoading={savingResetPass}
        width={450}
      >
        <div className="bg-red-50 rounded-lg p-3 mb-5 mt-2 border border-red-100">
           <div className="text-xs text-red-600 font-semibold mb-1">ระบุรหัสผ่านใหม่สำหรับ:</div>
           <div className="text-gray-800 font-medium">{targetUser?.email}</div>
        </div>

        <Form layout="vertical" form={resetPassForm}>
          <Form.Item
            name="new_password"
            label={<span className="font-medium text-gray-700">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</span>}
            rules={[
              { required: true, message: "กรุณาระบุรหัสผ่านใหม่" },
              { min: 6, message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
            ]}
          >
            <Input.Password size="large" placeholder="ระบุรหัสผ่านใหม่..." autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
