import { useState, useEffect } from "react";
import { Table, DatePicker, Button, Card, Space, message, Modal, Select } from "antd";
import { WalletOutlined, FileTextOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import api from "../../lib/api";

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
  paid_date: string;
  finance_account_name: string;
  invoice_count: number;
};

export default function CommissionPaymentPage() {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);

  const [unpaidList, setUnpaidList] = useState<UnpaidCommissionRow[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<number[]>([]);
  const [invoiceDetails, setInvoiceDetails] = useState<Record<number, any[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<number, boolean>>({});
  const [historyList, setHistoryList] = useState<PaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Partial Payment State
  const [selectedInvoiceKeys, setSelectedInvoiceKeys] = useState<Record<number, React.Key[]>>({});

  const [financeAccounts, setFinanceAccounts] = useState<any[]>([]);
  
  // Pay Modal State
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<UnpaidCommissionRow | null>(null);
  const [payMode, setPayMode] = useState<"ALL" | "PARTIAL">("ALL"); 
  const [partialInvoices, setPartialInvoices] = useState<any[]>([]);
  const [payForm, setPayForm] = useState({
    finance_account_id: undefined as number | undefined,
    note: ""
  });
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetchFinanceAccounts();
    loadUnpaid();
    loadHistory();
  }, [dateRange]);

  const fetchFinanceAccounts = async () => {
    try {
      const { data } = await api.get("/finance-accounts");
      setFinanceAccounts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadUnpaid = async () => {
    if (!dateRange?.[0] || !dateRange?.[1]) return;
    setLoading(true);
    try {
      const from = dateRange[0].format("YYYY-MM-DD");
      const to = dateRange[1].format("YYYY-MM-DD");
      const { data } = await api.get("/commissions/unpaid-summary", { params: { from, to } });
      setUnpaidList(data.rows || []);
      setSelectedInvoiceKeys({}); // Reset selections when date changes
    } catch (error: any) {
      message.error("Failed to load unpaid commissions");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get("/commissions/history", { params: { limit: 10 } });
      setHistoryList(data.rows || []);
    } catch (error) {
      console.error(error);
    } finally {
      setHistoryLoading(false);
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

  const handleOpenPayModal = (record: UnpaidCommissionRow, mode: "ALL" | "PARTIAL" = "ALL") => {
    setSelectedSeller(record);
    setPayMode(mode);
    setPayForm({ finance_account_id: undefined, note: `รอบชำระ ${dateRange[0].format("DD/MM/YYYY")} - ${dateRange[1].format("DD/MM/YYYY")}` });
    
    if (mode === "PARTIAL") {
      const selectedIds = selectedInvoiceKeys[record.seller_id] || [];
      const details = invoiceDetails[record.seller_id] || [];
      const selectedData = details.filter(item => selectedIds.includes(item.sale_id));
      setPartialInvoices(selectedData);
    } else {
      setPartialInvoices([]);
    }

    setPayModalVisible(true);
  };

  const confirmPay = async () => {
    if (!selectedSeller) return;
    if (!payForm.finance_account_id) {
      return message.warning("กรุณาเลือกช่องทางการเงินที่ใช้จ่าย");
    }

    setPaying(true);
    try {
      const from = dateRange[0].format("YYYY-MM-DD");
      const to = dateRange[1].format("YYYY-MM-DD");
      
      const payload: any = {
        seller_id: selectedSeller.seller_id,
        finance_account_id: payForm.finance_account_id,
        note: payForm.note,
      };

      if (payMode === "PARTIAL") {
        payload.invoice_ids = selectedInvoiceKeys[selectedSeller.seller_id];
        payload.amount = partialInvoices.reduce((sum, item) => sum + Number(item.commission_total), 0);
      } else {
        payload.from = from;
        payload.to = to;
        payload.amount = Number(selectedSeller.unpaid_commission_total);
      }

      await api.post("/commissions/pay", payload);
      message.success("บันทึกจ่ายค่าคอมมิชชั่นเรียบร้อยแล้ว");
      setPayModalVisible(false);

      // Clear selection after payment
      if (payMode === "PARTIAL" && selectedSeller) {
         setSelectedInvoiceKeys(prev => {
            const newKeys = { ...prev };
            delete newKeys[selectedSeller.seller_id];
            return newKeys;
         });
         // Also clear detail cache to force reload if expanded again
         setInvoiceDetails(prev => {
            const newDetails = { ...prev };
            delete newDetails[selectedSeller.seller_id];
            return newDetails;
         });
      }

      loadUnpaid();
      loadHistory();
    } catch (error: any) {
      message.error(error.response?.data?.message || "Error paying commission");
    } finally {
      setPaying(false);
    }
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
      title: "ช่องทางที่จ่าย",
      dataIndex: "finance_account_name",
      render: (v: string) => <span className="text-blue-600">{v}</span>,
    },
    {
      title: "ยอดเงิน",
      dataIndex: "total_amount",
      align: "right" as const,
      render: (v: number) => <span className="font-semibold text-green-600">฿{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
  ];

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
          />
        </div>
        
        <Table
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
          rowKey="id"
          columns={historyCols}
          dataSource={historyList}
          loading={historyLoading}
          pagination={false}
          size="small"
        />
      </Card>

      {/* Pay Modal */}
      <Modal
      centered
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <WalletOutlined />
            </div>
            ยืนยันการจ่ายค่าคอมมิชชั่น
          </div>
        }
        open={payModalVisible}
        onCancel={() => setPayModalVisible(false)}
        onOk={confirmPay}
        okText="ยืนยันจ่ายเงิน"
        confirmLoading={paying}
        okButtonProps={{ className: "bg-orange-600" }}
        destroyOnClose
      >
        {selectedSeller && (
          <div className="py-4 space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center border border-gray-200">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">จ่ายให้พนักงาน</div>
                <div className="font-semibold text-gray-800">{selectedSeller.seller_name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 uppercase tracking-wider">ยอดเงินสุทธิ</div>
                <div className="font-bold text-2xl text-orange-600">
                  ฿{payMode === "PARTIAL" 
                    ? Number(partialInvoices.reduce((sum, item) => sum + Number(item.commission_total), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : Number(selectedSeller.unpaid_commission_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  }
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500 text-center mb-6">
              รอบบิล: <span className="font-medium text-gray-800">{dateRange[0].format("DD/MM/YYYY")} ถึง {dateRange[1].format("DD/MM/YYYY")}</span> <br/>
              {payMode === "PARTIAL" 
                ? <span className="text-blue-600 font-medium">จ่ายเฉพาะบิลที่เลือกจำนวน {partialInvoices.length} บิล</span>
                : <span>จำนวน {selectedSeller.inv_count} บิล (ทั้งหมดในรอบนี้)</span>
              }
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                หักจากช่องทางการเงิน (Finance Account) <span className="text-red-500">*</span>
              </label>
              <Select
                className="w-full"
                placeholder="เลือกบัญชีที่ใช้จ่าย"
                size="large"
                value={payForm.finance_account_id}
                onChange={(v) => setPayForm({ ...payForm, finance_account_id: v })}
                options={financeAccounts.map((a) => ({
                  value: a.id,
                  label: (
                    <div className="flex justify-between w-full pr-4">
                      <span>{a.name}</span>
                      <span className="text-gray-400">ยอดเงิน: ฿{Number(a.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )
                }))}
              />
            </div>
          </div>
        )}
      </Modal>

    </Space>
  );
}
