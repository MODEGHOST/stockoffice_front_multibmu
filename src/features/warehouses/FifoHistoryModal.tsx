import { Modal, Table, Radio, Tag, Alert, Input, Space, Button } from "antd";
import { SearchOutlined, DownloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import { getFifoHistory, type FifoHistoryRow } from "./warehouseApi";
// @ts-ignore
import * as XLSX from "xlsx";

export default function FifoHistoryModal({
  productId,
  productName,
  warehouseId,
  open,
  onCancel,
}: {
  productId: number;
  productName: string;
  warehouseId: number;
  open: boolean;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FifoHistoryRow[]>([]);
  const [mode, setMode] = useState<"WAREHOUSE" | "GLOBAL">("WAREHOUSE");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (open && productId && warehouseId) {
      loadHistory();
    }
  }, [open, productId, warehouseId, mode]);

  async function loadHistory() {
    setLoading(true);
    try {
      const history = await getFifoHistory(productId, mode, warehouseId);
      setData(history);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filteredData = useMemo(() => {
    if (!searchText) return data;
    const lower = searchText.toLowerCase();
    return data.filter(r => 
      String(r.ref_type).toLowerCase().includes(lower) ||
      String(r.ref_id).toLowerCase().includes(lower) ||
      dayjs(r.created_at).format("DD/MM/YYYY").includes(lower) ||
      String(r.warehouse_name).toLowerCase().includes(lower) ||
      String(r.warehouse_code).toLowerCase().includes(lower)
    );
  }, [data, searchText]);

  const remainingLots = useMemo(() => {
    let lots: { ref_type: string, ref_id: string, unit_cost: number; available: number }[] = [];
    for (const r of data) {
      if (r.move_type === "IN") {
        const cost = Number(r.display_qty) > 0 ? Number(r.move_value) / Number(r.display_qty) : 0;
        lots.push({ ref_type: String(r.ref_type), ref_id: String(r.ref_id), unit_cost: cost, available: Number(r.display_qty) });
      } else if (r.move_type === "OUT") {
        let consumeQty = Number(r.display_qty);
        for (const lot of lots) {
          if (consumeQty <= 0) break;
          if (lot.available > 0) {
            const take = Math.min(lot.available, consumeQty);
            lot.available -= take;
            consumeQty -= take;
          }
        }
      }
    }
    
    // Group remaining by ref_type, ref_id, unit_cost
    const grouped = new Map<string, { ref_type: string, ref_id: string, unit_cost: number, available: number }>();
    for (const lot of lots) {
      if (lot.available > 0) {
         // Use a combined key of ref_type, ref_id, and rounded cost
         const cost = Math.round(lot.unit_cost * 10000) / 10000;
         const key = `${lot.ref_type}_${lot.ref_id}_${cost}`;
         const existing = grouped.get(key);
         if (existing) {
            existing.available += lot.available;
         } else {
            grouped.set(key, { ...lot, unit_cost: cost });
         }
      }
    }
    
    return Array.from(grouped.values());
  }, [data]);

  function exportExcel() {
     const exportData = filteredData.map((r, index) => ({
        "Seq": index + 1,
        "Date": dayjs(r.created_at).format("DD/MM/YYYY HH:mm"),
        "Reference": `${r.ref_type} ${r.ref_id}`,
        "IN Qty": r.move_type === "IN" ? Number(r.display_qty) : "",
        "IN Cost": r.move_type === "IN" ? (Number(r.move_value) / Number(r.display_qty)) : "",
        "IN Value": r.move_type === "IN" ? Number(r.move_value) : "",
        "OUT Qty": r.move_type === "OUT" ? Number(r.display_qty) : "",
        "OUT Cost": r.move_type === "OUT" ? (Number(r.move_value) / Number(r.display_qty)) : "",
        "OUT Value": r.move_type === "OUT" ? Number(r.move_value) : "",
        "BAL Qty": Number(r.balance_qty),
        "BAL Value": Number(r.balance_value),
        "Warehouse": `${r.warehouse_code} - ${r.warehouse_name}`,
        "Note": r.note || ""
     }));
     const ws = XLSX.utils.json_to_sheet(exportData);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Stock Card");
     XLSX.writeFile(wb, `StockCard_${productName}_${dayjs().format('YYYYMMDD')}.xlsx`);
  }

  const columns: ColumnsType<FifoHistoryRow> = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 140,
      render: (v) => <span className="text-gray-600">{dayjs(v).format("DD/MM/YYYY HH:mm")}</span>,
    },
    {
      title: "Reference",
      key: "ref",
      width: 150,
      render: (_, r) => {
        let color = "default";
        if (r.move_type === "IN") color = "green";
        if (r.move_type === "OUT") color = "orange";
        return (
          <div>
            <div className="font-medium">{r.ref_type} {r.ref_id}</div>
            <Tag color={color} className="!text-[10px] !px-1 mt-1">
              {r.move_type}
            </Tag>
          </div>
        );
      },
    },
    {
      title: "IN",
      children: [
        {
          title: "Qty",
          key: "in_qty",
          align: "right",
          width: 80,
          render: (_, r) => r.move_type === "IN" ? <span className="font-semibold text-green-600">{Number(r.display_qty).toLocaleString()}</span> : null
        },
        {
          title: "Cost",
          key: "in_cost",
          align: "right",
          width: 100,
          render: (_, r) => {
            if (r.move_type !== "IN") return null;
            const cost = Number(r.display_qty) > 0 ? Number(r.move_value) / Number(r.display_qty) : 0;
            return <span className="text-gray-700">{cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
          }
        },
        {
          title: "Value",
          key: "in_val",
          align: "right",
          width: 120,
          render: (_, r) => r.move_type === "IN" ? <span className="font-semibold text-green-600">{Number(r.move_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : null
        }
      ]
    },
    {
      title: "OUT",
      children: [
        {
          title: "Qty",
          key: "out_qty",
          align: "right",
          width: 80,
          render: (_, r) => r.move_type === "OUT" ? <span className="font-semibold text-orange-600">{Number(r.display_qty).toLocaleString()}</span> : null
        },
        {
          title: "Cost",
          key: "out_cost",
          align: "right",
          width: 120,
          render: (_, r) => {
            if (r.move_type !== "OUT") return null;
            if (!r.lot_details || r.lot_details.length === 0) return "-";
            if (r.lot_details.length === 1) {
               return <span className="text-gray-700">{Number(r.lot_details[0].unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
            }
            return <span className="text-gray-400 italic text-xs">หลายอัตรา</span>;
          }
        },
        {
          title: "Value",
          key: "out_val",
          align: "right",
          width: 120,
          render: (_, r) => r.move_type === "OUT" ? <span className="font-semibold text-orange-600">{Number(r.move_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : null
        }
      ]
    },
    {
      title: "BALANCE",
      children: [
        {
          title: "Qty",
          dataIndex: "balance_qty",
          key: "bal_qty",
          align: "right",
          width: 90,
          render: (v) => <span className="font-semibold text-blue-600">{Number(v).toLocaleString()}</span>
        },
        {
          title: "Cost",
          key: "bal_cost",
          align: "right",
          width: 100,
          render: (_, r) => {
            const bQty = Number(r.balance_qty);
            const bVal = Number(r.balance_value);
            if (bQty > 0) {
              const avgCost = bVal / bQty;
              return <span className="text-gray-700">{avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
            }
            return <span className="text-gray-400">-</span>;
          }
        },
        {
          title: "Value",
          dataIndex: "balance_value",
          key: "bal_val",
          align: "right",
          width: 130,
          render: (v) => <span className="font-semibold text-blue-600">{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        }
      ]
    },
    {
      title: "หมายเหตุ",
      key: "note",
      render: (_, r) => {
        const dbNote = r.note ? <div className="text-gray-500">{r.note}</div> : null;
        
        // Show FIFO breakdown for OUT movements
        const outBreakdown = r.move_type === "OUT" && r.lot_details && r.lot_details.length > 0 ? (
          <div className="text-xs text-gray-500 space-y-1 mt-1">
            {r.lot_details.map((lot, idx) => (
              <div key={idx} className="text-orange-600 whitespace-nowrap">
                {lot.qty.toLocaleString()} @ {Number(lot.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })} บ.
              </div>
            ))}
          </div>
        ) : null;

        if (!dbNote && !outBreakdown) return <span className="text-gray-400">-</span>;
        
        return (
          <div>
            {dbNote}
            {outBreakdown}
            <div className="text-xs text-gray-400 mt-1">{r.warehouse_code}</div>
          </div>
        );
      },
    },
  ];


  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={
        <div className="space-y-1">
          <div className="text-lg">ประวัติ FIFO / Stock Card</div>
          <div className="text-sm font-normal text-gray-500">{productName}</div>
        </div>
      }
      width={1300}
      centered
      destroyOnClose
    >
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Space direction="vertical" size="small">
          <Radio.Group
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="WAREHOUSE">ดูเฉพาะคลังนี้</Radio.Button>
            <Radio.Button value="GLOBAL">บันทึกรวมทุกคลัง (Global)</Radio.Button>
          </Radio.Group>
          {mode === "GLOBAL" && (
             <Alert 
               title="กำลังดูต้นทุนแบบ Global FIFO (เรียงตาม Lot เข้าของทั้งบริษัท)" 
               type="info" 
               showIcon 
               className="!py-1"
             />
          )}
        </Space>
        
        <Space>
           <Input 
             placeholder="ค้นหา (เลขที่, วันที่, คลัง)..." 
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
        rowKey="move_id"
        loading={loading}
        columns={columns}
        dataSource={filteredData}
        pagination={{ 
          pageSize: 10, 
          showSizeChanger: true, 
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) => `${range[0]}-${range[1]} จาก ${total} รายการ`
        }}
        size="small"
        bordered
        summary={() => {
          if (filteredData.length === 0) return null;
          const finalBal = data[data.length - 1]; // Use original data for true balance
          
          return (
             <Table.Summary.Row className="bg-gray-50">
               <Table.Summary.Cell index={0} colSpan={2}>
                 <div className="text-right font-semibold py-2">สินค้าคงเหลือสุทธิ</div>
               </Table.Summary.Cell>
               <Table.Summary.Cell index={2} colSpan={6}></Table.Summary.Cell>
               <Table.Summary.Cell index={8} align="right">
                 <div className="font-semibold text-blue-600">{Number(finalBal.balance_qty).toLocaleString()}</div>
               </Table.Summary.Cell>
               <Table.Summary.Cell index={9}></Table.Summary.Cell>
               <Table.Summary.Cell index={10} align="right">
                 <div className="font-semibold text-[15px]">{Number(finalBal.balance_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
               </Table.Summary.Cell>
               <Table.Summary.Cell index={11} colSpan={1}>
                 <div className="text-xs text-gray-500 font-medium leading-relaxed max-w-sm">
                   <div className="mb-1">เหลือจากล๊อต:</div>
                   <div className="flex flex-col gap-1 ml-2">
                     {remainingLots.map((lot, idx) => (
                        <div key={idx} className="text-blue-600 whitespace-nowrap">
                          {lot.ref_type} {lot.ref_id}: {lot.available.toLocaleString()} @ {lot.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                        </div>
                     ))}
                   </div>
                 </div>
               </Table.Summary.Cell>
             </Table.Summary.Row>
          );
        }}
      />
    </Modal>
  );
}
