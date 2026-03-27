const fs = require('fs');

async function main() {
    const file = 'c:/Users/Sxcretsupercomputer/Desktop/stockoffice_front_multibmu/src/features/sales/ScanToSalePage.tsx';
    let txt = fs.readFileSync(file, 'utf8');

    // 1. Imports
    txt = txt.replace(
      'import { PlusCircleOutlined, MinusCircleOutlined, DeleteOutlined, ScanOutlined, DollarOutlined, CheckCircleOutlined } from "@ant-design/icons";\nimport { Html5Qrcode } from "html5-qrcode";',
      'import { PlusCircleOutlined, MinusCircleOutlined, DeleteOutlined, ScanOutlined, DollarOutlined, CheckCircleOutlined, SettingOutlined } from "@ant-design/icons";\nimport { Html5Qrcode } from "html5-qrcode";\nimport { type Line, recalcLine, calcTotals, fmt } from "./invoiceCalc";'
    );

    // 2. Types
    txt = txt.replace(
      'type CartItem = {\n  key: string;\n  product_id: number;\n  code: string;\n  name: string;\n  quantity: number;\n  price: number;\n  maxQty: number; // เอามาจาก stock\n  commission_value: number; // บาทต่อชิ้น\n};',
      'type CartItem = Line & {\n  code: string;\n  name: string;\n  maxQty: number;\n};'
    );

    // 3. State
    txt = txt.replace(
      '  const [form] = Form.useForm();\n  const [cart, setCart] = useState<CartItem[]>([]);\n  const [scanning, setScanning] = useState(false);',
      '  const [form] = Form.useForm();\n  const [cart, setCart] = useState<CartItem[]>([]);\n  const [scanning, setScanning] = useState(false);\n  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);\n  const editingLine = useMemo(() => cart.find(c => c.key === editingLineKey), [cart, editingLineKey]);'
    );

    // 4. Qty Increment handler
    txt = txt.replace(
      'next[existIdx] = { ...next[existIdx], quantity: currQty + 1 };',
      'next[existIdx] = Object.assign(recalcLine({ ...next[existIdx], quantity: currQty + 1 }), { code: next[existIdx].code, name: next[existIdx].name, maxQty: next[existIdx].maxQty }) as CartItem;'
    );

    const matchOldCartAdd = /return \[\.\.\.prev, {\s*key: String\(Date\.now\(\)\),\s*product_id: product\.id,\s*code: product\.code,\s*name: product\.name,\s*quantity: 1,\s*price: product\.price \|\| 0,\s*maxQty: product\.maxQty,\s*commission_value: 0\s*}\];/s;
    txt = txt.replace(matchOldCartAdd, 
        `const newLine = recalcLine({
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
           return [...prev, newLine];`
    );

    // 5. Calculate totals
    txt = txt.replace(
      'const totals = useMemo(() => {\n    let sum = 0;\n    cart.forEach(c => sum += (c.quantity * c.price));\n    return sum;\n  }, [cart]);',
      'const cartTotals = useMemo(() => calcTotals(cart), [cart]);\n  const totals = cartTotals.total;'
    );

    // 6. Checkout map
    const matchOldMap = /items: cart\.map\(c => \(\{\s*product_id: c\.product_id,\s*quantity: c\.quantity,\s*price: c\.price,\s*commission_mode: "AMOUNT",\s*commission_value: c\.commission_value,\s*total: c\.quantity \* c\.price,\s*vat_mode: "EXCL", \s*vat_rate: 7\s*\}\)\)/s;
    txt = txt.replace(matchOldMap, 
        `items: cart.map(c => ({
          product_id: c.product_id,
          quantity: c.quantity || 0,
          price: c.price || 0,
          commission_mode: c.commission_mode || "PERCENT",
          commission_value: c.commission_value || 0,
          total: c.total || (c.quantity * (c.price || 0)),
          vat_mode: c.vat_mode || "EXCL", 
          vat_rate: c.vat_rate || 7,
          discount_percent: c.discount_percent || 0,
          discount_amount: c.discount_amount || 0,
          withholding_rate: c.withholding_rate || 0
        }))`
    );

    // 7. Table logic
    txt = txt.replace(
      `setCart(prev => prev.map(c => c.key === r.key ? { ...c, quantity: c.quantity - 1 } : c));`,
      `setCart(prev => prev.map(c => c.key === r.key ? Object.assign(recalcLine({ ...c, quantity: (c.quantity||1) - 1 }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c));`
    );
    txt = txt.replace(
      `setCart(prev => prev.map(c => c.key === r.key ? { ...c, quantity: Math.min(r.maxQty, c.quantity + 1) } : c));`,
      `setCart(prev => prev.map(c => c.key === r.key ? Object.assign(recalcLine({ ...c, quantity: Math.min(r.maxQty, (c.quantity||0) + 1) }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c));`
    );
    txt = txt.replace(
      `onChange={(v) => setCart(prev => prev.map(c => c.key === r.key ? { ...c, price: Number(v||0) } : c))}`,
      `onChange={(v) => setCart(prev => prev.map(c => c.key === r.key ? Object.assign(recalcLine({ ...c, price: Number(v||0) }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c))}`
    );
    txt = txt.replace(
      `onChange={(v) => setCart(prev => prev.map(x => x.key === r.key ? { ...x, commission_value: Number(v||0) } : x))}`,
      `onChange={(v) => setCart(prev => prev.map(c => c.key === r.key ? Object.assign(recalcLine({ ...c, commission_value: Number(v||0) }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c))}`
    );
    txt = txt.replace(
      `render: (_, r) => <span className="font-bold text-indigo-600">{(r.quantity * r.price).toLocaleString()}</span>`,
      `render: (_, r) => <span className="font-bold text-indigo-600">{fmt(r.total)}</span>`
    );

    // 8. Buttons
    txt = txt.replace(
      `render: (_, r) => <Button danger type="text" icon={<DeleteOutlined />} onClick={() => setCart(prev => prev.filter(c => c.key !== r.key))} />`,
      `render: (_, r) => (
                      <Space size="small">
                         <Button type="text" icon={<SettingOutlined className="text-gray-500" />} onClick={() => setEditingLineKey(r.key)} />
                         <Button danger type="text" icon={<DeleteOutlined />} onClick={() => setCart(prev => prev.filter(c => c.key !== r.key))} />
                      </Space>
                    )`
    );
    txt = txt.replace(
      `title: "", width: 60`,
      `title: "", width: 90`
    );

    const modalCode = `
      {/* Line Settings Modal */}
      <Modal
         title={\`ตั้งค่ารายการ: \${editingLine?.name || ""}\`}
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
                           let vat_mode = "EXCL", vat_rate = 7;
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
                        onChange={(v) => setCart(prev => prev.map(c => c.key === editingLine.key ? Object.assign(recalcLine({ ...c, commission_mode: v }), { code: c.code, name: c.name, maxQty: c.maxQty }) as CartItem : c))}
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
                  <div className="flex justify-between font-bold text-indigo-600 text-base"><span>รวมสุทธิบรรทัดนี้:</span> <span>฿ {fmt(editingLine.total)}</span></div>
               </div>
            </div>
         )}
      </Modal>
`;

    txt = txt.replace('      {/* Checkout Modal */}', modalCode + '\n      {/* Checkout Modal */}');
    fs.writeFileSync(file, txt);
    console.log('Update Complete');
}

main().catch(console.error);
