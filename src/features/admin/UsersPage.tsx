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
      await api.put(`/api/admin/users/${targetUser?.id}/roles`, {
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

  return (
    <div className="p-4">
      <Card
        title="จัดการผู้ใช้ในบริษัท"
        extra={
          <Space>
            <Button type="primary" onClick={onOpenCreate}>
              เพิ่มผู้ใช้
            </Button>
          </Space>
        }
      >
        <Table
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
                  rs.map((r) => <Tag key={r.id}>{r.code}</Tag>)
                ) : (
                  <Tag>none</Tag>
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
                  <Button size="small" onClick={() => onOpenRoleModal(u)}>
                    กำหนด Role
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
            rules={[{ required: true, type: "email" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="phone"
            label="เบอร์โทร"
            rules={[{ required: true, min: 3 }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="password"
            label="รหัสผ่าน"
            rules={[{ required: true, min: 6 }]}
          >
            <Input.Password />
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
        title={`กำหนด Role: ${targetUser?.email || ""}`}
        open={openRoles}
        onCancel={() => setOpenRoles(false)}
        onOk={submitRoles}
        okText="บันทึก"
        centered
        confirmLoading={savingRoles}
        width={500}
      >
        <Form layout="vertical" form={roleForm}>
          <Form.Item
            name="role_id" 
            label="เลือก Role"
            rules={[{ required: true, message: "กรุณาเลือก Role" }]}
          >
            <Select
              placeholder="เลือก role"
              showSearch
              optionFilterProp="label"
              style={{ width: "100%" }}
              options={roles.map((r) => ({
                value: r.id,
                label: `${r.code} - ${r.name}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
