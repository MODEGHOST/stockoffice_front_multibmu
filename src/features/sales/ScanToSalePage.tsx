import { useEffect, useRef, useState, useMemo } from "react";
import { 
  Card, Button, Form, Select, Typography, Table, InputNumber, 
  Space, Modal, message, Row, Col, Divider, Switch, Result 
} from "antd";
import { PlusCircleOutlined, MinusCircleOutlined, DeleteOutlined, ScanOutlined, DollarOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { Html5Qrcode } from "html5-qrcode";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

const { Title, Text } = Typography;

type Option = { value: number; label: string };

type CartItem = {
  key: string;
  product_id: number;
  code: string;
  name: string;
  quantity: number;
  price: number;
  maxQty: number; // เอามาจาก stock
  commission_value: number; // บาทต่อชิ้น
};

export default function ScanToSalePage() {
  const nav = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  
  const [form] = Form.useForm();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scanning, setScanning] = useState(false);
  
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
      setCustomers(vends.filter((v: any) => v.type === "CUSTOMER" || v.type === "BOTH"));

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

    try {
      // pause scanner briefly to prevent dual scanning
      if (scannerRef.current) {
        scannerRef.current.pause(true);
      }

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
          const currQty = next[existIdx].quantity;
          if (currQty + 1 > product.maxQty) {
            message.warning(`สินค้า ${product.name} มีสต๊อกจำกัดแค่ ${product.maxQty}`);
            return prev;
          }
          next[existIdx] = { ...next[existIdx], quantity: currQty + 1 };
          message.success(`เพิ่ม ${product.name} (+1)`, 1);
          return next;
        } else {
           message.success(`สแกนเจอ ${product.name} เรียบร้อย`, 1);
           return [...prev, {
             key: String(Date.now()),
             product_id: product.id,
             code: product.code,
             name: product.name,
             quantity: 1,
             price: product.price || 0,
             maxQty: product.maxQty,
             commission_value: 0
           }];
        }
      });

    } catch (e: any) {
      message.error("รหัสบาร์โค้ดไม่ถูกต้อง หรือหาสินค้าไม่พบ");
    } finally {
      setTimeout(() => {
        if (scannerRef.current && scanning) {
          scannerRef.current.resume();
        }
      }, 1500); // 1.5 วินาที cooldown
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
  const totals = useMemo(() => {
    let sum = 0;
    cart.forEach(c => sum += (c.quantity * c.price));
    return sum;
  }, [cart]);

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
          quantity: c.quantity,
          price: c.price,
          commission_mode: "AMOUNT",
          commission_value: c.commission_value,
          total: c.quantity * c.price,
          vat_mode: "EXCL", 
          vat_rate: 7
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
                          disabled={q <= 1} onClick={() => {
                            setCart(prev => prev.map(c => c.key === r.key ? { ...c, quantity: c.quantity - 1 } : c));
                          }} 
                        />
                        <span className="font-bold w-6 text-center">{q}</span>
                        <Button size="small" icon={<PlusCircleOutlined />} 
                           disabled={q >= r.maxQty} onClick={() => {
                            setCart(prev => prev.map(c => c.key === r.key ? { ...c, quantity: Math.min(r.maxQty, c.quantity + 1) } : c));
                          }} 
                        />
                      </Space>
                    )
                  },
                  {
                    title: "ราคาขาย/ชิ้น", dataIndex: "price", align: "right", width: 120,
                    render: (p, r) => (
                      <InputNumber min={0} value={p} className="w-full text-right"
                         onChange={(v) => setCart(prev => prev.map(c => c.key === r.key ? { ...c, price: Number(v||0) } : c))}
                      />
                    )
                  },
                  {
                    title: "คอม/ชิ้น", dataIndex: "commission_value", align: "right", width: 100,
                    render: (c, r) => (
                      <InputNumber min={0} value={c} className="w-full text-right"
                         onChange={(v) => setCart(prev => prev.map(x => x.key === r.key ? { ...x, commission_value: Number(v||0) } : x))}
                      />
                    )
                  },
                  {
                    title: "รวม", align: "right", width: 100,
                    render: (_, r) => <span className="font-bold text-indigo-600">{(r.quantity * r.price).toLocaleString()}</span>
                  },
                  {
                    title: "", width: 60, align: "center",
                    render: (_, r) => <Button danger type="text" icon={<DeleteOutlined />} onClick={() => setCart(prev => prev.filter(c => c.key !== r.key))} />
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
                    options={financeAccounts.map(f => ({ value: f.id, label: `${f.bank_name} - ${f.account_name}` }))}
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
    </div>
  );
}
