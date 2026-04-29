import { useEffect, useState } from "react";
import { Button, Form, Input, message, Tabs, Table, Select, Tag } from "antd";
import { SettingOutlined, SaveOutlined, BankOutlined, FileTextOutlined } from "@ant-design/icons";
import api from "../../lib/api";
import AddressSelect from "../../components/AddressSelect";

type Company = {
  id: number;
  name: string;
  tax_id: string;
  address: string;
  province?: string;
  district?: string;
  sub_district?: string;
  zip_code?: string;
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
      form.setFieldsValue({
        ...data,
        addressObj: {
          province: data.province,
          district: data.district,
          sub_district: data.sub_district,
          zip_code: data.zip_code,
        }
      });
    } catch (e) {
      message.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function onSaveCompany(values: any) {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        tax_id: values.tax_id,
        phone: values.phone,
        email: values.email,
        address: values.address,
        province: values.addressObj?.province || null,
        district: values.addressObj?.district || null,
        sub_district: values.addressObj?.sub_district || null,
        zip_code: values.addressObj?.zip_code || null,
      };

      await api.put("/company/settings", payload);
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
         if (r.reset_policy === 'DAILY') s += `${yyyy}${mm}${dd}-0001`;
         else if (r.reset_policy === 'MONTHLY') s += `${yyyy}${mm}-0001`;
         else if (r.reset_policy === 'YEARLY') s += `${yyyy}-0001`;
         return <Tag>{s}</Tag>;
      }
    }
  ];

  const docTypes = ["QT", "IV", "RE", "DO", "Tax", "PO", "GRN", "IVT", "TF"]; 
  // Ensure we have rows for all types even if not in DB yet
  const docRows = docTypes.map(t => {
     const found = data?.doc_configs?.find(c => c.doc_type === t);
     return found || { doc_type: t, prefix: t + "-", reset_policy: "MONTHLY", is_enabled: 1 } as DocConfig;
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <SettingOutlined className="text-3xl text-orange-500" />
        <h1 className="text-2xl font-bold m-0 text-gray-800">ตั้งค่าระบบ (System Settings)</h1>
      </div>
      
      <Tabs defaultActiveKey="1" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100" items={[
        {
          key: "1",
          label: <span className="flex items-center gap-2"><BankOutlined /> ข้อมูลบริษัท (Company Info)</span>,
          children: (
            <div className="py-2">
              <Form form={form} layout="vertical" onFinish={onSaveCompany}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <Form.Item label="Company Name (ชื่อบริษัท)" name="name" rules={[{ required: true }]}>
                    <Input size="large" />
                  </Form.Item>
                  <Form.Item 
                    label="Tax ID (เลขประจำตัวผู้เสียภาษี)" 
                    name="tax_id"
                    rules={[
                      { pattern: /^[0-9]{13}$/, message: "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก" }
                    ]}
                  >
                    <Input size="large" maxLength={13} />
                  </Form.Item>
                  <Form.Item 
                    label="Phone (เบอร์โทรศัพท์)" 
                    name="phone"
                    rules={[
                      { pattern: /^[0-9]{9,10}$/, message: "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก" }
                    ]}
                  >
                    <Input size="large" maxLength={10} />
                  </Form.Item>
                  <Form.Item 
                    label="Email (อีเมล)" 
                    name="email"
                    rules={[
                      { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" }
                    ]}
                  >
                    <Input size="large" />
                  </Form.Item>
                </div>
                
                <div className="mt-6 p-5 bg-orange-50/40 rounded-xl border border-orange-100">
                  <h3 className="text-sm font-bold text-gray-800 border-b border-orange-200 pb-2 mb-4">ข้อมูลที่ตั้ง (Address Information)</h3>
                  <Form.Item label="ที่อยู่ส่วนต้น (เลขที่, อาคาร, ชั้น, หมู่, ซอย, ถนน)" name="address" className="mb-4">
                    <Input size="large" placeholder="เช่น เลขที่ 123/4 หมู่ 5 อาคาร X ชั้น 9 ซอย Y ถนน Z" />
                  </Form.Item>
                  <Form.Item name="addressObj" className="mb-0">
                    <AddressSelect />
                  </Form.Item>
                </div>

                <div className="flex justify-end mt-4">
                  <Button type="primary" htmlType="submit" size="large" icon={<SaveOutlined />} loading={saving} className="px-8 rounded-lg">
                    บันทึกข้อมูล (Save)
                  </Button>
                </div>
              </Form>
            </div>
          )
        },
        {
          key: "2",
          label: <span className="flex items-center gap-2"><FileTextOutlined /> เลขที่เอกสาร (Document Numbers)</span>,
          children: (
            <div className="py-2">
               <div className="text-sm text-gray-500 mb-4">กำหนด รูปแบบตัวย่อ (Prefix) และการรีเซ็ตเลข Running Number ของแต่ละเอกสาร อัตโนมัติเมื่อกดเปลี่ยน</div>
               <Table 
                 scroll={{ x: 'max-content' }}
                 dataSource={docRows} 
                 columns={columns} 
                 rowKey="doc_type" 
                 pagination={false}
                 loading={loading}
                 bordered
                 className="rounded-lg overflow-hidden"
               />
               <div className="mt-4 text-xs text-gray-400">
                  * Auto-saved when focus is lost or changed.
               </div>
            </div>
          )
        }
      ]} />
    </div>
  );
}
