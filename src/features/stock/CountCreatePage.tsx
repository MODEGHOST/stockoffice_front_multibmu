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
  Space,
} from "antd";
import { useNavigate } from "react-router-dom";
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { createCount } from "./countApi";
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

export default function CountCreatePage() {
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
    form.validateFields(["product_id", "counted_qty"]).then((values) => {
      const selectedProd = productOptions.find((o) => o.value === values.product_id);
      if (!selectedProd) return;

      const newItem = {
        product_id: values.product_id,
        product_code: selectedProd.product.code,
        product_name: selectedProd.product.name,
        counted_qty: values.counted_qty,
      };

      if (items.find((i) => i.product_id === newItem.product_id)) {
        return message.error("สินค้านี้ถูกเพิ่มไปแล้ว");
      }

      setItems([...items, newItem]);
      form.resetFields(["product_id", "counted_qty"]);
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
        issue_date: values.issue_date,
        warehouse_id: values.warehouse_id,
        note: values.note,
        items,
      };
      const r = await createCount(payload);
      message.success("บันทึกการตรวจนับสำเร็จ");
      nav(`/stock/counts/${r.id}`);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: any = [
    { title: "สินค้า", render: (_: any, r: any) => `${r.product_code} - ${r.product_name}` },
    { title: "ยอดที่นับได้จริง (Counted Qty)", dataIndex: "counted_qty", align: "right" },
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
        <Title level={3} className="!mb-0">บันทึกผลการตรวจนับสต็อก (SC)</Title>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Card title="ข้อมูลหลัก">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Form.Item
              label="เลขที่เอกสาร"
              name="doc_no"
              initialValue={`SC-${dayjs().format("YYYYMMDD")}-XXXX`}
            >
              <Input placeholder="ระบบจะสร้างให้อัตโนมัติ" />
            </Form.Item>

            <Form.Item
              label="วันที่ตรวจนับ"
              name="issue_date"
              rules={[{ required: true, message: "ระบุวันที่" }]}
              initialValue={dayjs().format("YYYY-MM-DD")}
            >
              <Input type="date" />
            </Form.Item>

            <Form.Item
              label="คลังสินค้าที่นับ"
              name="warehouse_id"
              rules={[{ required: true, message: "เลือกคลังสินค้า" }]}
            >
              <Select
                placeholder="เลือกคลัง"
                options={warehouses?.map((w: any) => ({ label: w.name, value: w.id }))}
              />
            </Form.Item>
          </div>
          
          <Form.Item label="สรุปผล / หมายเหตุการนับ" name="note" className="mb-0 mt-4">
               <Input.TextArea rows={2} placeholder="เช่น การตรวจนับประจำเดือนสิงหาคม เจอของหาย 2 ชิ้น" />
          </Form.Item>
        </Card>

        <Card title="รายการนับสินค้า" className="mt-4">
          <div className="p-4 bg-gray-50 rounded-lg mb-4 border border-gray-200">
            <Space className="w-full flex" align="end">
                <Form.Item label="สินค้าที่เดินไปนับ" name="product_id" rules={[{ required: true, message: "เลือกสินค้า" }]}>
                  <Select
                    showSearch
                    placeholder="ค้นหาสินค้า (ชื่อ/รหัส)"
                    filterOption={false}
                    onSearch={fetchProductList}
                    notFoundContent={fetchingProducts ? "กำลังค้นหา..." : null}
                    options={productOptions}
                    style={{ minWidth: 250 }}
                  />
                </Form.Item>
                <Form.Item label="นับได้จริง (ชิ้น)" name="counted_qty" rules={[{ required: true, message: "ระบุจำนวน" }]}>
                  <InputNumber min={0} placeholder="Qty" style={{ minWidth: 150 }} />
                </Form.Item>
                <Form.Item>
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

        <div className="flex justify-end gap-3 mt-6">
          <Button onClick={() => nav(-1)}>ยกเลิก</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            บันทึกการตรวจนับ
          </Button>
        </div>
      </Form>
    </div>
  );
}
