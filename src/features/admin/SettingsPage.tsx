import { useEffect, useState } from "react";
import { Button, Card, Form, Input, message, Tabs, Table, Select, Tag } from "antd";
import api from "../../lib/api";

type Company = {
  id: number;
  name: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  is_active: number;
  doc_configs: DocConfig[];
};

type DocConfig = {
  doc_type: string; // QT, IV, PO, etc.
  prefix: string;
  reset_policy: "MONTHLY" | "DAILY" | "YEARLY" | "NONE";
  is_enabled: number;
};

export default function SettingsPage() {
  const [data, setData] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/company/settings");
      setData(data);
      form.setFieldsValue(data);
    } catch (e) {
      message.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function onSaveCompany(values: any) {
    setSaving(true);
    try {
      await api.put("/company/settings", values);
      message.success("Company info updated");
      load();
    } catch (e) {
      message.error("Failed to update company info");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveDocConfig(docType: string, values: any) {
    try {
      await api.put("/company/doc-configs", { 
         doc_type: docType, 
         prefix: values.prefix, 
         reset_policy: values.reset_policy 
      });
      message.success(`${docType} config updated`);
      load();
    } catch (e) {
      message.error("Failed to update config");
    }
  }

  const columns = [
    { title: "Type", dataIndex: "doc_type", key: "doc_type", width: 80, render: (v: string) => <Tag color="blue">{v || "Default"}</Tag> },
    { 
      title: "Prefix", 
      dataIndex: "prefix", 
      key: "prefix",
      render: (v: string, r: DocConfig) => (
         <Input 
            defaultValue={v} 
            onBlur={(e) => onSaveDocConfig(r.doc_type, { ...r, prefix: e.target.value })} 
            style={{ width: 120 }}
         />
      )
    },
    { 
      title: "Reset Policy", 
      dataIndex: "reset_policy", 
      key: "reset_policy",
      render: (v: string, r: DocConfig) => (
         <Select 
            defaultValue={v} 
            onChange={(val) => onSaveDocConfig(r.doc_type, { ...r, reset_policy: val })}
            style={{ width: 120 }}
         >
            <Select.Option value="DAILY">Daily</Select.Option>
            <Select.Option value="MONTHLY">Monthly</Select.Option>
            <Select.Option value="YEARLY">Yearly</Select.Option>
         </Select>
      )
    },
    { 
      title: "Example", 
      key: "example",
      render: (_: any, r: DocConfig) => {
         const d = new Date();
         const yyyy = d.getFullYear();
         const mm = String(d.getMonth()+1).padStart(2,'0');
         const dd = String(d.getDate()).padStart(2,'0');
         let s = r.prefix;
         if (r.reset_policy === 'DAILY') s += `${yyyy}${mm}${dd}-001`;
         else if (r.reset_policy === 'MONTHLY') s += `${yyyy}${mm}-001`;
         else if (r.reset_policy === 'YEARLY') s += `${yyyy}-001`;
         return <Tag>{s}</Tag>;
      }
    }
  ];

  const docTypes = ["QT", "IV", "RE", "DO", "Tax", "PO", "GRN", "IVT"]; 
  // Ensure we have rows for all types even if not in DB yet
  const docRows = docTypes.map(t => {
     const found = data?.doc_configs?.find(c => c.doc_type === t);
     return found || { doc_type: t, prefix: t + "-", reset_policy: "MONTHLY", is_enabled: 1 } as DocConfig;
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">System Settings</h1>
      
      <Tabs defaultActiveKey="1" items={[
        {
          key: "1",
          label: "Company Info",
          children: (
            <Card loading={loading}>
              <Form form={form} layout="vertical" onFinish={onSaveCompany}>
                <div className="grid grid-cols-2 gap-4">
                  <Form.Item label="Company Name" name="name" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item label="Tax ID" name="tax_id">
                    <Input />
                  </Form.Item>
                  <Form.Item label="Phone" name="phone">
                    <Input />
                  </Form.Item>
                  <Form.Item label="Email" name="email">
                    <Input />
                  </Form.Item>
                  <Form.Item label="Address" name="address" className="col-span-2">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </div>
                <Button type="primary" htmlType="submit" loading={saving}>Save Changes</Button>
              </Form>
            </Card>
          )
        },
        {
          key: "2",
          label: "Document Numbers",
          children: (
            <Card title="Running Number Configuration">
               <Table 
                 dataSource={docRows} 
                 columns={columns} 
                 rowKey="doc_type" 
                 pagination={false}
                 loading={loading}
               />
               <div className="mt-4 text-xs text-gray-400">
                  * Auto-saved when focus is lost or changed.
               </div>
            </Card>
          )
        }
      ]} />
    </div>
  );
}
