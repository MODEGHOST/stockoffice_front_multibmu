import { useState, useEffect } from "react";
import { Button, Card, Form, Input, Typography, message, Checkbox } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "./authStore";

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();

  const from = (location.state as any)?.from?.pathname || "/";

  useEffect(() => {
    const savedEmail = localStorage.getItem("remember_email");
    const savedPassword = localStorage.getItem("remember_password");
    const rememberMe = localStorage.getItem("remember_me") === "true";
    if (rememberMe && savedEmail && savedPassword) {
      form.setFieldsValue({
        email: savedEmail,
        password: savedPassword,
        remember: true
      });
    }
  }, [form]);

  async function onFinish(values: any) {
    try {
      setLoading(true);
      await login(values.email, values.password);
      
      // Handle Remember Me
      if (values.remember) {
        localStorage.setItem("remember_email", values.email);
        localStorage.setItem("remember_password", values.password);
        localStorage.setItem("remember_me", "true");
      } else {
        localStorage.removeItem("remember_email");
        localStorage.removeItem("remember_password");
        localStorage.removeItem("remember_me");
      }

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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-[420px] shadow-sm">
        <Title level={3} className="!mb-1">StockOffice</Title>
        <Text type="secondary">เข้าสู่ระบบเพื่อใช้งาน</Text>

        <Form 
          form={form}
          layout="vertical" 
          onFinish={onFinish} 
          className="mt-6"
          initialValues={{ remember: false }}
        >
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

          <Form.Item name="remember" valuePropName="checked" className="mb-4">
            <Checkbox>จดจำการเข้าสู่ระบบ (Remember me)</Checkbox>
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
          >
            เข้าสู่ระบบ
          </Button>

          <div className="mt-4 text-xs text-center text-gray-500">
            ใช้บัญชีทดสอบ: admin@company.com / 123456
          </div>
        </Form>
      </Card>
    </div>
  );
}
