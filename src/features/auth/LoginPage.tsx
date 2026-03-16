import { useState } from "react";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "./authStore";

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/";

  async function onFinish(values: { email: string; password: string }) {
    try {
      setLoading(true);
      await login(values.email, values.password);
      message.success("เข้าสู่ระบบสำเร็จ", 1.2);
      nav(from, { replace: true });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "เข้าสู่ระบบไม่สำเร็จ";
      message.error(msg, 2);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-[420px] shadow-sm">
        <Title level={3} className="!mb-1">StockOffice</Title>
        <Text type="secondary">เข้าสู่ระบบเพื่อใช้งาน</Text>

        <Form layout="vertical" onFinish={onFinish} className="mt-6">
          <Form.Item
            label="อีเมล"
            name="email"
            rules={[{ required: true, message: "กรอกอีเมล" }]}
          >
            <Input placeholder="admin@company.com" autoComplete="email" />
          </Form.Item>

          <Form.Item
            label="รหัสผ่าน"
            name="password"
            rules={[{ required: true, message: "กรอกรหัสผ่าน" }]}
          >
            <Input.Password placeholder="••••••" autoComplete="current-password" />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            className="mt-2"
          >
            เข้าสู่ระบบ
          </Button>

          <div className="mt-4 text-xs text-gray-500">
            ใช้บัญชีทดสอบ: admin@company.com / 123456
          </div>
        </Form>
      </Card>
    </div>
  );
}
