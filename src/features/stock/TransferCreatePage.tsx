import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Button,
  Card,
  Input,
  Typography,
  message,
  Table,
  Select,
  Form,
  InputNumber,
  Space,
} from "antd";
import { useNavigate } from "react-router-dom";
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { createTransfer, getNextTransferDocNo } from "./transferApi";
import { useWarehouses } from "../warehouses/warehouseApi";
import { searchProducts } from "../products/productApi";
import { getStockCheck } from "./stockApi";

const { Title, Text } = Typography;

function debounce(func: Function, wait: number) {
  let timeout: any;
  return function (this: any, ...args: any[]) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

export default function TransferCreatePage() {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const { data: warehouses } = useWarehouses();

  const [items, setItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [docNoLoading, setDocNoLoading] = useState(false);
  const [docNoAutoFailed, setDocNoAutoFailed] = useState(false);

  // Product Search
  const [productOptions, setProductOptions] = useState<any[]>([]);
  const [fetchingProducts, setFetchingProducts] = useState(false);

  const fetchProductList = useMemo(
    () =>
      debounce(async (search: string) => {
        setFetchingProducts(true);
        try {
          const r = await searchProducts(search);
          setProductOptions(
            r.map((p: any) => ({
              label: `${p.code} - ${p.name}`,
              value: p.id,
              product: p,
            }))
          );
        } finally {
          setFetchingProducts(false);
        }
      }, 500),
    []
  );

  const [sourceStock, setSourceStock] = useState<number | null>(null);
  const [targetStock, setTargetStock] = useState<number | null>(null);

  const handleProductSelect = async (productId: number) => {
    const swId = form.getFieldValue("source_warehouse_id");
    const twId = form.getFieldValue("target_warehouse_id");
    
    setSourceStock(null);
    setTargetStock(null);

    if (productId && swId) {
       try {
         const { qty } = await getStockCheck(productId, swId);
         setSourceStock(qty);
       } catch (e) { console.error(e) }
    }
    
    if (productId && twId) {
       try {
         const { qty } = await getStockCheck(productId, twId);
         setTargetStock(qty);
       } catch (e) { console.error(e) }
    }
  };

  useEffect(() => {
    fetchProductList("");
  }, [fetchProductList]);

  const loadNextDocNo = useCallback(async (issueDate?: string) => {
    const date = issueDate || form.getFieldValue("issue_date") || dayjs().format("YYYY-MM-DD");
    try {
      setDocNoLoading(true);
      setDocNoAutoFailed(false);
      const nextDocNo = await getNextTransferDocNo(date);
      form.setFieldValue("doc_no", nextDocNo);
    } catch (e) {
      console.error(e);
      setDocNoAutoFailed(true);
      message.warning("สร้างเลขที่เอกสารอัตโนมัติไม่สำเร็จ กรุณากรอกเลขที่เอกสารเอง");
      form.setFieldValue("doc_no", `TF-${dayjs(date).format("YYYYMMDD")}-0001`);
    } finally {
      setDocNoLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadNextDocNo(dayjs().format("YYYY-MM-DD"));
  }, [loadNextDocNo]);

  const handleAddItem = () => {
    const pid = form.getFieldValue("product_id");
    const qty = form.getFieldValue("qty");

    if (!pid) return message.warning("กรุณาเลือกสินค้า");
    if (!qty || qty <= 0) return message.warning("กรุณาระบุจำนวน");

    const selectedProd = productOptions.find((o) => o.value === pid);
    if (!selectedProd) return;

    if (sourceStock !== null && qty > sourceStock) {
      return message.error(`จำนวนที่เลือกโอนต้องไม่เกินสต็อกต้นทางที่มี (${sourceStock})`);
    }

    const newItem = {
      product_id: pid,
      product_code: selectedProd.product.code,
      product_name: selectedProd.product.name,
      qty: qty,
    };

    // Check for duplicate
    if (items.find((i) => i.product_id === newItem.product_id)) {
      return message.error("สินค้านี้ถูกเพิ่มไปแล้ว");
    }

    setItems([...items, newItem]);
    form.resetFields(["product_id", "qty"]);
    setSourceStock(null);
    setTargetStock(null);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const onFinish = async (values: any) => {
    if (items.length === 0) return message.error("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
    if (values.source_warehouse_id === values.target_warehouse_id) {
        return message.error("คลังต้นทางและปลายทางต้องไม่ซ้ำกัน");
    }

    try {
      setSubmitting(true);
      const docNo = values.doc_no || await getNextTransferDocNo(values.issue_date);
      const payload = {
        doc_no: docNo,
        issue_date: values.issue_date,
        source_warehouse_id: values.source_warehouse_id,
        target_warehouse_id: values.target_warehouse_id,
        note: values.note,
        items,
      };
      const r = await createTransfer(payload);
      message.success("สร้างรายการสำเร็จ");
      nav(`/stock/transfers/${r.id}`);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "สร้างรายการไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: any = [
    { title: "สินค้า", render: (_: any, r: any) => `${r.product_code} - ${r.product_name}` },
    { title: "จำนวน", dataIndex: "qty", align: "right" },
    {
      title: "",
      width: 50,
      render: (_: any, __: any, idx: number) => (
        <Button danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveItem(idx)} />
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)} />
        <Title level={3} className="!mb-0">สร้างใบโอนย้ายคลังสินค้า (TF)</Title>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Card title="ข้อมูลหลัก">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Form.Item
              label="เลขที่เอกสาร"
              name="doc_no"
              rules={[{ required: true, message: "ระบบยังสร้างเลขที่เอกสารไม่สำเร็จ" }]}
            >
              <Input
                disabled={!docNoAutoFailed}
                placeholder={docNoAutoFailed ? "กรอกเลขที่เอกสารเอง" : "ระบบกำลังสร้างเลขที่เอกสาร..."}
                suffix={docNoLoading ? "กำลัง gen..." : undefined}
              />
            </Form.Item>

            <Form.Item
              label="วันที่"
              name="issue_date"
              rules={[{ required: true, message: "ระบุวันที่" }]}
              initialValue={dayjs().format("YYYY-MM-DD")}
            >
              <Input type="date" onChange={(e) => loadNextDocNo(e.target.value)} />
            </Form.Item>

            <Form.Item
              label="คลังต้นทาง"
              name="source_warehouse_id"
              rules={[{ required: true, message: "เลือกคลังต้นทาง" }]}
            >
              <Select
                placeholder="เลือกคลัง"
                options={warehouses?.map((w: any) => ({ label: w.name, value: w.id }))}
                onChange={() => {
                   const pid = form.getFieldValue("product_id");
                   if (pid) handleProductSelect(pid);
                }}
              />
            </Form.Item>

            <Form.Item
              label="คลังปลายทาง"
              name="target_warehouse_id"
              rules={[{ required: true, message: "เลือกคลังปลายทาง" }]}
            >
              <Select
                placeholder="เลือกคลัง"
                options={warehouses?.map((w: any) => ({ label: w.name, value: w.id }))}
                onChange={() => {
                   const pid = form.getFieldValue("product_id");
                   if (pid) handleProductSelect(pid);
                }}
              />
            </Form.Item>
          </div>
          
          <Form.Item label="เหตุผล / หมายเหตุ" name="note" className="mb-0 mt-4">
               <Input.TextArea rows={2} placeholder="เหตุผลในการโอนย้าย" />
          </Form.Item>
        </Card>

        <Card title="รายการสินค้า" className="mt-4">
          <div className="p-4 bg-gray-50 rounded-lg mb-4 border border-gray-200">
            <Space className="w-full flex items-start" align="start">
                <div className="flex flex-col">
                  <Form.Item label="สินค้า" name="product_id" className="mb-0">
                    <Select
                      showSearch
                      placeholder="ค้นหาสินค้า (ชื่อ/รหัส)"
                      filterOption={false}
                      onSearch={fetchProductList}
                      notFoundContent={fetchingProducts ? "กำลังค้นหา..." : null}
                      options={productOptions}
                      style={{ minWidth: 250 }}
                      onChange={handleProductSelect}
                    />
                  </Form.Item>
                  <div className="mt-2 flex gap-4 bg-white p-2 border border-gray-100 rounded">
                    {sourceStock !== null && (
                      <div className="flex flex-col">
                        <Text type="secondary" className="text-[11px] uppercase tracking-wider">
                          คลังต้นทาง ({warehouses?.find((w: any) => w.id === form.getFieldValue("source_warehouse_id"))?.name || ''})
                        </Text>
                        <Text strong className="text-blue-600">{sourceStock}</Text>
                      </div>
                    )}
                    {sourceStock !== null && targetStock !== null && (
                      <div className="w-px bg-gray-200"></div>
                    )}
                    {targetStock !== null && (
                      <div className="flex flex-col">
                        <Text type="secondary" className="text-[11px] uppercase tracking-wider">
                          คลังปลายทาง ({warehouses?.find((w: any) => w.id === form.getFieldValue("target_warehouse_id"))?.name || ''})
                        </Text>
                        <Text strong className="text-green-600">{targetStock}</Text>
                      </div>
                    )}
                  </div>
                </div>
                
                <Form.Item label="จำนวน" name="qty" className="mb-0">
                  <InputNumber min={0.0001} placeholder="Qty" style={{ minWidth: 150 }} />
                </Form.Item>
                <Form.Item label=" " className="mb-0">
                  <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddItem}>
                    เพิ่ม
                  </Button>
                </Form.Item>
            </Space>
          </div>

          <Table
            rowKey={(r) => r.product_id}
            columns={columns}
            dataSource={items}
            pagination={false}
            size="small"
            bordered
          />
        </Card>

        <div className="sticky bottom-0 z-0 mt-0 -mx-0 border-t border-gray-200 bg-white/95 px-2 py-3 shadow-[0_-6px_18px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex justify-end gap-3">
            <Button onClick={() => nav(-1)}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              บันทึกใบโอนย้าย
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
}
