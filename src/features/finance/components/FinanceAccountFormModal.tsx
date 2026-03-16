import { Modal, Form, Input, Select, InputNumber } from "antd";
import { useEffect } from "react";
import { MoreOutlined } from "@ant-design/icons";
import type { FinanceAccount, FinanceAccountData } from "../financeApi";

const renderOption = (imgSrc: string | null, text: string) => (
  <div className="flex items-center gap-3">
    {imgSrc ? (
      <img src={imgSrc} alt={text} className="w-6 h-6 object-contain shrink-0 rounded-sm" />
    ) : (
      <div className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-gray-400 text-xs border border-gray-200 shrink-0">
        <MoreOutlined />
      </div>
    )}
    <span className="font-medium text-gray-700 truncate">{text}</span>
  </div>
);

// We need value (for form), label (for display in dropdown list), and text (for display in input when selected)
const BANK_OPTIONS = [
  { value: "ธนาคารกสิกรไทย (KBANK)", label: renderOption("/img/kbank.jpg", "ธนาคารกสิกรไทย (KBANK)"), text: "ธนาคารกสิกรไทย (KBANK)" },
  { value: "ธนาคารไทยพาณิชย์ (SCB)", label: renderOption("/img/scb.jpg", "ธนาคารไทยพาณิชย์ (SCB)"), text: "ธนาคารไทยพาณิชย์ (SCB)" },
  { value: "ธนาคารกรุงเทพ (BBL)", label: renderOption("/img/bbl.jpg", "ธนาคารกรุงเทพ (BBL)"), text: "ธนาคารกรุงเทพ (BBL)" },
  { value: "ธนาคารกรุงไทย (KTB)", label: renderOption("/img/ktb.jpg", "ธนาคารกรุงไทย (KTB)"), text: "ธนาคารกรุงไทย (KTB)" },
  { value: "ธนาคารกรุงศรีอยุธยา (BAY)", label: renderOption("/img/bay.jpg", "ธนาคารกรุงศรีอยุธยา (BAY)"), text: "ธนาคารกรุงศรีอยุธยา (BAY)" },
  { value: "ธนาคารทหารไทยธนชาต (TTB)", label: renderOption("/img/ttb.jpg", "ธนาคารทหารไทยธนชาต (TTB)"), text: "ธนาคารทหารไทยธนชาต (TTB)" },
  { value: "ธนาคารออมสิน (GSB)", label: renderOption("/img/gsb.jpg", "ธนาคารออมสิน (GSB)"), text: "ธนาคารออมสิน (GSB)" },
  { value: "ธนาคารเพื่อการเกษตรและสหกรณ์ (BAAC)", label: renderOption("/img/baac.jpg", "ธนาคารเพื่อการเกษตรและสหกรณ์ (BAAC)"), text: "ธนาคารเพื่อการเกษตรและสหกรณ์ (BAAC)" },
  { value: "OTHER", label: renderOption(null, "อื่นๆ (พิมพ์รหัส/ชื่อธนาคารเอง)"), text: "อื่นๆ (พิมพ์รหัส/ชื่อธนาคารเอง)" }
];

const EWALLET_OPTIONS = [
  { value: "TrueMoney Wallet", label: renderOption("/img/truemoney.jpg", "TrueMoney Wallet"), text: "TrueMoney Wallet" },
  { value: "PromptPay", label: renderOption("/img/promptpay.jpg", "พร้อมเพย์ (PromptPay)"), text: "พร้อมเพย์ (PromptPay)" },
  { value: "PayPal", label: renderOption("/img/paypal.jpg", "PayPal"), text: "PayPal" },
  { value: "Alipay", label: renderOption("/img/alipay.jpg", "Alipay"), text: "Alipay" },
  { value: "WeChat Pay", label: renderOption("/img/wechat.jpg", "WeChat Pay"), text: "WeChat Pay" },
  { value: "Rabbit LINE Pay", label: renderOption("/img/linepay.jpg", "Rabbit LINE Pay"), text: "Rabbit LINE Pay" },
  { value: "ShopeePay", label: renderOption("/img/shopeepay.jpg", "ShopeePay"), text: "ShopeePay" },
  { value: "OTHER", label: renderOption(null, "อื่นๆ (พิมพ์ชื่อเอง)"), text: "อื่นๆ (พิมพ์ชื่อเอง)" }
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (values: FinanceAccountData) => Promise<void>;
  initialData: FinanceAccount | null;
}

export default function FinanceAccountFormModal({ open, onClose, onSave, initialData }: Props) {
  const [form] = Form.useForm<FinanceAccountData & { custom_provider_name?: string }>();
  const type = Form.useWatch("type", form);
  const providerName = Form.useWatch("provider_name", form);

  useEffect(() => {
    if (open) {
      if (initialData) {
        let formProvider = initialData.provider_name;
        let formCustom = "";

        if (initialData.type === "BANK" && initialData.provider_name) {
          if (!BANK_OPTIONS.find(o => o.value === initialData.provider_name)) {
            formProvider = "OTHER";
            formCustom = initialData.provider_name;
          }
        } else if (initialData.type === "EWALLET" && initialData.provider_name) {
          if (!EWALLET_OPTIONS.find(o => o.value === initialData.provider_name)) {
            formProvider = "OTHER";
            formCustom = initialData.provider_name;
          }
        }

        form.setFieldsValue({
          ...initialData,
          provider_name: formProvider,
          custom_provider_name: formCustom,
        } as any);
      } else {
        form.resetFields();
        form.setFieldValue("type", "CASH");
        form.setFieldValue("balance", 0);
      }
    }
  }, [open, initialData, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData: any = { ...values };
      
      if (submitData.provider_name === "OTHER") {
        submitData.provider_name = submitData.custom_provider_name;
      }
      delete submitData.custom_provider_name;
      
      await onSave(submitData);
    } catch (err) {
      // Validate Failed
    }
  };

  return (
    <Modal
      title={initialData ? "แก้ไขช่องทางการเงิน" : "เพิ่มช่องทางการเงิน"}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="บันทึก"
      cancelText="ยกเลิก"
      centered
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          name="type"
          label="ประเภทบัญชี"
          rules={[{ required: true, message: "กรุณาเลือกประเภทบัญชี" }]}
        >
          <Select
            options={[
              { value: "CASH", label: "เงินสด" },
              { value: "BANK", label: "ธนาคาร" },
              { value: "EWALLET", label: "e-Wallet / กระเป๋าเงินดิจิตอล" },
              { value: "ADVANCE", label: "สำรองจ่าย / เงินสดย่อย" },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="name"
          label="ชื่อเรียกบัญชี"
          rules={[{ required: true, message: "กรุณาระบุชื่อเรียกบัญชี" }]}
          tooltip="ชื่อเอาไว้แสดงให้จำง่ายๆ เช่น เงินสดหน้าร้าน, กสิกรบัญชีหลัก, TrueMoney เบอร์สำนักงาน"
        >
          <Input placeholder="เช่น เงินสดหน้าร้าน, บัญชีกสิกรหลัก" />
        </Form.Item>

        {/* Bank & e-Wallet Shared Fields */}
        {(type === "BANK" || type === "EWALLET") && (
          <>
            <Form.Item
              name="provider_name"
              label={type === "BANK" ? "ธนาคารผู้ให้บริการ" : "ผู้ให้บริการ E-Wallet"}
              rules={[{ required: true, message: "กรุณาเลือกผู้ให้บริการ" }]}
            >
              <Select 
                options={type === "BANK" ? BANK_OPTIONS : EWALLET_OPTIONS}
                placeholder="เลือกผู้ให้บริการ" 
                showSearch
                optionRender={(option) => option.data.label}
                labelRender={(props) => props.value}
                filterOption={(input, option) =>
                  (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                }
                dropdownStyle={{ minWidth: 250 }}
              />
            </Form.Item>

            {providerName === "OTHER" && (
              <Form.Item
                name="custom_provider_name"
                label="ระบุชื่อผู้ให้บริการ"
                rules={[{ required: true, message: "กรุณาระบุชื่อผู้ให้บริการ" }]}
              >
                 <Input placeholder="เช่น ธนาคารอาคารสงเคราะห์, Skrill" />
              </Form.Item>
            )}

            <Form.Item
              name="account_no"
              label={type === "BANK" ? "เลขบัญชีธนาคาร" : "หมายเลข E-Wallet (เบอร์โทร หรือ อีเมล)"}
              rules={[{ required: true, message: "กรุณาระบุข้อมูล" }]}
            >
              <Input placeholder={type === "BANK" ? "เช่น 000-0-00000-0" : "เช่น 0812345678, example@email.com"} />
            </Form.Item>

            <Form.Item
              name="account_name"
              label={type === "BANK" ? "ชื่อบัญชี" : "ชื่อเจ้าของ Wallet"}
            >
              <Input placeholder="เช่น บจก. ตัวอย่าง หรือ นาย สมชาย" />
            </Form.Item>
          </>
        )}

        {/* Advance Payment Specific Fields */}
        {type === "ADVANCE" && (
          <>
            <Form.Item
              name="person_name"
              label="ชื่อผู้ถือเงินสำรองจ่าย"
              rules={[{ required: true, message: "กรุณาระบุชื่อผู้ถือเงิน" }]}
            >
              <Input placeholder="ชื่อพนักงาน" />
            </Form.Item>

            <Form.Item
              name="contact_number"
              label="เบอร์ติดต่อ"
            >
              <Input placeholder="หมายเลขโทรศัพท์ติดต่อ" />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="balance"
          label="ยอดยกมาเริ่มต้น (บาท)"
          rules={[{ required: true, message: "กรุณาระบุยอดยกมา" }]}
        >
          <InputNumber
            className="w-full"
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            parser={(value) => value ? (value.replace(/\$\s?|(,*)/g, "") as any) : 0}
            precision={2}
            min={-999999999}
            disabled={!!initialData} // Usually you can't edit balance directly after creation without adjusting
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
