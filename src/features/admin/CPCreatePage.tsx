import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, Form, Input, DatePicker, Select, Button, message, InputNumber, Row, Col, Typography, Divider } from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../../lib/api";

const { Title, Text } = Typography;

export default function CPCreatePage() {
  const { state } = useLocation();
  const nav = useNavigate();
  const [form] = Form.useForm();
  
  const seller = state?.selectedSeller;
  const initialItems = state?.payingItems || [];
  
  const [items, setItems] = useState<any[]>(initialItems);
  const [financeAccounts, setFinanceAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!seller || initialItems.length === 0) {
      message.error("ไม่พบข้อมูลพนักงานหรือบิลที่ต้องการจ่าย กรุณาไปที่หน้าจัดการค่าคอมมิชชั่นก่อน");
      nav("/admin/commissions");
      return;
    }
    
    api.get("/finance-accounts").then((res) => {
      setFinanceAccounts(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {
       message.error("โหลดข้อมูลบัญชีไม่สำเร็จ");
    });
    
    form.setFieldsValue({
      paid_date: dayjs(),
      finance_account_id: null,
      note: ""
    });
  }, [seller, initialItems, nav, form]);

  const updateItem = (sale_id: number, paid_amount: number) => {
    setItems(items.map(it => it.sale_id === sale_id ? { ...it, paid_amount } : it));
  };
  
  const totalAmount = useMemo(() => {
     return items.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
  }, [items]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!values.finance_account_id) {
         return message.error("กรุณาเลือกช่องทางการเงิน");
      }
      
      const payload = {
        seller_id: seller.seller_id,
        from: state?.dateRange?.[0] ? dayjs(state.dateRange[0]).format("YYYY-MM-DD") : null,
        to: state?.dateRange?.[1] ? dayjs(state.dateRange[1]).format("YYYY-MM-DD") : null,
        finance_account_id: values.finance_account_id,
        note: values.note,
        amount: totalAmount,
        invoice_ids: items.map(it => it.sale_id),
        items: items.map(it => ({
          sale_id: it.sale_id,
          original_amount: Number(it.original_amount || 0),
          paid_amount: Number(it.paid_amount || 0)
        }))
      };
      
      setSaving(true);
      await api.post("/commissions/pay", payload);
      message.success("สร้างใบสำคัญจ่ายค่าคอมมิชชั่น(CP) เรียบร้อยแล้ว");
      nav("/admin/commissions", { state: { refresh: true } });
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (!seller) return null;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)} />
            <div>
              <Title level={4} className="!m-0">สร้างเอกสารจ่าย (Commission Payment)</Title>
              <Text type="secondary">ตรวจสอบและยืนยันบิลรายการสำหรับจ่ายค่าคอมมิชชั่น</Text>
            </div>
         </div>
         <Button type="primary" size="large" icon={<SaveOutlined />} onClick={handleSubmit} loading={saving} className="bg-orange-600 hover:bg-orange-500">
            ยืนยันการทำรายการ
         </Button>
      </div>
      
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          {/* ข้อมูลหลัก */}
          <Col xs={24} lg={16}>
            <Card className="mb-4">
              <Row gutter={16}>
                 <Col span={12}>
                    <Form.Item label="ประเภทชื่อเอกสารที่จะสร้าง">
                       <Input value="ใบสำคัญจ่ายค่าคอมมิชชั่น (CP)" readOnly className="bg-gray-50 text-gray-700 font-medium" />
                    </Form.Item>
                 </Col>
                 <Col span={12}>
                    <Form.Item label={<>เลขที่เอกสาร <span className="text-gray-400 text-xs">(CP No)</span></>}>
                       <Input value="สร้างอัตโนมัติ" readOnly className="bg-gray-50 text-gray-500 text-center" />
                    </Form.Item>
                 </Col>
              </Row>
              <Row gutter={16}>
                 <Col span={12}>
                    <Form.Item label="พนักงาน (ผู้รับเงิน)">
                       <Input value={seller.seller_name} readOnly className="bg-gray-50" />
                    </Form.Item>
                 </Col>
                 <Col span={12}>
                    <Form.Item label="วันที่เอกสาร" name="paid_date" rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}>
                       <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                 </Col>
              </Row>
              <Row gutter={16}>
                 <Col span={12}>
                    <Form.Item label={<>ช่องทางการจัดจ่าย <span className="text-red-500 ml-1">*</span></>} name="finance_account_id" rules={[{ required: true, message: 'กรุณาเลือกบัญชี' }]}>
                       <Select 
                         placeholder="เลือกบัญชีคลังที่ใช้จ่าย..." 
                         options={financeAccounts.map(a => ({ 
                           value: a.id, 
                           label: `${a.name} (ยอดเงิน: ฿${Number(a.balance).toLocaleString()})`
                         }))} 
                       />
                    </Form.Item>
                 </Col>
              </Row>
              <Row gutter={16}>
                 <Col span={24}>
                    <Form.Item label="หมายเหตุ" name="note">
                       <Input.TextArea rows={3} placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)" />
                    </Form.Item>
                 </Col>
              </Row>
            </Card>
            
            <Divider plain><span className="text-gray-500 text-sm">รายการบิลที่จ่าย ({items.length} รายการ</span>)</Divider>
            
            {items.map((it, idx) => (
              <Card key={it.sale_id} size="small" className="mb-3 border border-gray-200 shadow-sm rounded-lg" bodyStyle={{ padding: 16 }}>
                 <div className="font-semibold text-gray-700 mb-3 text-[13px] flex items-center justify-between">
                     <span>รายการที่ {idx + 1}</span>
                 </div>
                 <Row gutter={[16, 16]} align="middle">
                    <Col xs={12} md={4}>
                       <div className="text-xs text-gray-500 mb-1">เลขที่บิลอ้างอิง</div>
                       <Input value={it.invoice_no} readOnly className="bg-gray-50" />
                    </Col>
                    <Col xs={12} md={4}>
                       <div className="text-xs text-gray-500 mb-1">วันที่ออกบิล</div>
                       <Input value={dayjs(it.issue_date).format("DD/MM/YYYY")} readOnly className="bg-gray-50" />
                    </Col>
                    <Col xs={12} md={4}>
                       <div className="text-xs text-gray-500 mb-1">ยอดขายรวม</div>
                       <Input value={Number(it.invoice_total).toLocaleString(undefined, { minimumFractionDigits: 2 })} readOnly className="bg-gray-50" />
                    </Col>
                    <Col xs={12} md={4}>
                       <div className="text-xs text-gray-500 mb-1">ค่าคอมเดิม</div>
                       <Input value={Number(it.original_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} readOnly className="bg-orange-50/50 text-gray-500" />
                    </Col>
                    <Col xs={12} md={4}>
                       <div className="text-xs font-semibold text-orange-600 mb-1">ยอดที่จ่ายจริง</div>
                       <InputNumber 
                         value={it.paid_amount} 
                         onChange={(v) => updateItem(it.sale_id, Number(v || 0))} 
                         className="w-full font-bold border-orange-300" 
                         min={0}
                       />
                    </Col>
                    <Col xs={24} md={4}>
                       <div className="text-xs text-blue-500 mb-1">ต้นทุน / กำไร</div>
                       <div className="flex flex-col text-[11px]">
                         <span className="text-gray-500">ทุน: ฿{Number(it.cost_total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                         <span className="font-semibold text-blue-600">กำไร: ฿{Number(it.profit_total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                       </div>
                    </Col>
                 </Row>
                 <div className="text-xs text-gray-400 mt-2">* กรุณาครวญสอบยอดที่จ่ายจริงให้ถูกต้องก่อนบันทึก</div>
              </Card>
            ))}
          </Col>
          
          {/* Summary Sidebar */}
          <Col xs={24} lg={8}>
             <Card title="สรุปข้อมูล (Summary)" className="sticky top-4 border-gray-200">
                <div className="space-y-4 pb-2">
                   <div className="flex justify-between items-center text-gray-600">
                      <span>รวมจำนวนบิล</span>
                      <span className="font-medium">{items.length} บิล</span>
                   </div>
                   <div className="flex justify-between items-center text-gray-600">
                      <span>ยอดคอมมิชชั่นเดิมรวม</span>
                      <span className="font-medium">{items.reduce((sum, item) => sum + Number(item.original_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                   </div>
                   
                   <Divider className="!my-3" />
                   
                   <div className="flex justify-between items-end">
                      <span className="text-gray-700 font-semibold mb-1">ยอดรวมสุทธิ</span>
                      <span className="text-3xl font-bold text-orange-600">฿{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
                   <div className="text-[11px] text-gray-400 mt-1 text-right">
                       * ยอดรวมที่ต้องตัดบัญชี
                   </div>
                </div>
             </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
