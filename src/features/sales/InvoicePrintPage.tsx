
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../../lib/api";
import { Button, Spin } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useReactToPrint } from "react-to-print";
import { PrintLayout } from "../purchase/PrintLayout";
import dayjs from "dayjs";

type Header = {
  id: number;
  quotation_no: string;
  quotation_date: string;
  invoice_no: string | null;
  receipt_no: string | null;
  receipt_date: string | null;
  delivery_no: string | null;
  delivery_date: string | null;
  tax_invoice_no: string | null;
  tax_invoice_date: string | null;
  
  issue_date: string;
  valid_until: string | null;
  
  subtotal: number;
  tax: number;
  total: number;
  withholding_total: number;
  net_after_withholding: number;
  
  customer_name?: string;
  customer_address?: string;
  customer_tax_id?: string;
  customer_contact_name?: string;
  customer_phone?: string;
  creator_name?: string;
  seller_name?: string;
  
  note: string | null;
};

type Item = {
  id: number;
  code?: string;
  name: string;
  quantity: number;
  price: number;
  discount_amount: number;
  total: number;
  vat_amount: number;
  amount_before_vat: number;
};

export default function InvoicePrintPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const docType = searchParams.get("docType") || "QT"; // QT, IV, DO, RE, TAX
  
  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<Header | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    try {
      const { data } = await api.get(`/sales/invoice/${id}`);
      setHeader(data?.header);
      setItems(data?.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="flex justify-center p-10"><Spin size="large" /></div>;
  if (!header) return <div className="p-10 text-red-500">Document not found</div>;

  // Resolve Doc Title & No
  let docTitle = "ใบเสนอราคา (QUOTATION)";
  let docNo = header.quotation_no;
  let docDate = header.quotation_date;

  if (docType === "IV") {
    if (header.tax_invoice_no) {
       docTitle = "ใบแจ้งหนี้ / ใบกำกับภาษี (INVOICE / TAX INVOICE)";
       // Show both numbers if different, but usually we just show TAX no or both.
       docNo = `${header.invoice_no || "-"} / ${header.tax_invoice_no}`;
    } else {
       docTitle = "ใบแจ้งหนี้ / ใบส่งของ (INVOICE / DELIVERY ORDER)";
       docNo = header.invoice_no || "-";
    }
    docDate = header.issue_date;
  } else if (docType === "DO") {
    if (header.tax_invoice_no) {
       docTitle = "ใบส่งของ / ใบแจ้งหนี้ / ใบกำกับภาษี (DELIVERY ORDER / TAX INVOICE)";
       docNo = `${header.delivery_no || "-"} / ${header.tax_invoice_no}`;
    } else {
       docTitle = "ใบส่งของ (DELIVERY ORDER)";
       docNo = header.delivery_no || "-";
    }
    docDate = header.delivery_date || header.issue_date;
  } else if (docType === "RE") {
    if (header.tax_invoice_no) {
       docTitle = "ใบเสร็จรับเงิน / ใบกำกับภาษี (RECEIPT / TAX INVOICE)";
       docNo = `${header.receipt_no || "-"} / ${header.tax_invoice_no}`;
    } else {
       docTitle = "ใบเสร็จรับเงิน (RECEIPT)";
       docNo = header.receipt_no || "-";
    }
    docDate = header.receipt_date || header.issue_date;
  } else if (docType === "TAX") {
    docTitle = "ใบกำกับภาษี (TAX INVOICE)";
    docNo = header.tax_invoice_no || header.invoice_no || "-";
    docDate = header.tax_invoice_date || header.issue_date;
  }

  // Columns for Sales
  const columns = [
      { title: "Code", dataIndex: "code", width: "15%" },
      { title: "Description", dataIndex: "name", width: "35%" },
      { title: "Qty", dataIndex: "quantity", align: "right", width: "10%", render: (v: number) => v.toLocaleString() },
      { title: "Unit Price", dataIndex: "price", align: "right", width: "15%", render: (v: number) => v.toLocaleString(undefined, {minimumFractionDigits: 2}) },
      { title: "Discount", dataIndex: "discount_amount", align: "right", width: "10%", render: (v: number) => v > 0 ? v.toLocaleString() : "-" },
      { title: "Total", dataIndex: "total", align: "right", width: "15%", render: (v: number) => v.toLocaleString(undefined, {minimumFractionDigits: 2}) }
  ];

  // Map Header to Layout Props
  // Left Label = Customer
  // Right Label = Empty (or maybe Salesperson if available, but staying simple for now)
  
  return (
    <div>
      <div style={{ display: "none" }}>
        <PrintLayout
          ref={componentRef}
          title={docTitle}
          docNo={docNo}
          date={docDate}
          
          // Mapping Customer to "Vendor" prop slot, but labeled as Customer
          vendor={{
            name: header.customer_name || "เงินสด / ทั่วไป",
            address: header.customer_address,
            taxId: header.customer_tax_id,
            phone: header.customer_phone
          }}
          leftLabel="Customer (ลูกค้า)"
          
          // We can leave warehouse empty or use it for Delivery Address if needed
          // For now, let's just show "-" or hide it if logic implies
          // The component renders "Main Warehouse" if name check fails, let's provide a blank name to potentially hide or "-"
          warehouse={{
             name: "-"
          }}
          rightLabel="" // Hide label if empty
          
          items={items}
          columns={columns}
          
          summary={{
              totalQty: items.reduce((sum, it) => sum + Number(it.quantity), 0),
              subtotal: header.subtotal,
              discount: 0, // In this system, line discount is already deducted? Or header discount?
                           // Invoice header has specific fields? 
                           // Based on previous code: items have discount_amount.
                           // `subtotal` usually is after line discounts.
                           // `header.total` is final.
                           // Let's rely on header fields.
              net: 0, // Not used much in simple layout
              vat: header.tax,
              grandTotal: header.total,
              headerDiscount: 0, // If available
              extra: 0 // If available
          }}
          
          note={header.note || ""}
          signatures={[
              { title: "ผู้รับวางบิล / ผู้รับของ (Receiver)" },
              { title: "ผู้ขาย / ผู้อนุมัติ (Authorized Signature)", name: header.seller_name || header.creator_name || "" }
          ]}
        />
      </div>
      
       <div className="fixed bottom-8 right-8 print:hidden">
          <Button 
            type="primary"
            size="large"
            icon={<PrinterOutlined />} 
            onClick={() => handlePrint && handlePrint()}
            className="rounded-full shadow-lg"
          >
            Print
          </Button>
      </div>
    </div>
  );
}
