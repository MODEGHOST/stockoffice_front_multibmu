import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
  InputNumber,
} from "antd";

import {
  ReloadOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  AppstoreOutlined,
  InboxOutlined,
  DollarOutlined,
  ContainerOutlined,
  CreditCardOutlined,
  DownloadOutlined,
  LineChartOutlined,
  FireOutlined,
  StarOutlined,
  PieChartOutlined,
  AlertOutlined,
  TeamOutlined,
  StockOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import ReactECharts from "echarts-for-react";
import api from "../../lib/api";
import { getMeCache, hasPermission } from "../auth/authStore";

const { Title, Text } = Typography;

type LowStockRow = {
  product_id: number;
  product_code?: string;
  product_name?: string;
  warehouse_id: number;
  warehouse_name?: string;
  qty: number;
  threshold: number;
  need: number;
};

type HotSellerRow = {
  product_id: number;
  product_code?: string;
  product_name?: string;
  qty_sold: number;
  amount: number;
};

type CommBySellerRow = {
  seller_id: number | null;
  seller_email?: string;
  seller_name?: string;
  inv_count: number;
  commission_total: number;
  amount_total: number;
};

type SalesTrendRow = { date: string; amount: number; inv_count: number };

// Drilldown จาก Sales Trend
type SalesBySellerRow = {
  seller_id: number | null;
  seller_name?: string;
  seller_email?: string;
  inv_count: number;
  amount_total: number;
};

// ✅ NEW: list INV ต่อผู้ขาย
type SellerInvoiceRow = {
  sale_id: number;
  invoice_no: string;
  status: string;
  issue_date: string;
  total: number;
  commission_total: number;
};

// ✅ NEW: items ใน INV
type SaleItemDetailRow = {
  id: number;
  product_id: number;
  product_code?: string;
  product_name?: string;
  quantity: number;
  price: number;
  discount_percent: number;
  discount_amount: number;
  total: number;
  vat_mode?: string;
  vat_rate?: number;
  vat_amount?: number;
  commission_mode?: string;
  commission_value?: number;
  commission_total?: number;
};

type TopVendorRow = {
  vendor_id: number;
  vendor_code: string;
  vendor_name: string;
  po_count: number;
  total_spend: number;
};

// ... existing types ...

type DashboardSettings = {
  lowStockThreshold: number;
  hotSellerTopN: number;
  topVendorTopN: number; // New setting
};

const DEFAULT_SETTINGS: DashboardSettings = {
  lowStockThreshold: 10,
  hotSellerTopN: 10,
  topVendorTopN: 10,
};

function loadSettings(key: string): DashboardSettings {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function saveSettings(key: string, v: DashboardSettings) {
  localStorage.setItem(key, JSON.stringify(v));
}

function KpiCardSimple({
  title,
  value,
  hint,
  icon,
  action,
  titleColor = "text-gray-500",
  valueColor = "text-gray-900",
  iconColor = "text-gray-400"
}: {
  title: React.ReactNode;
  value: any;
  hint?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  titleColor?: string;
  valueColor?: string;
  iconColor?: string;
}) {
  return (
    <Card className="rounded-xl shadow-sm border-gray-100 hover:shadow-md transition-shadow duration-200" bodyStyle={{ padding: 16 }} style={{ minHeight: 120 }}>
      {/* Header Row: Title + Action */}
      <div className="flex items-start justify-between">
        <div className={`text-sm font-semibold flex items-center gap-2 ${titleColor}`}>{title}</div>
        {action && <div>{action}</div>}
      </div>

      <div className="flex items-end justify-between mt-2">
        <div>
          <div className={`text-3xl font-bold ${valueColor}`}>{value}</div>
          {hint ? <div className="text-xs text-gray-400 mt-1">{hint}</div> : null}
        </div>
        <div className={`text-3xl opacity-80 mb-1 ${iconColor}`}>{icon}</div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const me = getMeCache();
  const user = me?.user;

  const canViewStock = hasPermission("stock.view");
  const canSales = hasPermission("sales.inv.manage");

  const settingsKey = useMemo(() => {
    const cid = (user as any)?.company_id ?? "default";
    return `stockoffice.dashboard.settings.${cid}`;
  }, [user]);

  const [settings, setSettings] = useState<DashboardSettings>(() => loadSettings(settingsKey));
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);

  const [loading, setLoading] = useState(false);

  const [cards, setCards] = useState<any>({
    skuCount: 0,
    stockQty: 0,
    lowStockCount: 0,
    salesTotal: 0,
    profitTotal: 0,
    invoiceCount: 0,
    pendingDraftCount: 0,
    pendingConfirmedCount: 0,
    
    // Purchase
    poDraftCount: 0,
    poPendingCount: 0,
    poTotalAmount: 0,
    grnDraftCount: 0,
    billUnpaidCount: 0,
    billTotalAmount: 0,
  });

  const [lowStockRows, setLowStockRows] = useState<LowStockRow[]>([]);
  const [hotSellers, setHotSellers] = useState<HotSellerRow[]>([]);
  const [commBySeller, setCommBySeller] = useState<CommBySellerRow[]>([]);
  const [trend, setTrend] = useState<SalesTrendRow[]>([]);
  
  const [topVendors, setTopVendors] = useState<TopVendorRow[]>([]);

  // Drilldown (Sales Trend -> by seller)
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillDate, setDrillDate] = useState<string>("");
  const [drillRows, setDrillRows] = useState<SalesBySellerRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // ✅ NEW: คลิ๊กผู้ขายในตารางคอม -> list INV
  const [sellerInvOpen, setSellerInvOpen] = useState(false);
  const [sellerInvLoading, setSellerInvLoading] = useState(false);
  const [sellerInvRows, setSellerInvRows] = useState<SellerInvoiceRow[]>([]);
  const [sellerInvTitle, setSellerInvTitle] = useState("");

  // ✅ NEW: คลิ๊ก INV -> items
  const [invDetailOpen, setInvDetailOpen] = useState(false);
  const [invDetailLoading, setInvDetailLoading] = useState(false);
  const [invDetailRows, setInvDetailRows] = useState<SaleItemDetailRow[]>([]);
  const [invDetailTitle, setInvDetailTitle] = useState("");
  const [invDetailHeader, setInvDetailHeader] = useState<any>(null);

  // ... drilldown states ...

  async function loadAll() {
    // if (!canViewStock && !canSales) return; // Allow if Purchase permissions exist? Assuming canViewStock covers basic dashboard for now or add check.
    // Actually, let's keep existing checks but add logic.
    
    setLoading(true);
    try {
      const from = range[0].format("YYYY-MM-DD");
      const to = range[1].format("YYYY-MM-DD");

      if (canViewStock) {
        const { data } = await api.get("/reports/dashboard-summary", {
          params: { from, to, lowStockThreshold: settings.lowStockThreshold },
        });
        setCards(data?.cards || {});
      }

      if (canViewStock) {
        const { data } = await api.get("/reports/low-stock", {
          params: { threshold: settings.lowStockThreshold, limit: 50 },
        });
        setLowStockRows(Array.isArray(data?.rows) ? data.rows : []);
        
        // Load Top Vendors (assuming stock permission or add new one? sticking to stock.view for now or open to all)
        const tv = await api.get("/reports/top-vendors", {
          params: { from, to, topN: settings.topVendorTopN || 10 },
        });
        setTopVendors(Array.isArray(tv.data?.rows) ? tv.data.rows : []);
      }

      if (canSales) {
        // ... existing sales calls ...
        const hs = await api.get("/reports/hot-sellers", {
          params: { from, to, topN: settings.hotSellerTopN },
        });
        setHotSellers(Array.isArray(hs.data?.rows) ? hs.data.rows : []);

        const cs = await api.get("/reports/commission/by-seller", { params: { from, to } });
        setCommBySeller(Array.isArray(cs.data?.rows) ? cs.data.rows : []);

        const tr = await api.get("/reports/sales-trend", { params: { from, to } });
        setTrend(Array.isArray(tr.data?.rows) ? tr.data.rows : []);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "โหลด Dashboard ไม่สำเร็จ", 2);
    } finally {
      setLoading(false);
    }
  }

  // Drilldown: Sales Trend -> by seller
  async function openDrilldown(dateISO: string) {
    setDrillDate(dateISO);
    setDrillOpen(true);
    setDrillLoading(true);
    setDrillRows([]);
    try {
      const { data } = await api.get("/reports/sales-by-seller", { params: { date: dateISO } });
      setDrillRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "โหลดรายบุคคลไม่สำเร็จ", 2);
      setDrillRows([]);
    } finally {
      setDrillLoading(false);
    }
  }

  // ✅ NEW: คลิ๊กผู้ขายในตารางคอม -> list INV
  async function openSellerInvoices(r: CommBySellerRow) {
    const from = range[0].format("YYYY-MM-DD");
    const to = range[1].format("YYYY-MM-DD");
    const sellerId = r.seller_id === null ? "null" : String(r.seller_id);

    setSellerInvTitle(`${r.seller_name || "ไม่ระบุ"}${r.seller_email ? ` (${r.seller_email})` : ""}`);
    setSellerInvOpen(true);
    setSellerInvLoading(true);
    setSellerInvRows([]);

    try {
      const { data } = await api.get("/reports/seller-invoices", {
        params: { from, to, sellerId },
      });
      setSellerInvRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "โหลดรายการ INV ไม่สำเร็จ", 2);
      setSellerInvRows([]);
    } finally {
      setSellerInvLoading(false);
    }
  }

  // ✅ NEW: คลิ๊ก INV -> items
  async function openInvoiceDetail(saleId: number, invoiceNo: string) {
    setInvDetailTitle(`รายละเอียด INV: ${invoiceNo}`);
    setInvDetailOpen(true);
    setInvDetailLoading(true);
    setInvDetailRows([]);
    setInvDetailHeader(null);

    try {
      const { data } = await api.get("/reports/sale-invoice-detail", {
        params: { saleId },
      });
      setInvDetailHeader(data?.header || null);
      setInvDetailRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "โหลดรายละเอียด INV ไม่สำเร็จ", 2);
      setInvDetailHeader(null);
      setInvDetailRows([]);
    } finally {
      setInvDetailLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingTotal =
    Number(cards.pendingDraftCount || 0) + Number(cards.pendingConfirmedCount || 0);

  // Charts
  const trendOption = useMemo(() => {
    const xs = trend.map((x) => dayjs(x.date).format("YYYY-MM-DD"));
    const ys = trend.map((x) => Number(x.amount || 0));
    return {
      tooltip: { 
        trigger: "axis", 
        valueFormatter: (v: any) => `฿ ${Number(v || 0).toLocaleString()}`,
        axisPointer: { type: 'shadow' }
      },
      grid: { left: 55, right: 20, top: 30, bottom: 36 },
      xAxis: {
        type: "category",
        data: xs,
        axisLabel: { interval: "auto", formatter: (v: string) => dayjs(v).format("DD MMM") },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisTick: { show: false }
      },
      yAxis: { 
        type: "value", 
        splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } },
        axisLabel: { formatter: (v: any) => v >= 10000 ? `${(v/1000).toLocaleString()}k` : v.toLocaleString() } 
      },
      series: [{ 
        name: 'ยอดขาย',
        type: "bar", 
        barMaxWidth: 45,
        itemStyle: { color: '#3b82f6', borderRadius: [6, 6, 0, 0] },
        data: ys 
      }],
    };
  }, [trend]);

  const hotSellerOption = useMemo(() => {
    const top = hotSellers.slice(0, 10);
    const colors = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"];
    return {
      tooltip: { trigger: "axis", valueFormatter: (v: any) => Number(v || 0).toLocaleString() },
      grid: { left: 48, right: 20, top: 30, bottom: 36 },
      xAxis: {
        type: "category",
        data: top.map((x) => x.product_code || String(x.product_id)),
        axisLabel: { interval: 0, rotate: 20 },
      },
      yAxis: { type: "value", axisLabel: { formatter: (v: any) => Number(v || 0).toLocaleString() } },
      series: [
        {
          type: "bar",
          data: top.map((x, i) => ({
            value: Number(x.amount || 0),
            itemStyle: { color: colors[i % colors.length] },
          })),
        },
      ],
    };
  }, [hotSellers]);

  const commPieOption = useMemo(() => {
    const rows = commBySeller.slice(0, 8);
    return {
      tooltip: { trigger: "item" },
      legend: { show: false },
      series: [
        {
          type: "pie",
          radius: ["45%", "65%"],
          itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 2 },
          label: {
            show: true,
            position: 'outside',
            formatter: '{b}\\n{d}%',
            fontSize: 12
          },
          labelLine: {
            show: true,
            length: 10,
            length2: 15
          },
          data: rows.map((r) => ({
            name: r.seller_name || r.seller_email || (r.seller_id ? `Seller#${r.seller_id}` : "ไม่ระบุ"),
            value: Number(r.commission_total || 0),
          })),
        },
      ],
    };
  }, [commBySeller]);

  const topVendorOption = useMemo(() => {
    const top = topVendors.slice(0, 10);
    const colors = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"];
    return {
      tooltip: { trigger: "axis", valueFormatter: (v: any) => Number(v || 0).toLocaleString() },
      grid: { left: 48, right: 20, top: 30, bottom: 36 },
      xAxis: {
        type: "category",
        data: top.map((x) => x.vendor_name || x.vendor_code),
        axisLabel: {
          interval: 0,
          rotate: 20,
          formatter: (v: string) => (v.length > 10 ? v.slice(0, 10) + "..." : v),
        },
      },
      yAxis: { type: "value", axisLabel: { formatter: (v: any) => Number(v || 0).toLocaleString() } },
      series: [
        {
          type: "bar",
          data: top.map((x, i) => ({
            value: Number(x.total_spend || 0),
            itemStyle: { color: colors[i % colors.length] },
          })),
        },
      ],
    };
  }, [topVendors]);

  // Tables
  const lowStockColumns = [
    {
      title: "สินค้า",
      key: "product",
      render: (_: any, r: LowStockRow) => (
        <div className="leading-tight">
          <div className="font-semibold">{r.product_name ?? `Product#${r.product_id}`}</div>
          <div className="text-xs text-gray-500">{r.product_code ?? ""}</div>
        </div>
      ),
    },
    { title: "คลัง", dataIndex: "warehouse_name", key: "warehouse_name" },
    { title: "คงเหลือ", dataIndex: "qty", key: "qty", align: "right" as const },
    { title: "เกณฑ์", dataIndex: "threshold", key: "threshold", align: "right" as const },
    {
      title: "ต้องเติม",
      dataIndex: "need",
      key: "need",
      align: "right" as const,
      render: (v: any) => (
        <span className="font-semibold text-gray-900">{Number(v || 0).toLocaleString()}</span>
      ),
    },
  ];

  // ✅ ตารางสรุปคอม: ทำให้ “คลิ๊กแถวได้”
  const commColumns = [
    {
      title: "ผู้ขาย",
      key: "seller",
      render: (_: any, r: CommBySellerRow) => (
        <div className="leading-tight">
          <div className="font-semibold">{r.seller_name || "ไม่ระบุ"}</div>
          <div className="text-xs text-gray-500">{r.seller_email || ""}</div>
        </div>
      ),
    },
    { title: "INV", dataIndex: "inv_count", key: "inv_count", align: "right" as const },
    {
      title: "ยอดขายรวม",
      dataIndex: "amount_total",
      key: "amount_total",
      align: "right" as const,
      render: (v: any) => Number(v || 0).toLocaleString(),
    },
    {
      title: "ค่าคอมรวม",
      dataIndex: "commission_total",
      key: "commission_total",
      align: "right" as const,
      render: (v: any) => Number(v || 0).toLocaleString(),
    },
  ];

  const drillColumns = [
    {
      title: "ผู้ขาย",
      key: "seller",
      render: (_: any, r: SalesBySellerRow) => (
        <div className="leading-tight">
          <div className="font-semibold">{r.seller_name || "ไม่ระบุ"}</div>
          <div className="text-xs text-gray-500">{r.seller_email || ""}</div>
        </div>
      ),
    },
    { title: "INV", dataIndex: "inv_count", key: "inv_count", align: "right" as const },
    {
      title: "ยอดขายรวม",
      dataIndex: "amount_total",
      key: "amount_total",
      align: "right" as const,
      render: (v: any) => Number(v || 0).toLocaleString(),
    },
  ];

  // ✅ Modal list INV columns
  const sellerInvColumns = [
    {
      title: "เลข INV",
      dataIndex: "invoice_no",
      key: "invoice_no",
      render: (v: string) => <span className="font-semibold">{v}</span>,
    },
    {
      title: "วันที่",
      dataIndex: "issue_date",
      key: "issue_date",
      render: (v: any) => (v ? dayjs(v).format("DD/MM/YYYY") : "-"),
    },
    { title: "สถานะ", dataIndex: "status", key: "status" },
    {
      title: "ยอดรวม",
      dataIndex: "total",
      key: "total",
      align: "right" as const,
      render: (v: any) => Number(v || 0).toLocaleString(),
    },
    {
      title: "ค่าคอม",
      dataIndex: "commission_total",
      key: "commission_total",
      align: "right" as const,
      render: (v: any) => Number(v || 0).toLocaleString(),
    },
  ];

  // ✅ Modal INV detail columns
  const invDetailColumns = [
    {
      title: "สินค้า",
      key: "product",
      render: (_: any, r: SaleItemDetailRow) => (
        <div className="leading-tight">
          <div className="font-semibold">{r.product_name || `Product#${r.product_id}`}</div>
          <div className="text-xs text-gray-500">{r.product_code || ""}</div>
        </div>
      ),
    },
    { title: "จำนวน", dataIndex: "quantity", key: "quantity", align: "right" as const },
    {
      title: "ราคา",
      dataIndex: "price",
      key: "price",
      align: "right" as const,
      render: (v: any) => Number(v || 0).toLocaleString(),
    },
    {
      title: "ส่วนลด%",
      dataIndex: "discount_percent",
      key: "discount_percent",
      align: "right" as const,
      render: (v: any) => Number(v || 0).toLocaleString(),
    },
    {
      title: "ส่วนลด",
      dataIndex: "discount_amount",
      key: "discount_amount",
      align: "right" as const,
      render: (v: any) => Number(v || 0).toLocaleString(),
    },
    {
      title: "VAT",
      dataIndex: "vat_amount",
      key: "vat_amount",
      align: "right" as const,
      render: (v: any) => Number(v || 0).toLocaleString(),
    },
    {
      title: "รวม",
      dataIndex: "total",
      key: "total",
      align: "right" as const,
      render: (v: any) => Number(v || 0).toLocaleString(),
    },
    {
      title: "คอม",
      dataIndex: "commission_total",
      key: "commission_total",
      align: "right" as const,
      render: (v: any) => Number(v || 0).toLocaleString(),
    },
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">Dashboard Stock</Title>
          <Text type="secondary">{user?.email ? `ยินดีต้อนรับ: ${user.email}` : "ยินดีต้อนรับ"}</Text>
          <div className="mt-2 flex gap-2 flex-wrap">
            {(me?.roles ?? []).map((r: string) => (
              <Tag key={r} color="blue" className="rounded-full">{r}</Tag>
            ))}
          </div>
        </div>

        <Space wrap>
          <DatePicker.RangePicker
            value={range}
            onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
            presets={[
              { label: 'วันนี้', value: [dayjs(), dayjs()] },
              { label: 'เมื่อวาน', value: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
              { label: 'สัปดาห์นี้', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
              { label: 'เดือนนี้', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
              { label: 'เดือนที่แล้ว', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
            ]}
          />
          <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>ตั้งค่า</Button>
          <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>Refresh</Button>
        </Space>
      </div>

      {/* KPI Sales/Financials */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <KpiCardSimple 
            title={<><DollarOutlined /> ยอดขายรวม (ช่วงที่เลือก)</>}
            value={Number(cards.salesTotal || 0).toLocaleString()} 
            hint={`เอกสารขาย ${cards.invoiceCount || 0} บิล`} 
            icon={<DollarOutlined />}
            titleColor="text-blue-600"
            valueColor="text-blue-700"
            iconColor="text-blue-200"
          />
        </Col>
        <Col xs={24} md={6}>
          <KpiCardSimple 
            title={<><StockOutlined /> กำไรสุทธิ (Profit)</>}
            value={Number(cards.profitTotal || 0).toLocaleString()} 
            hint="หักต้นทุน COGS แล้ว" 
            icon={<StockOutlined />}
            titleColor="text-emerald-600"
            valueColor="text-emerald-700"
            iconColor="text-emerald-200"
          />
        </Col>
        <Col xs={24} md={6}>
          <KpiCardSimple 
            title={<><ShoppingCartOutlined /> ดำเนินการ (Pending)</>}
            value={pendingTotal} 
            hint={`รอจัดส่ง: ${cards.pendingConfirmedCount} | รอยืนยัน: ${cards.pendingDraftCount}`} 
            icon={<ShoppingCartOutlined />}
            titleColor="text-orange-500"
            valueColor="text-orange-600"
            iconColor="text-orange-200"
          />
        </Col>
        <Col xs={24} md={6}>
          <KpiCardSimple 
            title={<><AlertOutlined /> สินค้าใกล้หมด (Low Stock)</>}
            value={cards.lowStockCount} 
            hint={`ต่ำกว่าเกณฑ์ ${settings.lowStockThreshold} ชิ้น`} 
            icon={<AlertOutlined />}
            titleColor="text-red-500"
            valueColor="text-red-600"
            iconColor="text-red-200"
          />
        </Col>
      </Row>

      {/* KPI Inventory */}
      <Title level={5} className="!mb-2 mt-6 text-gray-500">Inventory Operations</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <KpiCardSimple 
            title={<><AppstoreOutlined /> จำนวนรายการสินค้า (SKU)</>}
            value={Number(cards.skuCount || 0).toLocaleString()} 
            hint="นับจาก product_stock" 
            icon={<AppstoreOutlined />} 
            titleColor="text-indigo-600"
            valueColor="text-indigo-700"
            iconColor="text-indigo-200"
          />
        </Col>
        <Col xs={24} md={6}>
          <KpiCardSimple 
            title={<><InboxOutlined /> จำนวนคงเหลือในคลัง (ชิ้น)</>}
            value={Number(cards.stockQty || 0).toLocaleString()} 
            hint="รวมทุกคลัง" 
            icon={<InboxOutlined />} 
            titleColor="text-teal-600"
            valueColor="text-teal-700"
            iconColor="text-teal-200"
            action={
              <Button 
                size="small" 
                icon={<DownloadOutlined />} 
                style={{borderColor: "#0d9488", color: "#0d9488"}}
                onClick={async () => {
                  try {
                    const res = await api.get("/reports/stock/export", { responseType: "blob" });
                    const blob = new Blob([res.data]);
                    const link = document.createElement("a");
                    link.href = window.URL.createObjectURL(blob);
                    link.download = `stock_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    link.click();
                  } catch (e) {
                    message.error("Download failed");
                  }
                }}
              >
                Export
              </Button>
            }
          />
        </Col>
      </Row>

      {/* Purchase KPI */}
      {canViewStock && (
        <>
          <Title level={5} className="!mb-2 text-gray-500">Purchase Overview</Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <KpiCardSimple 
                title="PO (Draft)" 
                value={Number(cards.poDraftCount || 0)} 
                hint="ยังไม่ยืนยัน" 
                icon={<ContainerOutlined />} 
              />
            </Col>
            <Col xs={24} md={6}>
              <KpiCardSimple 
                title="GRN (Draft)" 
                value={Number(cards.grnDraftCount || 0)} 
                hint="ยังไม่บันทึกรับของ"
                icon={<InboxOutlined />} 
              />
            </Col>
            <Col xs={24} md={6}>
              <KpiCardSimple 
                title="Bill (Draft)" 
                value={Number(cards.billDraftCount || 0)} 
                hint="ยังไม่อนุมัติ" 
                icon={<CreditCardOutlined />} 
              />
            </Col>
             <Col xs={24} md={6}>
              <KpiCardSimple 
                title="ยอดซื้อรวม (PO)" 
                value={Number(cards.poTotalAmount || 0).toLocaleString()} 
                hint="Approved only" 
                icon={<DollarOutlined />} 
              />
            </Col>
          </Row>
        </>
      )}

      {/* Sales Trend */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card className="rounded-xl border-gray-100 shadow-sm" title={<div className="font-semibold text-blue-600 flex items-center gap-2"><LineChartOutlined /> Sales Trend (แนวโน้มยอดขาย)</div>} extra={<span className="text-xs text-gray-500">คลิ๊กกราฟเพื่อดูรายบุคคล</span>}>
            {canSales ? (
              <ReactECharts
                option={trendOption}
                style={{ height: 320 }}
                onEvents={{
                  click: (params: any) => {
                    const dateISO = String(params?.name || "");
                    if (!dateISO) return;
                    openDrilldown(dateISO);
                  },
                }}
              />
            ) : (
              <div>ไม่มีสิทธิ sales</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Hot + Top Vendors + Comm Share */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card className="rounded-xl border-gray-100 shadow-sm" title={<div className="font-semibold text-orange-600 flex items-center gap-2"><FireOutlined /> สินค้าขายดี (Hot Sellers)</div>} extra={<span className="text-xs text-gray-500">Top {settings.hotSellerTopN}</span>}>
            {canSales ? <ReactECharts option={hotSellerOption} style={{ height: 280 }} /> : <div>ไม่มีสิทธิ sales</div>}
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="rounded-xl border-gray-100 shadow-sm" title={<div className="font-semibold text-purple-600 flex items-center gap-2"><StarOutlined /> ผู้จำหน่ายยอดนิยม (Top Vendors)</div>} extra={<span className="text-xs text-gray-500">Top {settings.topVendorTopN || 10}</span>}>
            {canViewStock ? <ReactECharts option={topVendorOption} style={{ height: 280 }} /> : <div>ไม่มีสิทธิ stock</div>}
          </Card>
        </Col>
        <Col xs={24} xl={8}>
           <Card className="rounded-xl border-gray-100 shadow-sm" title={<div className="font-semibold text-teal-600 flex items-center gap-2"><PieChartOutlined /> สัดส่วนค่าคอมมิชชั่น (Commission Share)</div>} extra={<span className="text-xs text-gray-500">Top 8</span>}>
            {canSales ? <ReactECharts option={commPieOption} style={{ height: 280 }} /> : <div>ไม่มีสิทธิ sales</div>}
          </Card>
        </Col>
      </Row>

      {/* Low Stock & Commission By Seller (คู่กัน) */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card className="rounded-xl border-gray-100 shadow-sm" title={<div className="font-semibold text-red-500 flex items-center gap-2"><ExclamationCircleOutlined /> สินค้าใกล้หมด (Low Stock)</div>} extra={<span className="text-xs text-gray-500">เรียงตาม “ต้องเติม”</span>}>
            <Table
              scroll={{ x: 'max-content' }}
              rowKey={(r) => `${r.warehouse_id}-${r.product_id}`}
              columns={lowStockColumns as any}
              dataSource={lowStockRows}
              pagination={{ pageSize: 8 }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card className="rounded-xl border-gray-100 shadow-sm" title={<div className="font-semibold text-indigo-500 flex items-center gap-2"><TeamOutlined /> สรุปค่าคอมตามผู้ขาย (Commission by Seller)</div>} extra={<span className="text-xs text-gray-500">คลิ๊กแถวเพื่อดู INV</span>}>
            <Table
              scroll={{ x: 'max-content' }}
              rowKey={(r) => String((r as any).seller_id ?? "null")}
              columns={commColumns as any}
              dataSource={commBySeller}
              pagination={{ pageSize: 8 }}
              loading={loading}
              onRow={(record) => ({
                onClick: () => openSellerInvoices(record),
                style: { cursor: "pointer" },
              })}
            />
          </Card>
        </Col>
      </Row>

      {/* Settings */}
      <Modal
        title="ตั้งค่า Dashboard"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        centered
        onOk={() => {
          saveSettings(settingsKey, settings);
          setSettingsOpen(false);
          message.success("บันทึกแล้ว", 1.2);
          loadAll();
        }}
        okText="บันทึก"
        cancelText="ยกเลิก"
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">เกณฑ์สินค้าใกล้หมด</div>
            <InputNumber
              min={0}
              value={settings.lowStockThreshold}
              onChange={(v) => setSettings((p) => ({ ...p, lowStockThreshold: Number(v || 0) }))}
              addonAfter="ชิ้น"
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-2">ใช้กับ KPI + ตาราง Low Stock</div>
          </div>
          <Divider />
          <div>
            <div className="text-sm font-medium mb-2">Hot Sellers (Top N)</div>
            <InputNumber
              min={1}
              max={50}
              value={settings.hotSellerTopN}
              onChange={(v) => setSettings((p) => ({ ...p, hotSellerTopN: Number(v || 10) }))}
              addonAfter="รายการ"
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-2">ใช้กับกราฟ Hot Sellers + API /reports/hot-sellers</div>
          </div>
        </div>
      </Modal>

      {/* Modal: Drilldown (Sales Trend -> by seller) */}
      <Modal
        title={`ยอดขายรายบุคคล: ${drillDate ? dayjs(drillDate).format("DD/MM/YYYY") : ""}`}
        open={drillOpen}
        onCancel={() => setDrillOpen(false)}
        footer={null}
        width={900}
        centered
      >
        <Table
          rowKey={(r) => String(r.seller_id ?? "null")}
          loading={drillLoading}
          dataSource={drillRows}
          columns={drillColumns as any}
          pagination={{ pageSize: 10 }}
        />
      </Modal>

      {/* ✅ Modal: list INV ของผู้ขาย */}
      <Modal
        title={`INV ของผู้ขาย: ${sellerInvTitle}`}
        open={sellerInvOpen}
        onCancel={() => setSellerInvOpen(false)}
        footer={null}
        width={950}
        centered
      >
        <Table
          rowKey={(r) => String(r.sale_id)}
          loading={sellerInvLoading}
          dataSource={sellerInvRows}
          columns={sellerInvColumns as any}
          pagination={{ pageSize: 10 }}
          onRow={(record) => ({
            onClick: () => openInvoiceDetail(record.sale_id, record.invoice_no),
            style: { cursor: "pointer" },
          })}
        />
        <div className="text-xs text-gray-400 mt-2">คลิ๊กเลข INV เพื่อดูรายการสินค้าในใบ</div>
      </Modal>

      {/* ✅ Modal: INV detail items */}
      <Modal
        title={invDetailTitle}
        open={invDetailOpen}
        onCancel={() => setInvDetailOpen(false)}
        footer={null}
        width={1050}
        centered
      >
        {invDetailHeader ? (
          <div className="mb-3 text-sm text-gray-600">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <div><b>วันที่:</b> {invDetailHeader.issue_date ? dayjs(invDetailHeader.issue_date).format("DD/MM/YYYY") : "-"}</div>
              <div><b>สถานะ:</b> {invDetailHeader.status}</div>
              <div><b>ผู้ขาย:</b> {invDetailHeader.seller_name || "ไม่ระบุ"}</div>
              <div><b>ยอดรวม:</b> {Number(invDetailHeader.total || 0).toLocaleString()}</div>
            </div>
          </div>
        ) : null}

        <Table
          rowKey={(r) => String(r.id)}
          loading={invDetailLoading}
          dataSource={invDetailRows}
          columns={invDetailColumns as any}
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </div>
  );
}
