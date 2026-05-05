import { useEffect, useRef, useState, useMemo } from "react";
import { 
  Card, Button, Form, Select, Typography, Table, InputNumber, 
  Space, Modal, message, Row, Col, Divider, Switch, Result 
} from "antd";
import { PlusCircleOutlined, MinusCircleOutlined, DeleteOutlined, ScanOutlined, DollarOutlined, CheckCircleOutlined, SettingOutlined } from "@ant-design/icons";
import { Html5Qrcode } from "html5-qrcode";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { type Line, recalcLine, calcTotals, fmt } from "./invoiceCalc";

const { Title, Text } = Typography;

type Option = { value: number; label: string };

type CartItem = Line & {
  code: string;
  name: string;
  maxQty: number;
};

let scanAudioCtx: AudioContext | null = null;
const initAudio = () => {
    if (!scanAudioCtx) {
       const ACtx = window.AudioContext || (window as any).webkitAudioContext;
       if (ACtx) scanAudioCtx = new ACtx();
    }
}

const playLoudBeep = () => {
    try {
        if (!scanAudioCtx) initAudio();
        if (scanAudioCtx && scanAudioCtx.state === 'suspended') {
            scanAudioCtx.resume();
        }
        if (!scanAudioCtx) return;
        
        const osc = scanAudioCtx.createOscillator();
        const gain = scanAudioCtx.createGain();
        gain.gain.value = 1.0; 
        osc.type = "sine";
        osc.frequency.setValueAtTime(1500, scanAudioCtx.currentTime);
        osc.connect(gain);
        gain.connect(scanAudioCtx.destination);
        osc.start();
        setTimeout(() => {
            osc.stop();
            osc.disconnect();
        }, 150);
    } catch(e) {}
}

export default function ScanToSalePage() {
  const nav = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  
  const [form] = Form.useForm();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const editingLine = useMemo(() => cart.find(c => c.key === editingLineKey), [cart, editingLineKey]);
  
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [financeAccounts, setFinanceAccounts] = useState<any[]>([]);
  
  // Checkout
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{ id: number; code: string } | null>(null);

  const warehouseId = Form.useWatch("warehouse_id", form);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [whRes, custRes, finRes] = await Promise.all([
        api.get("/warehouses"),
        api.get("/vendors"),
        api.get("/finance-accounts")
      ]);
      setWarehouses(Array.isArray(whRes.data?.warehouses) ? whRes.data.warehouses : (Array.isArray(whRes.data) ? whRes.data : []));
      
      const vends = Array.isArray(custRes.data?.rows) ? custRes.data.rows : (Array.isArray(custRes.data) ? custRes.data : []);
      setCustomers(vends.filter((v: any) => (v.is_active === 1 || v.is_active === true) && (v.type === "CUSTOMER" || v.type === "BOTH" || !v.type)));

      const fins = Array.isArray(finRes.data?.rows) ? finRes.data.rows : (Array.isArray(finRes.data) ? finRes.data : []);
      setFinanceAccounts(fins);

    } catch (e) {
      message.error("โหลดข้อมูลเบื้องต้นไม่สำเร็จ");
    }
  }

  // ทำลายกล้องเมื่อออกจากหน้า
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(e => console.error(e));
      }
    };
  }, []);

  async function startCamera() {
    initAudio(); // ปลดล็อก Audio บน Safari ตอนเปิดกล้อง
    if (!warehouseId) {
      message.warning("กรุณาเลือกสาขา/คลังก่อนที่จะเปิดกล้อง");
      return;
    }
    try {
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScanSuccess,
        undefined
      );
      setScanning(true);
    } catch (err: any) {
      message.error("ไม่สามารถเปิดกล้องได้: " + (err?.message || "กรุณาตรวจสอบสิทธิ์การเข้าถึงกล้องเบราว์เซอร์"));
      setScanning(false);
    }
  }

  function stopCamera() {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current?.clear();
        setScanning(false);
      }).catch(() => setScanning(false));
    } else {
      setScanning(false);
    }
  }

  // สแกนเจอ
  async function handleScanSuccess(text: string) {
    if (!warehouseId) {
      message.warning("กรุณาเลือกคลังสินค้าก่อนสแกน!", 2);
      return;
    }
    if (processingRef.current) return;
    processingRef.current = true;

    try {

      // วิเคราะห์ข้อความสแกน ว่าเป็น URL (/p/:hash) หรือเป็น Product Code ปกติ
      let fetchUrl = "";
      if (text.includes("/p/")) {
        const hash = text.split("/p/")[1];
        fetchUrl = `/public/p/${hash}`;
      } else {
        // กรณีไม่ใช่ hash ถือว่าเป็นรหัสสินค้า สแกนผ่าน api ค้นหา
        const res = await api.get("/products", { params: { q: text, limit: 1 } });
        const rows = Array.isArray(res.data) ? res.data : res.data?.rows || [];
        if (rows.length === 0) throw new Error("ไม่พบสินค้านี้");
        
        // ถ้าเป็น api ค้นหาปกติ เราต้องเช็คสต๊อกด้วย (เพื่อเช็ค Max Qty) 
        // ดังนั้นใช้ท่าเดียวกับ public ก็ได้ถ้าเรามี hash 
        // แต่เพื่อความไว เราเอา ID มาหาในฝั่ง user ก็ได้
        fetchUrl = `/products/${rows[0].id}`; // โหลดชัวร์ๆ
      }

      // ดึงข้อมูลสินค้า
      const productRes = await api.get(fetchUrl, { headers: { Authorization: fetchUrl.includes("public") ? "" : undefined } });
      const product = await getFullProductStockDetails(productRes.data, text);

      if (!product) {
         message.error("สินค้าหมด หรือไม่พบข้อมูลในคลังนี้");
         return;
      }

      // ใส่ตะกร้า
      setCart(prev => {
        const existIdx = prev.findIndex(c => c.product_id === product.id);
        if (existIdx >= 0) {
          const next = [...prev];
          const currQty = next[existIdx].quantity || 0;
          if (currQty + 1 > product.maxQty) {
            message.warning(`สินค้า ${product.name} มีสต๊อกจำกัดแค่ ${product.maxQty}`);
            return prev;
          }
          const updated = recalcLine({ ...next[existIdx], quantity: currQty + 1 }) as CartItem;
          updated.code = next[existIdx].code;
          updated.name = next[existIdx].name;
          updated.maxQty = next[existIdx].maxQty;
          next[existIdx] = updated;
          message.success(`เพิ่ม ${product.name} (+1)`, 1);
          playLoudBeep();
          return next;
        } else {
           message.success(`สแกนเจอ ${product.name} เรียบร้อย`, 1);
           playLoudBeep();
           const newLine = recalcLine({
             key: String(Date.now()),
             product_id: product.id,
             product_label: product.name,
             quantity: 1,
             price: product.price || 0,
             discount_percent: 0,
             discount_amount: 0,
             vat_mode: "EXCL",
             vat_rate: 7,
             commission_mode: "PERCENT",
             commission_value: 0,
             withholding_rate: 0
           }) as CartItem;
           newLine.code = product.code;
           newLine.name = product.name;
           newLine.maxQty = product.maxQty;
           return [...prev, newLine];
        }
      });

    } catch (e: any) {
      message.error("รหัสบาร์โค้ดไม่ถูกต้อง หรือหาสินค้าไม่พบ");
    } finally {
      setTimeout(() => {
        processingRef.current = false;
      }, 2000); // 2 วินาที cooldown (ช่วงเลื่อนสินค้าออกไป)
    }
  }

  // ดึงรายละเอียด + สต๊อก เพื่อประกอบร่างลง Cart
  async function getFullProductStockDetails(data: any, originalScanned: string) {
    // data อาจจะมาจาก /public/p ซึ่งไม่มี id หรือราคา! เพราะ public ปิดราคาไว้
    // ดังนั้นในโหมดพนักงานสแกน เราต้องหา productID เสมอ 
    let pId = data.id;
    let codeStr = data.code;
    
    // ถ้ามาจาก public hash จะมีแค่ code
    if (!pId) {
      const pRes = await api.get("/products", { params: { q: data.code, limit: 1 } });
      const rows = Array.isArray(pRes.data) ? pRes.data : pRes.data?.rows || [];
      if (rows.length > 0) pId = rows[0].id;
    }

    if (!pId) return null;

    // โหลดสต๊อกประจำคลัง
    const stockRes = await api.get("/stock/summary");
    const summaries = Array.isArray(stockRes.data) ? stockRes.data : [];
    const whStock = summaries.find((s: any) => Number(s.product_id) === Number(pId) && Number(s.warehouse_id) === Number(warehouseId));
    
    const maxQty = whStock ? Number(whStock.qty) : 0;
    if (maxQty <= 0) return null;

    // หาราคาขายของสินค้านั้น
    const detail = await api.get(`/products/${pId}`);
    return {
      id: pId,
      code: codeStr,
      name: detail.data.name,
      price: Number(detail.data.sell_price || 0),
      maxQty
    };
  }

  // คำนวณยอดรวม
  const cartTotals = useMemo(() => calcTotals(cart), [cart]);
  const totals = cartTotals.total;

  // ซับมิตเปิด IV
  async function handleSubmitCheckout(values: any) {
    setSubmitting(true);
    try {
      if (cart.length === 0) throw new Error("ไม่มีสินค้าในตะกร้า");

      const salePayload = {
        customer_id: form.getFieldValue("customer_id"),
        warehouse_id: form.getFieldValue("warehouse_id"),
        issue_date: dayjs().format("YYYY-MM-DD"),
        note: "Auto-Sale via POS Scan",
        status: "QUOTATION", // สร้างเป็น QT เสมอในรอบแรก
        stock_deducted_at: "INVOICE",
        items: cart.map(c => ({
          product_id: c.product_id,
          quantity: c.quantity || 0,
          price: c.price || 0,
          commission_mode: c.commission_mode || "PERCENT",
          commission_value: c.commission_value || 0,
          total: c.total || ((c.quantity||0) * (c.price||0)),
          vat_mode: c.vat_mode || "EXCL", 
          vat_rate: c.vat_rate || 7,
          discount_percent: c.discount_percent || 0,
          discount_amount: c.discount_amount || 0,
          withholding_rate: c.withholding_rate || 0
        }))
      };

      // 1. สร้างเอกสาร /sales/invoice (QT)
      const resCreate = await api.post("/sales/invoice", salePayload);
      const saleId = resCreate.data?.id;
      if (!saleId) throw new Error("ไม่สามารถสร้างออเดอร์ได้");

      // 2. ยืนยันเอกสารเป็น INVOICE (และตัดสต๊อกทันที)
      await api.post(`/sales/invoice/${saleId}/confirm`, {
        stock_deducted_at: "INVOICE"
      });

      // 3. รับชำระเงิน (ถ้าเลือก)
      if (isPaid) {
        if (!values.finance_account_id) throw new Error("กรุณาเลือกบัญชีรับเงิน");
        await api.post(`/sales/invoice/${saleId}/payment`, {
          issue_tax: false,
          finance_account_id: values.finance_account_id
        });
      }

      setSuccessData({ id: saleId, code: resCreate.data?.code || "Success" });
      setCart([]);
      setCheckoutModal(false);
      
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "เกิดข้อผิดพลาดในการตัดสต๊อก");
    } finally {
      setSubmitting(false);
    }
  }

  if (successData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 min-h-[70vh]">
        <Result
          status="success"
          title="ยืนยันการขายสำเร็จและตัดสต๊อกแล้ว!"
          subTitle={`หมายเลขอ้างอิงออเดอร์: ซ่อนอยู่ในประวัติ Invoice ของระบบ (ID: ${successData.id})`}
          extra={[
            <Button key="view" onClick={() => nav(`/sales/invoice/${successData.id}`)}>ดูสลิปบิลเต็ม</Button>,
            <Button type="primary" key="new" onClick={() => { setSuccessData(null); setScanning(true); }}>กลับไปสแกนขายบิลต่อไป</Button>,
          ]}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-2">
        <div>
          <Title level={3} className="!mb-0"><ScanOutlined className="mr-2"/>สแกน</Title>
          <Text type="secondary">ระบบยิงบาร์โค้ดขายและตัดสต๊อกฉับไว</Text>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        {/* ซ้าย: ตั้งค่า และ กล้อง */}
        <Col xs={24} lg={8}>
          <Card size="small" title="1. ตั้งค่าบิล (เริ่มแรก)" className="shadow-sm mb-4">
            <Form form={form} layout="vertical">
              <Form.Item name="warehouse_id" label="สาขา/คลังที่จะหักของ" rules={[{ required: true }]}>
                <Select placeholder="เลือกสาขา" options={warehouses.map(w => ({ value: w.id, label: w.name }))} />
              </Form.Item>
              <Form.Item name="customer_id" label="เลือกลูกค้า" rules={[{ required: true }]}>
                <Select
                  showSearch optionFilterProp="label"
                  placeholder="เลือกลูกค้าทั่วไป"
                  options={customers.map(c => ({ value: c.id, label: `${c.code||""} ${c.name}` }))} 
                />
              </Form.Item>
            </Form>
          </Card>

          <Card 
            size="small" 
            title="2. กล้องสแกนบาร์โค้ด" 
            className={`shadow-sm border-2 ${scanning ? 'border-green-500' : 'border-gray-300'}`}
          >
            <div className="text-center mb-4">
               {scanning ? (
                 <Button danger block onClick={stopCamera}>ปิดกล้อง</Button>
               ) : (
                 <Button type="primary" block disabled={!warehouseId} onClick={startCamera}>
                    เปิดกล้องสแกน (รันค้างไว้ได้เลย)
                 </Button>
               )}
            </div>
            {/* กรอบ HTML5 Qrcode Scanner */}
            <div id="reader" className="w-full bg-black rounded-lg min-h-[250px] overflow-hidden"></div>
          </Card>
        </Col>

        {/* ขวา: ตะกร้า และชำระเงิน */}
        <Col xs={24} lg={16}>
          <Card size="small" title="3. ตะกร้าสินค้าเตรียมขาย" className="shadow-sm h-full flex flex-col">
            <div className="flex-1 overflow-auto rounded-lg border border-gray-200">
              <Table 
                dataSource={cart}
                pagination={false}
                scroll={{ y: 300, x: 600 }}
                rowKey="key"
                locale={{ emptyText: "ยังไม่มีสินค้าในตะกร้า ลองสแกนดูสิ!" }}
                columns={[
                  {
                    title: "สินค้า", dataIndex: "name", width: 200,
                    render: (t, r) => (<div><div className="font-semibold">{t}</div><Text type="secondary" className="text-xs">{r.code}</Text></div>)
                  },
                  {
                    title: "จำนวน", dataIndex: "quantity", align: "center", width: 120,
                    render: (q, r) => (
                      <Space>
                        <Button size="small" icon={<MinusCircleOutlined />} 
                          disabled={(q||1) <= 1} onClick={() => {
                            setCart(prev => prev.map(c => c.key === r.key ? Object.assign(recalcLine({ ...c, quantity: (c.quantity||1) - 1 }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c));
                          }} 
                        />
                        <span className="font-bold w-6 text-center">{q}</span>
                        <Button size="small" icon={<PlusCircleOutlined />} 
                           disabled={(q||0) >= r.maxQty} onClick={() => {
                            setCart(prev => prev.map(c => c.key === r.key ? Object.assign(recalcLine({ ...c, quantity: Math.min(r.maxQty, (c.quantity||0) + 1) }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c));
                          }} 
                        />
                      </Space>
                    )
                  },
                  {
                    title: "ราคาขาย/ชิ้น", dataIndex: "price", align: "right", width: 120,
                    render: (p, r) => (
                      <InputNumber min={0} value={p} className="w-full text-right"
                         onChange={(v) => setCart(prev => prev.map(c => c.key === r.key ? Object.assign(recalcLine({ ...c, price: Number(v||0) }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c))}
                      />
                    )
                  },
                  {
                    title: "คอม/ชิ้น", dataIndex: "commission_value", align: "right", width: 100,
                    render: (c, r) => (
                      <InputNumber min={0} value={c} className="w-full text-right"
                         onChange={(v) => setCart(prev => prev.map(line => line.key === r.key ? Object.assign(recalcLine({ ...line, commission_value: Number(v||0) }), { code: line.code, name: line.name, maxQty: line.maxQty }) as CartItem : line))}
                      />
                    )
                  },
                  {
                    title: "รวม", align: "right", width: 100,
                    render: (_, r) => <span className="font-bold text-indigo-600">{fmt(r.total || 0)}</span>
                  },
                  {
                    title: "", width: 90, align: "center",
                    render: (_, r) => (
                      <Space size="small">
                         <Button type="text" icon={<SettingOutlined className="text-gray-500" />} onClick={() => setEditingLineKey(r.key)} />
                         <Button danger type="text" icon={<DeleteOutlined />} onClick={() => setCart(prev => prev.filter(c => c.key !== r.key))} />
                      </Space>
                    )
                  }
                ]}
              />
            </div>

            <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
              <div>
                <Text type="secondary" className="text-lg">ยอดรวมทั้งหมด</Text>
                <div className="text-4xl font-bold text-indigo-700 mt-1">
                  ฿ {totals.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <Button 
                type="primary" 
                size="large" 
                className="h-16 px-10 text-xl font-bold rounded-xl shadow-md"
                disabled={cart.length === 0}
                onClick={async () => {
                  try {
                    await form.validateFields();
                    setCheckoutModal(true);
                  } catch (e) {
                    message.error("กรุณาเลือกลูกค้าและสาขาก่อนชำระเงิน");
                  }
                }}
              >
                <DollarOutlined /> ชำระเงิน / เปิดบิล
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Checkout Modal */}
      <Modal
        title="จบขั้นตอนการขายและตัดสต๊อก"
        open={checkoutModal}
        width={400}
        centered
        onCancel={() => !submitting && setCheckoutModal(false)}
        footer={null}
      >
        <div className="text-center py-6">
           <Text type="secondary">ยอดชำระสุทธิ</Text>
           <Title level={1} className="!text-indigo-600 !mt-2 !mb-6">฿ {totals.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Title>

           <div className="bg-gray-100 p-4 rounded-xl text-left space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-700">รับเงินจากลูกค้าแล้ว:</span>
                <Switch 
                  checked={isPaid} 
                  onChange={setIsPaid} 
                  checkedChildren="✅ รับเงินแล้ว" 
                  unCheckedChildren="❌ ลงยอดค้างจ่าย" 
                />
              </div>

              {isPaid && (
                <div className="mt-2 text-left">
                  <div className="text-xs text-gray-500 mb-1">นำเงินเข้าบัญชีหมุนเวียนใด:</div>
                  <Select
                    className="w-full"
                    placeholder="เลือกบัญชี (เช่น เงินโอน, เงินสดหน้าร้าน)"
                    options={financeAccounts.map((f: any) => ({ 
                      value: f.id, 
                      label: `[${f.type}] ${f.name} (คงเหลือ ${Number(f.balance || 0).toLocaleString()})` 
                    }))}
                    onChange={(v) => form.setFieldValue("finance_account_id", v)}
                  />
                </div>
              )}
           </div>

           <Button 
             type="primary" block size="large" 
             className="mt-6 h-14 text-lg font-bold bg-green-500 hover:!bg-green-600 shadow-md border-none"
             icon={<CheckCircleOutlined />}
             loading={submitting}
             onClick={() => handleSubmitCheckout(form.getFieldsValue())}
           >
             ยืนยันเปิดบิล {isPaid ? "และรับเงิน" : "และค้างชำระ"}
           </Button>
        </div>
      </Modal>

      {/* Line Settings Modal */}
      <Modal
         title={`ตั้งค่ารายการ: ${editingLine?.name || ""}`}
         open={!!editingLineKey}
         onCancel={() => setEditingLineKey(null)}
         footer={[
            <Button key="ok" type="primary" onClick={() => setEditingLineKey(null)}>ตกลง / ปิด</Button>
         ]}
         centered
      >
         {editingLine && (
            <div className="space-y-4 pt-2">
               <Row gutter={16}>
                  <Col span={12}>
                     <div className="text-xs text-gray-500 mb-1">ส่วนลด (%)</div>
                     <InputNumber 
                        min={0} max={100} className="w-full" value={editingLine.discount_percent} 
                        onChange={(v) => {
                           setCart(prev => prev.map(c => c.key === editingLine.key ? Object.assign(recalcLine({ ...c, discount_percent: Number(v||0) }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c));
                        }} 
                     />
                  </Col>
                  <Col span={12}>
                     <div className="text-xs text-gray-500 mb-1">ส่วนลด (บาท)</div>
                     <InputNumber 
                        min={0} className="w-full" value={editingLine.discount_amount} 
                        onChange={(v) => {
                           setCart(prev => prev.map(c => c.key === editingLine.key ? Object.assign(recalcLine({ ...c, discount_amount: Number(v||0) }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c));
                        }} 
                     />
                  </Col>
               </Row>
               <Row gutter={16}>
                  <Col span={24}>
                     <div className="text-xs text-gray-500 mb-1">ประเภทภาษี</div>
                     <Select
                        className="w-full"
                        value={editingLine.vat_mode === "NONE" ? "NONE" : editingLine.vat_mode === "EXCL" && editingLine.vat_rate === 0 ? "EXCL_0" : editingLine.vat_mode === "INCL" ? "INCL_7" : "EXCL_7"}
                        options={[
                           { value: "EXCL_7", label: "แยกภาษี 7%" },
                           { value: "INCL_7", label: "รวมภาษี 7%" },
                           { value: "EXCL_0", label: "VAT 0%" },
                           { value: "NONE", label: "ไม่มี VAT" },
                        ]}
                        onChange={(v) => {
                           let vat_mode: any = "EXCL", vat_rate = 7;
                           if (v === "NONE") { vat_mode = "NONE"; vat_rate = 0; }
                           else if (v === "EXCL_0") { vat_mode = "EXCL"; vat_rate = 0; }
                           else if (v === "INCL_7") { vat_mode = "INCL"; }
                           setCart(prev => prev.map(c => c.key === editingLine.key ? Object.assign(recalcLine({ ...c, vat_mode, vat_rate }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c));
                        }}
                     />
                  </Col>
               </Row>
               <Row gutter={16}>
                  <Col span={12}>
                     <div className="text-xs text-gray-500 mb-1">ประเภทคอมมิชชั่น</div>
                     <Select className="w-full" value={editingLine.commission_mode}
                        options={[{ value: "PERCENT", label: "เปอร์เซ็นต์" }, { value: "AMOUNT", label: "จำนวนเงิน" }]}
                        onChange={(v) => setCart(prev => prev.map(c => c.key === editingLine.key ? Object.assign(recalcLine({ ...c, commission_mode: v as "AMOUNT"|"PERCENT" }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c))}
                     />
                  </Col>
                  <Col span={12}>
                     <div className="text-xs text-gray-500 mb-1">หัก ณ ที่จ่าย (%)</div>
                     <InputNumber 
                        min={0} max={100} className="w-full" value={editingLine.withholding_rate} 
                        onChange={(v) => setCart(prev => prev.map(c => c.key === editingLine.key ? Object.assign(recalcLine({ ...c, withholding_rate: Number(v||0) }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c))}
                     />
                  </Col>
               </Row>
               <div className="bg-gray-50 p-3 mt-4 rounded border border-gray-200 text-sm">
                  <div className="flex justify-between mb-1"><span>ก่อนภาษี:</span> <span>฿ {fmt(editingLine.amount_before_vat||0)}</span></div>
                  <div className="flex justify-between mb-1 text-red-500"><span>ส่วนลดสุทธิ:</span> <span>-฿ {fmt(editingLine.discount_amount || 0)}</span></div>
                  <div className="flex justify-between mb-1"><span>ภาษี:</span> <span>฿ {fmt((editingLine.total||0) - (editingLine.amount_before_vat||0))}</span></div>
                  <div className="flex justify-between mb-1 text-orange-600"><span>หัก ณ:</span> <span>-฿ {fmt(editingLine.withholding_amount || 0)}</span></div>
                  <Divider className="!my-2" />
                  <div className="flex justify-between font-bold text-indigo-600 text-base"><span>รวมสุทธิบรรทัดนี้:</span> <span>฿ {fmt(editingLine.total || 0)}</span></div>
               </div>
            </div>
         )}
      </Modal>

    </div>
  );
}
