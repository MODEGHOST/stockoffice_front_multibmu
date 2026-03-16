import { useState, useMemo } from "react";
import { Tabs, Card, Table, DatePicker, Select, Typography, Space } from "antd";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { getStockCard, getAging, getSalesTrend } from "./reportsApi";
import { searchProducts } from "../products/productApi";
import { useWarehouses } from "../warehouses/warehouseApi";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function debounce(func: Function, wait: number) {
  let timeout: any;
  return function (this: any, ...args: any[]) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

export default function ReportsDashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Title level={2} className="!mb-0">ศูนย์รายงาน (Reports Center)</Title>
      </div>

      <Tabs
        defaultActiveKey="1"
        type="card"
        items={[
          {
            key: "1",
            label: "รายงานสต็อกการ์ด (Stock Card)",
            children: <StockCardReport />,
          },
          {
            key: "2",
            label: "รายงานหนี้คงค้าง (AR / AP Aging)",
            children: <AgingReport />,
          },
          {
            key: "3",
            label: "สรุปยอดขาย (Sales Summary)",
            children: <SalesSummaryReport />,
          },
        ]}
      />
    </div>
  );
}

function StockCardReport() {
  const { data: warehouses } = useWarehouses();
  
  const [dates, setDates] = useState<[string, string]>([
    dayjs().startOf("month").format("YYYY-MM-DD"),
    dayjs().endOf("month").format("YYYY-MM-DD"),
  ]);
  const [productId, setProductId] = useState<number | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);

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
            }))
          );
        } finally {
          setFetchingProducts(false);
        }
      }, 500),
    []
  );

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "stockCard", productId, warehouseId, dates[0], dates[1]],
    queryFn: () => getStockCard(productId!, dates[0], dates[1], warehouseId || undefined),
    enabled: !!productId && !!dates[0] && !!dates[1],
  });

  const columns = [
    { title: "วันที่", dataIndex: "date", render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm") },
    { title: "ประเภท", dataIndex: "ref_type", render: (v: string, r: any) => `${v}-${r.ref_id}` },
    { title: "IN / OUT", dataIndex: "move_type", render: (v: string) => <Tag color={v === "IN" ? "success" : "error"}>{v}</Tag> },
    { title: "จำนวน", dataIndex: "qty", align: "right" as const },
    { title: "ยอดคงเหลือ", dataIndex: "balance", align: "right" as const, render: (v: number) => <Text strong>{v.toLocaleString()}</Text> },
    { title: "คลัง", dataIndex: "warehouse_name" },
    { title: "หมายเหตุ", dataIndex: "note" },
  ];

  return (
    <Card>
      <Space className="mb-4 flex-wrap">
         <Select
            showSearch
            placeholder="ค้นหาสินค้า (บังคับ)"
            filterOption={false}
            onSearch={fetchProductList}
            notFoundContent={fetchingProducts ? "กำลังค้นหา..." : null}
            options={productOptions}
            onChange={(val) => setProductId(val)}
            style={{ width: 250 }}
         />
         <Select
            allowClear
            placeholder="ทุกคลังสินค้า"
            options={warehouses?.map((w: any) => ({ label: w.name, value: w.id }))}
            onChange={(val) => setWarehouseId(val)}
            style={{ width: 200 }}
         />
         <RangePicker 
            defaultValue={[dayjs().startOf("month"), dayjs().endOf("month")]}
            onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                   setDates([dates[0].format("YYYY-MM-DD"), dates[1].format("YYYY-MM-DD")]);
                }
            }}
         />
      </Space>

      {!productId ? (
         <div className="text-center py-10 text-gray-400">กรุณาเลือกสินค้า เพื่อดูสต็อกการ์ด</div>
      ) : (
         <>
           <div className="mb-4 bg-gray-50 p-4 rounded border flex justify-between">
              <Text>ยอดยกมา (Opening Balance): <Text strong className="text-lg ml-2">{data?.openingQty?.toLocaleString() || 0}</Text></Text>
              <Text>ยอดคงเหลือ (Closing Balance): <Text strong className="text-lg ml-2">{data?.closingQty?.toLocaleString() || 0}</Text></Text>
           </div>
           <Table 
              rowKey="id" 
              loading={isLoading} 
              dataSource={data?.rows || []} 
              columns={columns} 
              pagination={{ pageSize: 50 }} 
           />
         </>
      )}
    </Card>
  );
}

// -------------------------------------------------------------
import { Tag } from "antd";

function AgingReport() {
  const [type, setType] = useState<"AR" | "AP">("AR");

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "aging", type],
    queryFn: () => getAging(type),
  });

  const isAR = type === "AR";

  const columns = [
    { title: "รหัส", dataIndex: isAR ? "customer_code" : "vendor_code" },
    { title: "ชื่อ", dataIndex: isAR ? "customer_name" : "vendor_name" },
    { title: "ยังไม่เกินกำหนด - 30 วัน", dataIndex: "age_0_30", align: "right" as const, render: (v: number) => v.toLocaleString() },
    { title: "31 - 60 วัน", dataIndex: "age_31_60", align: "right" as const, render: (v: number) => v ? <Text type="warning">{v.toLocaleString()}</Text> : "-" },
    { title: "61 - 90 วัน", dataIndex: "age_61_90", align: "right" as const, render: (v: number) => v ? <Text type="danger">{v.toLocaleString()}</Text> : "-" },
    { title: "เกิน 90 วัน", dataIndex: "age_over_90", align: "right" as const, render: (v: number) => v ? <Text strong type="danger">{v.toLocaleString()}</Text> : "-" },
    { title: "ยอดรวม", dataIndex: "total_due", align: "right" as const, render: (v: number) => <Text strong>{v.toLocaleString()}</Text> },
  ];

  return (
    <Card>
      <Space className="mb-4">
        <Select 
           value={type} 
           onChange={(v) => setType(v as "AR" | "AP")} 
           options={[
             { label: "ลูกหนี้การค้า (AR Aging)", value: "AR" },
             { label: "เจ้าหนี้การค้า (AP Aging)", value: "AP" }
           ]}
           style={{ width: 250 }}
        />
      </Space>

      <Table 
         rowKey={isAR ? "customer_id" : "vendor_id"} 
         loading={isLoading} 
         dataSource={data?.rows || []} 
         columns={columns} 
      />
    </Card>
  );
}

// -------------------------------------------------------------

function SalesSummaryReport() {
  const [dates, setDates] = useState<[string, string]>([
    dayjs().subtract(30, 'day').format("YYYY-MM-DD"),
    dayjs().format("YYYY-MM-DD"),
  ]);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "salesTrend", dates[0], dates[1]],
    queryFn: () => getSalesTrend(dates[0], dates[1]),
  });

  const columns = [
    { title: "วันที่", dataIndex: "date" },
    { title: "ยอดขาย (Total)", dataIndex: "total_amount", align: "right" as const, render: (v: number) => v.toLocaleString() },
    { title: "ต้นทุน (COGS)", dataIndex: "total_cogs", align: "right" as const, render: (v: number) => v.toLocaleString() },
    { 
       title: "กำไร (Profit)", 
       align: "right" as const, 
       render: (_: any, r: any) => {
         const profit = Number(r.total_amount) - Number(r.total_cogs);
         return <Text type={profit >= 0 ? "success" : "danger"}>{profit.toLocaleString()}</Text>
       } 
    },
  ];

  return (
    <Card>
      <Space className="mb-4">
         <RangePicker 
            defaultValue={[dayjs().subtract(30, 'day'), dayjs()]}
            onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                   setDates([dates[0].format("YYYY-MM-DD"), dates[1].format("YYYY-MM-DD")]);
                }
            }}
         />
      </Space>

      <Table 
         rowKey="date" 
         loading={isLoading} 
         dataSource={data || []} 
         columns={columns} 
      />
    </Card>
  );
}
