import { useEffect, useState, useMemo } from "react";
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
} from "antd";
import { useNavigate } from "react-router-dom";
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { createAdjustment } from "./stockApi";
import { useWarehouses } from "../warehouses/warehouseApi";
import { searchProducts } from "../products/productApi";

const { Title } = Typography;

function debounce(func: Function, wait: number) {
  let timeout: any;
  return function (this: any, ...args: any[]) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

export default function AdjustmentCreatePage() {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const { data: warehouses } = useWarehouses();

  const [items, setItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    fetchProductList("");
  }, [fetchProductList]);

  const handleAddItem = () => {
    form.validateFields(["product_id", "direction", "qty", "unit_cost", "note"]).then((values) => {
      const selectedProd = productOptions.find((o) => o.value === values.product_id);
      if (!selectedProd) return;

      const newItem = {
        product_id: values.product_id,
        product_code: selectedProd.product.code,
        product_name: selectedProd.product.name,
        direction: values.direction,
        qty: values.qty,
        unit_cost: values.direction === "IN" ? values.unit_cost : null,
        note: values.note,
      };
      setItems([...items, newItem]);
      form.resetFields(["product_id", "qty", "unit_cost", "note"]);
    });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const onFinish = async (values: any) => {
    if (items.length === 0) return message.error("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");

    try {
      setSubmitting(true);
      const payload = {
        doc_no: values.doc_no,
        warehouse_id: values.warehouse_id,
        reason: values.reason,
        items,
      };
      const r = await createAdjustment(payload);
      message.success("สร้างใบปรับปรุงยอดสำเร็จ");
      nav(`/stock/adjustments/${r.id}`);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "สร้างรายการไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: any = [
    { title: "สินค้า", render: (_: any, r: any) => `${r.product_code} - ${r.product_name}` },
    {
      title: "ประเภท",
      dataIndex: "direction",
      render: (v: string) =>
        v === "IN" ? <span className="text-green-600 font-bold">รับเข้า</span> : <span className="text-red-600 font-bold">จ่ายออก</span>,
    },
    { title: "จำนวน", dataIndex: "qty", align: "right" },
    {
      title: "ต้นทุนต่อหน่วย",
      dataIndex: "unit_cost",
      align: "right",
      render: (v: any) => (v != null ? v.toLocaleString() : "-"),
    },
    { title: "หมายเหตุ", dataIndex: "note" },
    {
      title: "",
      width: 50,
      render: (_: any, __: any, idx: number) => (
        <Button danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveItem(idx)} />
      ),
    },
  ];

  // Watch direction to toggle unit_cost requirement
  const currentDirection = Form.useWatch("direction", form);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)} />
        <div>
          <Title level={3} className="!mb-0">สร้างใบปรับปรุงยอดสต็อก</Title>
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Card title="ข้อมูลหลัก">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Form.Item
              label="เลขที่เอกสาร"
              name="doc_no"
              rules={[{ required: true, message: "ระบุเลขที่เอกสาร" }]}
              initialValue={`ADJ-${dayjs().format("YYYYMMDD")}-XXXX`}
            >
              <Input placeholder="เช่น ADJ-2026..." />
            </Form.Item>

            <Form.Item
              label="คลังสินค้า"
              name="warehouse_id"
              rules={[{ required: true, message: "เลือกคลังสินค้า" }]}
            >
              <Select
                placeholder="เลือกคลัง"
                options={warehouses?.map((w: any) => ({ label: w.name, value: w.id }))}
              />
            </Form.Item>

            <Form.Item label="เหตุผล / หมายเหตุ" name="reason">
              <Input placeholder="เช่น ตรวจนับสต็อกประจำเดือน" />
            </Form.Item>
          </div>
        </Card>

        <Card title="รายการสินค้า" className="mt-4">
          <div className="p-4 bg-gray-50 rounded-lg mb-4 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4">
                <Form.Item label="สินค้า" name="product_id" rules={[{ required: true, message: "เลือกสินค้า" }]}>
                  <Select
                    showSearch
                    placeholder="ค้นหาสินค้า (ชื่อ/รหัส)"
                    filterOption={false}
                    onSearch={fetchProductList}
                    notFoundContent={fetchingProducts ? "กำลังค้นหา..." : null}
                    options={productOptions}
                    className="w-full"
                  />
                </Form.Item>
              </div>
              <div className="md:col-span-2">
                <Form.Item label="ประเภท" name="direction" initialValue="IN">
                  <Select
                    options={[
                      { label: "รับเข้า (IN)", value: "IN" },
                      { label: "จ่ายออก (OUT)", value: "OUT" },
                    ]}
                  />
                </Form.Item>
              </div>
              <div className="md:col-span-2">
                <Form.Item label="จำนวน" name="qty" rules={[{ required: true, message: "ระบุจำนวน" }]}>
                  <InputNumber min={1} placeholder="Qty" className="w-full" />
                </Form.Item>
              </div>
              <div className="md:col-span-2">
                <Form.Item
                  label="ต้นทุน (เฉพาะรับเข้า)"
                  name="unit_cost"
                  rules={[
                    { required: currentDirection === "IN", message: "ระบุต้นทุน" },
                  ]}
                >
                  <InputNumber
                    min={0}
                    placeholder="Cost"
                    className="w-full"
                    disabled={currentDirection === "OUT"}
                  />
                </Form.Item>
              </div>
              <div className="md:col-span-2">
                <Form.Item label="Note" name="note">
                    <Input placeholder="หมายเหตุ" />
                </Form.Item>
              </div>
              <div className="md:col-span-12 flex justify-end">
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddItem}>
                  เพิ่มรายการ
                </Button>
              </div>
            </div>
          </div>

          <Table
            rowKey={(r) => r.product_id + r.direction}
            columns={columns}
            dataSource={items}
            pagination={false}
            size="small"
            bordered
          />
        </Card>

        <div className="flex justify-end gap-3 mt-6">
          <Button onClick={() => nav(-1)}>ยกเลิก</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            บันทึกรายการ
          </Button>
        </div>
      </Form>
    </div>
  );
}
