import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, DatePicker, Button, Card, Space, message } from "antd";
import { WalletOutlined, FileTextOutlined, ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../../lib/api";
import { CPPrint } from "./CPPrint";

const { RangePicker } = DatePicker;

type UnpaidCommissionRow = {
  seller_id: number;
  seller_name: string;
  seller_email: string;
  inv_count: number;
  unpaid_commission_total: number;
};

type PaymentHistoryRow = {
  id: number;
  seller_name: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  original_total: number;
  paid_date: string;
  finance_account_name: string;
  invoice_count: number;
};

export default function CommissionPaymentPage() {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);

  const [expandedRowKeys, setExpandedRowKeys] = useState<number[]>([]);
  const [invoiceDetails, setInvoiceDetails] = useState<Record<number, any[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<number, boolean>>({});
  
  const [expandedHistoryRowKeys, setExpandedHistoryRowKeys] = useState<number[]>([]);
  const [historyDetails, setHistoryDetails] = useState<Record<number, any[]>>({});
  const [loadingHistoryDetails, setLoadingHistoryDetails] = useState<Record<number, boolean>>({});

  // Partial Payment State
  const [selectedInvoiceKeys, setSelectedInvoiceKeys] = useState<Record<number, React.Key[]>>({});

  const nav = useNavigate();
  const location = useLocation();

  const fromDate = dateRange[0] ? dateRange[0].format("YYYY-MM-DD") : "";
  const toDate = dateRange[1] ? dateRange[1].format("YYYY-MM-DD") : "";

  // 1. Unpaid Summary Query
  const { data: unpaidList = [], isLoading: loading, refetch: refetchUnpaid } = useQuery({
    queryKey: ["unpaidCommissions", fromDate, toDate],
    queryFn: async () => {
      if (!fromDate || !toDate) return [];
      const { data } = await api.get("/commissions/unpaid-summary", { params: { from: fromDate, to: toDate } });
      return data.rows || [];
    },
  });

  // 2. History Summary Query
  const { data: historyList = [], isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ["commissionHistory"],
    queryFn: async () => {
      const { data } = await api.get("/commissions/history", { params: { limit: 10 } });
      return data.rows || [];
    },
  });

  // Reset selections when date changes
  useEffect(() => {
    setSelectedInvoiceKeys({});
  }, [fromDate, toDate]);

  // Refresh detection if navigated back
  useEffect(() => {
    if (location.state?.refresh) {
      refetchUnpaid();
      refetchHistory();
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.refresh, refetchUnpaid, refetchHistory]);

  const loadHistoryItems = async (paymentId: number) => {
    if (historyDetails[paymentId] || loadingHistoryDetails[paymentId]) return;
    setLoadingHistoryDetails(prev => ({ ...prev, [paymentId]: true }));
    try {
      const { data } = await api.get(`/commissions/history/${paymentId}/items`);
      setHistoryDetails(prev => ({ ...prev, [paymentId]: data.rows || [] }));
    } catch (error) {
      console.error("Failed to load history items", error);
    } finally {
      setLoadingHistoryDetails(prev => ({ ...prev, [paymentId]: false }));
    }
  };

  const handleHistoryExpand = (expanded: boolean, record: PaymentHistoryRow) => {
    if (expanded) {
      setExpandedHistoryRowKeys([record.id]);
      loadHistoryItems(record.id);
    } else {
      setExpandedHistoryRowKeys([]);
    }
  };

  const loadInvoiceDetails = async (sellerId: number) => {
    if (invoiceDetails[sellerId] || loadingDetails[sellerId]) return;
    setLoadingDetails(prev => ({ ...prev, [sellerId]: true }));
    try {
      const from = dateRange[0].format("YYYY-MM-DD");
      const to = dateRange[1].format("YYYY-MM-DD");
      const { data } = await api.get("/commissions/unpaid-invoices", { 
        params: { seller_id: sellerId, from, to } 
      });
      setInvoiceDetails(prev => ({ ...prev, [sellerId]: data.rows || [] }));
    } catch (error) {
      console.error("Failed to load invoice details", error);
    } finally {
      setLoadingDetails(prev => ({ ...prev, [sellerId]: false }));
    }
  };

  const handleExpand = (expanded: boolean, record: UnpaidCommissionRow) => {
    if (expanded) {
      setExpandedRowKeys([record.seller_id]); // Only keep one expanded
      loadInvoiceDetails(record.seller_id);
    } else {
      setExpandedRowKeys([]);
    }
  };

  const handleOpenPayModal = async (record: UnpaidCommissionRow, mode: "ALL" | "PARTIAL" = "ALL") => {
    let itemsToPay: any[] = [];
    
    if (mode === "PARTIAL") {
      const selectedIds = selectedInvoiceKeys[record.seller_id] || [];
      const details = invoiceDetails[record.seller_id] || [];
      itemsToPay = details.filter(item => selectedIds.includes(item.sale_id)).map(item => ({...item, paid_amount: Number(item.commission_total), original_amount: Number(item.commission_total)}));
    } else {
      let details = invoiceDetails[record.seller_id];
      if (!details) {
        setLoadingDetails(prev => ({ ...prev, [record.seller_id]: true }));
        try {
          const from = dateRange[0].format("YYYY-MM-DD");
          const to = dateRange[1].format("YYYY-MM-DD");
          const { data } = await api.get("/commissions/unpaid-invoices", { 
            params: { seller_id: record.seller_id, from, to } 
          });
          details = data.rows || [];
          setInvoiceDetails(prev => ({ ...prev, [record.seller_id]: details }));
        } catch (error) {
          console.error("Failed to load invoice details", error);
          details = [];
        } finally {
          setLoadingDetails(prev => ({ ...prev, [record.seller_id]: false }));
        }
      }
      itemsToPay = (details || []).map((item: any) => ({ ...item, paid_amount: Number(item.commission_total), original_amount: Number(item.commission_total) }));
    }

    nav("/admin/commissions/new", {
      state: {
         selectedSeller: record,
         payingItems: itemsToPay,
         dateRange: dateRange
      }
    });
  };

  const unpaidCols = [
    {
      title: "พนักงานขาย",
      key: "seller",
      render: (_: any, r: UnpaidCommissionRow) => (
        <div>
          <div className="font-medium text-gray-800">{r.seller_name}</div>
          <div className="text-xs text-gray-500">{r.seller_email}</div>
        </div>
      ),
    },
    {
      title: "จำนวนบิล(รอจ่าย)",
      dataIndex: "inv_count",
      align: "center" as const,
      width: 150,
      render: (v: number) => <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded-md text-xs border border-orange-100">{v} บิล</span>,
    },
    {
      title: "ยอดค่าคอมค้างจ่าย",
      dataIndex: "unpaid_commission_total",
      align: "right" as const,
      width: 200,
      render: (v: number) => <span className="font-bold text-orange-600">฿{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
    {
      title: "จัดการ",
      key: "action",
      width: 150,
      align: "center" as const,
      render: (_: any, r: UnpaidCommissionRow) => (
        <Button 
          type="primary" 
          icon={<WalletOutlined />} 
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenPayModal(r, "ALL");
          }}
        >
          จ่ายทั้งหมด
        </Button>
      ),
    },
  ];

  const expandedRowRender = (record: UnpaidCommissionRow) => {
    const details = invoiceDetails[record.seller_id] || [];
    const isLoading = loadingDetails[record.seller_id];

    const detailCols = [
      {
        title: "วันที่ออกบิล",
        dataIndex: "issue_date",
        width: 150,
        render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
      },
      {
        title: "เลขที่บิล",
        dataIndex: "invoice_no",
        width: 150,
        render: (v: string, record: any) => (
          <Link to={`/sales/invoice/${record.sale_id}`} target="_blank" className="font-medium text-blue-600 hover:underline">
            {v}
          </Link>
        ),
      },
      {
        title: "ยอดขายรวม (Invoice Total)",
        dataIndex: "invoice_total",
        align: "right" as const,
        render: (v: number) => `฿${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        title: "ค่าคอมมิชชั่นที่ได้",
        dataIndex: "commission_total",
        align: "right" as const,
        render: (v: number) => <span className="text-orange-600 font-semibold">฿{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
      },
    ];

    const selectedKeys = selectedInvoiceKeys[record.seller_id] || [];
    const hasSelection = selectedKeys.length > 0;

    const rowSelection = {
      selectedRowKeys: selectedKeys,
      onChange: (selectedRowKeys: React.Key[]) => {
        setSelectedInvoiceKeys(prev => ({
          ...prev,
          [record.seller_id]: selectedRowKeys
        }));
      },
    };

    return (
      <div className="bg-orange-50/50 p-4 border border-orange-100 rounded-lg m-2 shadow-inner">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-gray-700 flex items-center gap-2">
            <FileTextOutlined className="text-orange-500" />
            รายละเอียดบิลขายที่รอจ่ายค่าคอมมิชชั่น
          </h4>
          <Button 
            type="primary"
            size="small"
            disabled={!hasSelection}
            onClick={() => handleOpenPayModal(record, "PARTIAL")}
            className={hasSelection ? "bg-orange-500 hover:bg-orange-600 border-none" : ""}
          >
            จ่ายเฉพาะบิลที่เลือก ({selectedKeys.length})
          </Button>
        </div>
        <Table 
          rowSelection={rowSelection}
          columns={detailCols} 
          dataSource={details} 
          rowKey="sale_id"
          pagination={false} 
          size="small"
          loading={isLoading}
          className="bg-white rounded-md overflow-hidden border border-gray-200"
        />
      </div>
    );
  };

  const renderDifference = (original: number, paid: number) => {
    const diff = Number(paid) - Number(original);
    if (diff === 0) return null;
    if (diff > 0) {
      return (
        <span className="text-green-600 font-semibold text-xs flex items-center justify-end gap-1">
          <ArrowUpOutlined /> +฿{diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }
    return (
      <span className="text-red-500 font-semibold text-xs flex items-center justify-end gap-1">
        <ArrowDownOutlined /> -฿{Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  };

  const historyCols = [
    {
      title: "วันที่จ่าย",
      dataIndex: "paid_date",
      width: 160,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "พนักงาน",
      dataIndex: "seller_name",
    },
    {
      title: "รอบที่จ่าย",
      key: "period",
      render: (_: any, r: PaymentHistoryRow) => (
        <span className="text-gray-500 text-sm">
          {dayjs(r.period_start).format("DD/MM/YY")} - {dayjs(r.period_end).format("DD/MM/YY")}
          <span className="ml-2 text-xs text-gray-400">({r.invoice_count} บิล)</span>
        </span>
      ),
    },
    {
      title: "เลขที่เอกสาร",
      dataIndex: "document_no",
      render: (v: string) => <span className="font-medium text-gray-800">{v || "-"}</span>,
    },
    {
      title: "ช่องทางที่จ่าย",
      dataIndex: "finance_account_name",
      render: (v: string) => <span className="text-blue-600">{v}</span>,
    },
    {
      title: "ยอดเดิม",
      dataIndex: "original_total",
      align: "right" as const,
      width: 120,
      render: (v: number) => <span className="text-gray-500 line-through text-xs mr-2">฿{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
    {
      title: "ส่วนต่าง",
      key: "diff",
      align: "right" as const,
      width: 120,
      render: (_: any, r: PaymentHistoryRow) => renderDifference(Number(r.original_total), Number(r.total_amount)),
    },
    {
      title: "ยอดจ่ายจริง",
      dataIndex: "total_amount",
      align: "right" as const,
      width: 150,
      render: (v: number) => <span className="font-semibold text-green-600">฿{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
  ];

  const expandedHistoryRowRender = (record: PaymentHistoryRow) => {
    const details = historyDetails[record.id] || [];
    const isLoading = loadingHistoryDetails[record.id];

    const detailCols = [
      {
        title: "วันที่ออกบิล",
        dataIndex: "issue_date",
        width: 150,
        render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
      },
      {
        title: "เลขที่บิล",
        dataIndex: "invoice_no",
        width: 150,
        render: (v: string, r: any) => (
          <Link to={`/sales/invoice/${r.sale_id}`} target="_blank" className="font-medium text-blue-600 hover:underline">
            {v}
          </Link>
        ),
      },
      {
        title: "ยอดขายรวม",
        dataIndex: "invoice_total",
        align: "right" as const,
        render: (v: number) => `฿${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        title: "ต้นทุน",
        dataIndex: "cost_total",
        align: "right" as const,
        render: (v: number) => <span className="text-gray-500">฿{Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
      },
      {
        title: "กำไร/ขาดทุน",
        dataIndex: "profit_total",
        align: "right" as const,
        render: (v: number) => <span className="font-semibold text-blue-600">฿{Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
      },
      {
        title: "สัดส่วนกำไร (%)",
        key: "profit_percent",
        align: "right" as const,
        render: (_: any, r: any) => {
          const invTotal = Number(r.invoice_total) || 0;
          const profit = Number(r.profit_total) || 0;
          if (invTotal <= 0) return <span className="text-gray-400">-</span>;
          const percent = (profit / invTotal) * 100;
          const colorClass = percent >= 0 ? "text-green-600" : "text-red-500";
          return <span className={`font-semibold ${colorClass}`}>{percent > 0 ? "+" : ""}{percent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>;
        },
      },
      {
        title: "ค่าคอมเดิม",
        dataIndex: "original_amount",
        align: "right" as const,
        render: (v: number) => <span className="text-gray-500">฿{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
      },
      {
        title: "ส่วนต่าง",
        key: "diff",
        align: "right" as const,
        render: (_: any, r: any) => renderDifference(Number(r.original_amount), Number(r.paid_amount)),
      },
      {
        title: "ค่าคอมที่จ่ายจริง",
        dataIndex: "paid_amount",
        align: "right" as const,
        render: (v: number) => <span className="text-green-600 font-semibold">฿{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
      },
    ];

    return (
      <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg m-2 shadow-inner">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-gray-700 flex items-center gap-2 m-0">
            <FileTextOutlined className="text-gray-500" />
            รายละเอียดบิลที่จ่าย (บิลที่เลือกจ่ายทั้งหมด {details.length} รายการ)
          </h4>
          <div>
            {!isLoading && details.length > 0 && (
              <CPPrint record={record} details={details} />
            )}
          </div>
        </div>
        <Table 
          columns={detailCols} 
          dataSource={details} 
          rowKey="id"
          pagination={false} 
          size="small"
          loading={isLoading}
          className="bg-white rounded-md overflow-hidden border border-gray-200"
          rowClassName={(r) => Number(r.original_amount) !== Number(r.paid_amount) ? "bg-orange-50/80" : ""}
        />
      </div>
    );
  };

  return (
    <Space direction="vertical" className="w-full" size="large">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จ่ายค่าคอมมิชชั่น</h1>
          <p className="text-gray-500">สำหรับผู้ดูแลระบบ ตัดรอบจ่ายค่าคอมมิชชั่นตามช่วงเวลา</p>
        </div>
      </div>

      <Card className="rounded-xl shadow-sm border-gray-100" title={<div className="font-semibold text-orange-600 flex items-center gap-2"><WalletOutlined /> ค่าคอมมิชชั่นที่ค้างจ่าย (Unpaid)</div>}>
        <div className="mb-4 flex items-center gap-4">
          <div className="text-gray-600 font-medium">เลือกรอบบิล (ช่วงเวลาที่อนุมัติขาย):</div>
          <RangePicker
            allowClear={false}
            value={dateRange}
            onChange={(val) => {
              if (val) setDateRange([val[0] as dayjs.Dayjs, val[1] as dayjs.Dayjs]);
            }}
            format="DD/MM/YYYY"
            presets={[
              { label: 'เดือนนี้', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
              { label: 'เดือนที่แล้ว', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
              { label: 'ปีนี้', value: [dayjs().startOf('year'), dayjs().endOf('year')] },
            ]}
          />
        </div>
        
        <Table
          scroll={{ x: 'max-content' }}
          rowKey="seller_id"
          columns={unpaidCols}
          dataSource={unpaidList}
          loading={loading}
          pagination={false}
          locale={{ emptyText: "ไม่มีค่าคอมค้างจ่ายในช่วงเวลานี้" }}
          expandable={{
            expandedRowRender,
            expandedRowKeys,
            onExpand: handleExpand,
          }}
        />
      </Card>

      <Card className="rounded-xl shadow-sm border-gray-100" title={<div className="font-semibold text-gray-700 flex items-center gap-2"><FileTextOutlined /> ประวัติการจ่ายเงินล่าสุด (History)</div>}>
        <Table
          scroll={{ x: 'max-content' }}
          rowKey="id"
          columns={historyCols}
          dataSource={historyList}
          loading={historyLoading}
          pagination={false}
          size="small"
          rowClassName={(r) => Number(r.original_total) !== Number(r.total_amount) ? "bg-orange-50/50" : ""}
          expandable={{
            expandedRowRender: expandedHistoryRowRender,
            expandedRowKeys: expandedHistoryRowKeys,
            onExpand: handleHistoryExpand,
          }}
        />
      </Card>

    </Space>
  );
}
