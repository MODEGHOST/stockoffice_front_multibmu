
import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import api from "../../lib/api";


interface PrintLayoutProps {
  title: string;
  docNo: string;
  date: string;
  vendor: {
    name: string;
    address?: string;
    taxId?: string;
    phone?: string;
    contact?: string;
  };
  warehouse?: {
    name: string;
    address?: string;
  };
  items: any[];
  columns: any[];
  summary: {
    totalQty: number;
    subtotal: number;
    discount: number;
    net: number;
    vat: number;
    grandTotal: number;
    extra?: number;
    headerDiscount?: number;
  };
  note?: string;
  signatures?: { title: string; name?: string; date?: string }[];
  
  // Custom labels for Left/Right columns
  leftLabel?: string; 
  rightLabel?: string;
}

export const PrintLayout = React.forwardRef<HTMLDivElement, PrintLayoutProps>(
  (props, ref) => {
    const { 
      title, docNo, date, vendor, warehouse, items, columns, summary, note, signatures,
      leftLabel = "Vendor (ผู้ขาย)", 
      rightLabel = "Ship To (จัดส่งที่)"
    } = props;

    const [company, setCompany] = useState<any>(null);
    useEffect(() => {
      api.get("/company/settings").then(res => setCompany(res.data)).catch(() => {});
    }, []);

    const compName = company?.name || "บริษัท บิลด์มีอัพ คอนซัลแทนท์ จำกัด";
    const compAddress = company 
      ? [company.address, company.sub_district && `ต.${company.sub_district}`, company.district && `อ.${company.district}`, company.province && `จ.${company.province}`, company.zip_code].filter(Boolean).join(" ")
      : "212/249-250 หมู่บ้านคุณาลัย คอร์ทยาร์ด ถนนบ้านกล้วย-ไทรน้อย ตำบลพิมลราช อำเภอบางบัวทอง นนทบุรี 11110";
    const compPhone = company?.phone || "02-123-4567";
    const compTaxId = company?.tax_id || "1234567890123";

    return (
      <div ref={ref} className="bg-white text-slate-800 print-container font-sans" style={{ minHeight: "297mm", width: "210mm", margin: "0 auto", padding: "40px" }}>
        
        {/* Top Decorative Bar */}
        <div className="h-2 w-full bg-orange-500 mb-8 rounded-full"></div>

        {/* Header */}
        <div className="flex justify-between items-start mb-8">
           <div className="flex-1">
               <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">{compName}</h1>
               <div className="text-sm text-slate-500 leading-relaxed">
                  <p>{compAddress}</p>
                  <p>Tel: {compPhone}</p>
                  <p>Tax ID: {compTaxId}</p>
               </div>
           </div>
           <div className="text-right">
               <h2 className="text-2xl font-bold text-orange-600 mb-2 uppercase tracking-wide">{title}</h2>
               <div className="inline-block text-left bg-orange-50 rounded-lg p-3 border border-orange-100">
                   <div className="text-sm mb-1">
                       <span className="font-semibold text-orange-800 w-16 inline-block">No:</span> 
                       <span className="font-mono text-slate-700">{docNo}</span>
                   </div>
                   <div className="text-sm">
                       <span className="font-semibold text-orange-800 w-16 inline-block">Date:</span> 
                       <span className="font-mono text-slate-700">{dayjs(date).format("DD/MM/YYYY")}</span>
                   </div>
               </div>
           </div>
        </div>

        {/* Vendor & Warehouse Info (Simple) */}
        <div className="grid grid-cols-2 gap-8 mb-8 border-t border-b border-orange-200 py-6">
             <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">{leftLabel}</h3>
                <div className="text-sm text-slate-700">
                    <p className="font-bold text-base text-slate-900 mb-1">{vendor.name}</p>
                    {vendor.address && <p className="mb-1">{vendor.address}</p>}
                    <div className="flex flex-wrap gap-x-4 text-xs text-slate-500 mt-2">
                        {vendor.taxId && <span>Tax ID: {vendor.taxId}</span>}
                        {vendor.phone && <span>Tel: {vendor.phone}</span>}
                    </div>
                </div>
            </div>
            <div>
                 <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">{rightLabel}</h3>
                 <div className="text-sm text-slate-700">
                    <p className="font-bold text-base text-slate-900 mb-1">{warehouse?.name || "Main Warehouse"}</p>
                    {warehouse?.address && <p>{warehouse.address}</p>}
                 </div>
            </div>
        </div>

        {/* Items Table */}
        <div className="mb-8 overflow-hidden rounded-lg border border-orange-200">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-orange-500 text-white">
                        <th className="p-3 text-center font-semibold w-12 border-r border-orange-400">#</th>
                        {columns.map((c, idx) => (
                            <th key={idx} className={`p-3 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`} style={{ width: c.width }}>
                                {c.title}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                    {items.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-orange-50/30'}>
                            <td className="p-3 text-center text-slate-400 border-r border-orange-100">{idx + 1}</td>
                            {columns.map((c, cIdx) => (
                                <td key={cIdx} className={`p-3 text-slate-700 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                                    {c.render ? c.render(item[c.dataIndex], item) : item[c.dataIndex]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* Summary & Note */}
        <div className="flex gap-8 mb-12">
             <div className="flex-1">
                {note && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-full">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Note</h4>
                        <p className="text-sm text-slate-600 italic">{note}</p>
                    </div>
                )}
             </div>
             <div className="w-80">
                 <div className="space-y-3 text-sm">
                     <div className="flex justify-between text-slate-600">
                         <span>Subtotal</span>
                         <span className="font-medium">{summary.subtotal.toLocaleString()}</span>
                     </div>
                     {summary.discount > 0 && (
                         <div className="flex justify-between text-red-500">
                             <span>Discount</span>
                             <span>-{summary.discount.toLocaleString()}</span>
                         </div>
                     )}
                     {summary.extra && summary.extra > 0 && (
                         <div className="flex justify-between text-slate-600">
                             <span>Extra Charge</span>
                             <span>{summary.extra.toLocaleString()}</span>
                         </div>
                     )}
                     {summary.headerDiscount && summary.headerDiscount > 0 && (
                         <div className="flex justify-between text-red-500">
                             <span>Bill Discount</span>
                             <span>-{summary.headerDiscount.toLocaleString()}</span>
                         </div>
                     )}
                     <div className="flex justify-between text-slate-600">
                         <span>VAT 7%</span>
                         <span>{summary.vat.toLocaleString()}</span>
                     </div>
                     
                     <div className="border-t border-orange-200 my-2 pt-2">
                        <div className="flex justify-between items-center bg-orange-500 text-white p-3 rounded-lg shadow-sm">
                            <span className="font-bold text-lg">Grand Total</span>
                            <span className="font-bold text-xl">{summary.grandTotal.toLocaleString()}</span>
                        </div>
                     </div>
                 </div>
             </div>
        </div>


        {/* Signatures */}
        {signatures && signatures.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-200 break-inside-avoid">
                {signatures.map((sig, idx) => (
                    <div key={idx} className="text-center">
                        <div className="border-b border-slate-400 w-32 mx-auto mb-2 mt-8"></div>
                        <p className="text-sm font-semibold text-slate-700">{sig.title}</p>
                        {sig.name && <p className="text-xs text-slate-500 mt-1">{sig.name}</p>}
                        {sig.date && <p className="text-xs text-slate-400 mt-1">{sig.date}</p>}
                    </div>
                ))}
            </div>
        )}

      </div>
    );
  }
);

PrintLayout.displayName = "PrintLayout";
