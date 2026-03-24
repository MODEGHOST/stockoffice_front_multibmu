import React, { useRef, useState, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../../lib/api";

interface CPPrintProps {
  record: any;
  details: any[];
}

export const CPPrint: React.FC<CPPrintProps> = ({ record, details }) => {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `CP-${record.id.toString().padStart(5, '0')}`,
  });

  const [company, setCompany] = useState<any>(null);
  useEffect(() => {
    api.get("/company/settings").then(res => setCompany(res.data)).catch(() => {});
  }, []);

  const compName = company?.name || "บริษัท บิลด์มีอัพ คอนซัลแทนท์ จำกัด";
  const compAddress = company 
    ? [company.address, company.sub_district && `ต.${company.sub_district}`, company.district && `อ.${company.district}`, company.province && `จ.${company.province}`, company.zip_code].filter(Boolean).join(" ")
    : "212/249-250 หมู่บ้านคุณาลัย คอร์ทยาร์ด ถนนบ้านกล้วย-ไทรน้อย ตำบลพิมลราช อำเภอบางบัวทอง นนทบุรี 11110";
  const compPhone = company?.phone || "02-123-4567";

  return (
    <>
      <Button icon={<PrinterOutlined />} onClick={() => handlePrint && handlePrint()} size="small" className="text-gray-600 hover:text-orange-600 bg-white border-gray-300">
         พิมพ์เอกสาร (ใบ CP)
      </Button>

      <div style={{ display: "none" }}>
        <div ref={componentRef} className="bg-white text-slate-800 font-sans" style={{ minHeight: "297mm", width: "210mm", margin: "0 auto", padding: "40px" }}>
          {/* Header */}
          <div className="h-2 w-full bg-orange-500 mb-8 rounded-full"></div>
          <div className="flex justify-between items-start mb-8">
            <div className="flex-1">
               <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">{compName}</h1>
               <div className="text-sm text-slate-500 leading-relaxed">
                  <p>{compAddress}</p>
                  <p>Tel: {compPhone}</p>
               </div>
            </div>
            <div className="text-right">
               <h2 className="text-2xl font-bold text-orange-600 mb-2 uppercase tracking-wide">ใบสำคัญจ่ายค่าคอมมิชชั่น</h2>
               <div className="inline-block text-left bg-orange-50 rounded-lg p-3 border border-orange-100">
                   <div className="text-sm mb-1">
                       <span className="font-semibold text-orange-800 w-16 inline-block">No:</span> 
                       <span className="font-mono text-slate-700">CP-{record.id.toString().padStart(5, '0')}</span>
                   </div>
                   <div className="text-sm">
                       <span className="font-semibold text-orange-800 w-16 inline-block">Date:</span> 
                       <span className="font-mono text-slate-700">{dayjs(record.paid_date).format("DD/MM/YYYY")}</span>
                   </div>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8 border-t border-b border-orange-200 py-6">
             <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">จ่ายให้ (Pay To)</h3>
                <div className="text-sm text-slate-700">
                    <p className="font-bold text-base text-slate-900 mb-1">{record.seller_name || "-"}</p>
                    <p className="text-slate-500">{record.seller_email || "-"}</p>
                </div>
            </div>
            <div>
                 <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">รายละเอียดรอบบิล</h3>
                 <div className="text-sm text-slate-700">
                    <p className="font-medium text-slate-900 mb-1">
                       วันที่ {dayjs(record.period_start).format("DD/MM/YYYY")} ถึง {dayjs(record.period_end).format("DD/MM/YYYY")}
                    </p>
                    <p className="text-slate-500">จำนวน {record.invoice_count} บิล</p>
                 </div>
            </div>
          </div>

          {/* Table */}
          <div className="mb-8 overflow-hidden rounded-lg border border-orange-200">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-orange-500 text-white">
                        <th className="p-3 text-center font-semibold border-r border-orange-400 w-12">#</th>
                        <th className="p-3 text-left font-semibold">วันที่ออกบิล</th>
                        <th className="p-3 text-left font-semibold">เลขที่บิล</th>
                        <th className="p-3 text-right font-semibold">ยอดขายรวม</th>
                        <th className="p-3 text-right font-semibold">ค่าคอมเดิม</th>
                        <th className="p-3 text-right font-semibold">ค่าคอมที่จ่ายจริง</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                    {details.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-orange-50/30'}>
                            <td className="p-3 text-center text-slate-400 border-r border-orange-100">{idx + 1}</td>
                            <td className="p-3 text-slate-700">{dayjs(item.issue_date).format("DD/MM/YYYY")}</td>
                            <td className="p-3 text-slate-700 font-medium">{item.invoice_no}</td>
                            <td className="p-3 text-right text-slate-700">{Number(item.invoice_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right text-slate-700">{Number(item.original_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right text-slate-700 font-medium">{Number(item.paid_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex justify-end mb-12">
             <div className="w-80">
                 <div className="space-y-3 text-sm">
                     <div className="flex justify-between items-center text-slate-600">
                         <span>ช่องทางการจ่าย</span>
                         <span className="font-medium text-slate-900 border px-2 py-1 rounded bg-slate-50">{record.finance_account_name}</span>
                     </div>
                     <div className="border-t border-orange-200 my-2 pt-2">
                        <div className="flex justify-between items-center bg-orange-500 text-white p-3 rounded-lg shadow-sm">
                            <span className="font-bold text-lg">ยอดเงินสุทธิ (Net Total)</span>
                            <span className="font-bold text-xl">฿{Number(record.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                     </div>
                 </div>
             </div>
          </div>

          {/* Signatures */}
          <div className="flex justify-between mt-24 px-12">
              <div className="text-center">
                  <div className="border-b border-slate-400 w-48 mb-2"></div>
                  <p className="text-sm font-semibold text-slate-700">ผู้รับเงิน (Receiver)</p>
                  <p className="text-xs text-slate-500 mt-1">วันที่ _______/_______/_______</p>
              </div>
              <div className="text-center">
                  <div className="border-b border-slate-400 w-48 mb-2"></div>
                  <p className="text-sm font-semibold text-slate-700">ผู้อนุมัติจ่าย (Payer)</p>
                  <p className="text-xs text-slate-500 mt-1">วันที่ _______/_______/_______</p>
              </div>
          </div>
          
        </div>
      </div>
    </>
  );
};
