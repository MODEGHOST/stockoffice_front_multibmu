import { useEffect, useState } from "react";
import { Modal, Table, DatePicker, Space, Tag, Button, Input } from "antd";
import { SearchOutlined, DownloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { financeApi } from "../financeApi";
import type { FinanceAccount, FinanceTransaction } from "../financeApi";
import { Link } from "react-router-dom";
// @ts-ignore
import * as XLSX from "xlsx";

const { RangePicker } = DatePicker;

interface Props {
  open: boolean;
  onClose: () => void;
  account: FinanceAccount | null;
}

export default function FinanceTransactionModal({ open, onClose, account }: Props) {
  const [data, setData] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [searchText, setSearchText] = useState("");

  const fetchTransactions = async () => {
    if (!account) return;
    try {
      setLoading(true);
      const params: any = {};
      if (dates && dates[0] && dates[1]) {
        params.startDate = dates[0].format("YYYY-MM-DD");
        params.endDate = dates[1].format("YYYY-MM-DD");
      }
      const res = await financeApi.getTransactions(account.id, params);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && account) {
      fetchTransactions();
    } else {
      setData([]);
      setDates(null);
    }
  }, [open, account]);

  const filteredData = data.filter((row) => {
    if (!searchText) return true;
    const lower = searchText.toLowerCase();
    const refText1 = row.receipt_no || `Invoice #${row.reference_id}`;
    const refText2 = row.bill_no || `Bill #${row.reference_id}`;
    const customer = row.sales_customer_name || "";
    const vendor = row.purchase_vendor_name || "";
    return (
      refText1.toLowerCase().includes(lower) ||
      refText2.toLowerCase().includes(lower) ||
      customer.toLowerCase().includes(lower) ||
      vendor.toLowerCase().includes(lower)
    );
  });

  const exportExcel = () => {
     const exportData = filteredData.map((r) => ({
        "Date": dayjs(r.transaction_date).format("DD/MM/YYYY HH:mm"),
        "Reference": r.reference_type === "SALES_RECEIPT" 
            ? `${r.receipt_no || r.reference_id}` 
            : `${r.bill_no || r.reference_id}`,
        "IN (Value)": r.transaction_type === "INCOME" ? Number(r.amount) : 0,
        "OUT (Value)": r.transaction_type === "EXPENSE" ? Number(r.amount) : 0,
        "BALANCE (Value)": Number(r.running_balance),
        "Note": r.reference_type === "SALES_RECEIPT" 
            ? `Customer: ${r.sales_customer_name || "-"}` 
            : `Vendor: ${r.purchase_vendor_name || "-"}`
     }));
     const ws = XLSX.utils.json_to_sheet(exportData);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Statement");
     XLSX.writeFile(wb, `Statement_${account?.name}_${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  const columns: ColumnsType<FinanceTransaction> = [
    {
      title: "ลำดับ",
      key: "seq",
      width: 60,
      align: "center",
      render: (_, __, index) => <span className="text-gray-500">{index + 1}</span>,
    },
    {
      title: "วันที่",
      dataIndex: "transaction_date",
      width: 130,
      render: (val) => dayjs(val).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "เลขเอกสาร",
      key: "ref",
      width: 180,
      render: (_, record) => {
        let color = "default";
        let label: string = record.transaction_type;
        if (record.transaction_type === "INCOME") {
           color = "green";
           label = "IN";
        }
        if (record.transaction_type === "EXPENSE") {
           color = "orange";
           label = "OUT";
        }

        let refLink = <span className="font-medium">-</span>;
        
        if (record.reference_type === "SALES_RECEIPT") {
           refLink = (
             <Link to={`/sales/invoice`} className="text-blue-500 hover:underline font-medium">
               {record.receipt_no || `Invoice #${record.reference_id}`}
             </Link>
           );
        } else if (record.reference_type === "PURCHASE_BILL") {
           refLink = (
             <Link to={`/purchase/bill/${record.reference_id}`} className="text-blue-500 hover:underline font-medium">
               {record.bill_no || `Bill #${record.reference_id}`}
             </Link>
           );
        }

        return (
          <div>
            <div>{refLink}</div>
            <Tag color={color} className="!text-[10px] !px-1 mt-1">
              {label}
            </Tag>
          </div>
        );
      },
    },
    {
      title: "ยอดเงินเข้า/ออก",
      dataIndex: "amount",
      align: "right",
      width: 120,
      render: (val, record) => {
        const amt = Number(val);
        const sign = record.transaction_type === "INCOME" ? "+" : "-";
        const color = record.transaction_type === "INCOME" ? "text-green-600" : "text-orange-600";
        return <span className={`font-semibold ${color}`}>{sign}{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
      },
    },
    {
      title: "คงเหลือ",
      dataIndex: "running_balance",
      align: "right",
      width: 120,
      render: (val) => <span className="font-semibold text-blue-600">{Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: "หมายเหตุ / ลูกค้า",
      key: "note",
      render: (_, record) => {
        if (record.reference_type === "SALES_RECEIPT") {
           return <span className="text-gray-500 text-xs">ลูกค้า: {record.sales_customer_name || "-"}</span>;
        }
        if (record.reference_type === "PURCHASE_BILL") {
           return <span className="text-gray-500 text-xs">ผู้ขาย: {record.purchase_vendor_name || "-"}</span>;
        }
        return <span className="text-gray-400">-</span>;
      },
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div className="space-y-1">
          <div className="text-lg">ประวัติรายการ (Statement)</div>
          <div className="text-sm font-normal text-gray-500">{account?.name}</div>
        </div>
      }
      footer={null}
      width={1100}
      centered
      destroyOnClose
    >
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Space>
            <RangePicker 
               value={dates} 
               onChange={(vals) => setDates(vals as any)} 
               format="DD/MM/YYYY"
            />
            <Button type="primary" onClick={fetchTransactions}>ค้นหา</Button>
          </Space>
          
          <Space>
             <Input 
               placeholder="ค้นหาบิล, ชื่อ..." 
               prefix={<SearchOutlined className="text-gray-400" />}
               value={searchText}
               onChange={e => setSearchText(e.target.value)}
               allowClear
             />
             <Button icon={<DownloadOutlined />} onClick={exportExcel}>
               Export Excel
             </Button>
          </Space>
        </div>

        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey="id"
          size="middle"
          pagination={{ 
            pageSize: 15,
            showTotal: (total, range) => `${range[0]}-${range[1]} จาก ${total} รายการ`
          }}
          loading={loading}
          scroll={{ y: 500 }}
          bordered
          summary={() => {
             if (filteredData.length === 0) return null;
             const finalRow = data[0]; // The newest record is at index 0 after reverse
             return (
               <Table.Summary.Row className="bg-gray-50">
                 <Table.Summary.Cell index={0} colSpan={4}>
                   <div className="text-right py-2 font-semibold">ยอดเงินสดคงเหลือสุทธิ</div>
                 </Table.Summary.Cell>
                 <Table.Summary.Cell index={4} align="right">
                   <div className="font-semibold text-[15px]">{Number(finalRow?.running_balance || account?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                 </Table.Summary.Cell>
                 <Table.Summary.Cell index={5} colSpan={1}></Table.Summary.Cell>
               </Table.Summary.Row>
             )
          }}
        />
      </div>
    </Modal>
  );
}
