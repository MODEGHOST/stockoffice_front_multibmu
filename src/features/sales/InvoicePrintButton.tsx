import { useRef, useState } from "react";
import { Button, Modal, Radio, Tag } from "antd";
import { PrinterOutlined, FileTextOutlined } from "@ant-design/icons";
import { useReactToPrint } from "react-to-print";
import { PrintLayout } from "../purchase/PrintLayout";

interface InvoicePrintButtonProps {
  header: any;
  items: any[];
}

export function InvoicePrintButton({ header, items }: InvoicePrintButtonProps) {
  const componentRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  if (!header) return null;

  // Function to get title, doc_no, issue_date based on type
  const getDocInfo = (docType: string) => {
    let docTitle = "ใบเสนอราคา (QUOTATION)";
    let docNo = header.quotation_no;
    let docDate = header.quotation_date;

    if (docType === "IV") {
      docTitle = "ใบแจ้งหนี้ / ใบส่งของ (INVOICE / DELIVERY ORDER)";
      docNo = header.invoice_no || "-";
      docDate = header.issue_date;
    } else if (docType === "DO") {
      docTitle = "ใบส่งของ (DELIVERY ORDER)";
      docNo = header.delivery_no || "-";
      docDate = header.delivery_date || header.issue_date;
    } else if (docType === "RE") {
      docTitle = "ใบเสร็จรับเงิน (RECEIPT)";
      docNo = header.receipt_no || "-";
      docDate = header.receipt_date || header.issue_date;
    } else if (docType === "TAX") {
      docTitle = "ใบกำกับภาษี (TAX INVOICE)";
      docNo = header.tax_invoice_no || header.invoice_no || "-";
      docDate = header.tax_invoice_date || header.issue_date;
    } else if (docType === "IV_TAX") {
      docTitle = "ใบแจ้งหนี้ / ใบกำกับภาษี (INVOICE / TAX INVOICE)";
      docNo = header.tax_invoice_no || header.invoice_no || "-";
      docDate = header.tax_invoice_date || header.issue_date;
    } else if (docType === "DO_TAX") {
      docTitle = "ใบส่งของ / ใบกำกับภาษี (DELIVERY ORDER / TAX INVOICE)";
      docNo = header.tax_invoice_no || header.invoice_no || "-";
      docDate = header.tax_invoice_date || header.issue_date;
    } else if (docType === "RE_TAX") {
      docTitle = "ใบเสร็จรับเงิน / ใบกำกับภาษี (RECEIPT / TAX INVOICE)";
      docNo = header.tax_invoice_no || header.invoice_no || "-";
      docDate = header.tax_invoice_date || header.issue_date;
    }
    return { docTitle, docNo, docDate };
  };

  // Columns for printing
  const columns = [
      { title: "Code", dataIndex: "code", width: "15%" },
      { title: "Description", dataIndex: "name", width: "35%" },
      { title: "Qty", dataIndex: "quantity", align: "right", width: "10%", render: (v: number) => Number(v).toLocaleString() },
      { title: "Unit Price", dataIndex: "price", align: "right", width: "15%", render: (v: number) => Number(v).toLocaleString(undefined, {minimumFractionDigits: 2}) },
      { title: "Discount", dataIndex: "discount_amount", align: "right", width: "10%", render: (v: number) => Number(v) > 0 ? Number(v).toLocaleString() : "-" },
      { title: "Total", dataIndex: "total", align: "right", width: "15%", render: (v: number) => Number(v).toLocaleString(undefined, {minimumFractionDigits: 2}) }
  ];

  const printPresets = [
    {
      label: "ฉบับเดียว: ใบเสนอราคา",
      docs: ["QT"],
      disabled: false,
      desc: "พิมพ์เฉพาะใบเสนอราคา 1 ใบ"
    },
    {
      label: "ฉบับเดียว: ใบแจ้งหนี้",
      docs: ["IV"],
      disabled: !header?.invoice_no,
      desc: "พิมพ์เฉพาะใบแจ้งหนี้ 1 ใบ"
    },
    {
      label: "ฉบับเดียว: ใบส่งของ",
      docs: ["DO"],
      disabled: !header?.delivery_no,
      desc: "พิมพ์เฉพาะใบส่งของ 1 ใบ"
    },
    {
      label: "ฉบับเดียว: ใบเสร็จรับเงิน",
      docs: ["RE"],
      disabled: !header?.receipt_no,
      desc: "พิมพ์เฉพาะใบเสร็จรับเงิน 1 ใบ"
    },
    {
      label: "ฉบับเดียว: ใบกำกับภาษี",
      docs: ["TAX"],
      disabled: !header?.tax_invoice_no,
      desc: "พิมพ์เฉพาะใบกำกับภาษี 1 ใบ"
    },
    {
      label: "เอกสารชุด: ใบแจ้งหนี้ / ใบกำกับภาษี",
      docs: ["IV_TAX"],
      disabled: !header?.invoice_no || !header?.tax_invoice_no,
      desc: "พิมพ์รวมกันในหน้าเดียว (มี 2 ชื่อใน 1 ใบ)"
    },
    {
      label: "เอกสารชุด: ใบส่งของ / ใบกำกับภาษี",
      docs: ["DO_TAX"],
      disabled: !header?.delivery_no || !header?.tax_invoice_no,
      desc: "พิมพ์รวมกันในหน้าเดียว (มี 2 ชื่อใน 1 ใบ)"
    },
    {
      label: "เอกสารชุด: ใบเสร็จรับเงิน / ใบกำกับภาษี",
      docs: ["RE_TAX"],
      disabled: !header?.receipt_no || !header?.tax_invoice_no,
      desc: "พิมพ์รวมกันในหน้าเดียว (มี 2 ชื่อใน 1 ใบ)"
    }
  ];

  // Convert selected string back to docs array or handle selection internally
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(-1);

  const handlePrintOk = () => {
    if (selectedPresetIndex === -1) return;
    const docsToPrint = printPresets[selectedPresetIndex].docs;
    setSelectedDocs(docsToPrint);
    
    // Auto trigger print after rendering the new selected docs
    setTimeout(() => {
      setIsModalOpen(false);
      setTimeout(() => {
        handlePrint && handlePrint();
      }, 100);
    }, 0);
  };

  const handleOpenModal = () => {
    setSelectedPresetIndex(-1);
    setIsModalOpen(true);
  };

  return (
    <>
      <div style={{ display: "none" }}>
        <div ref={componentRef}>
          {selectedDocs.map((docType, index) => {
            const { docTitle, docNo, docDate } = getDocInfo(docType);
            return (
              <div key={docType} style={{ pageBreakAfter: index < selectedDocs.length - 1 ? "always" : "auto" }}>
                <PrintLayout
                  title={docTitle}
                  docNo={docNo}
                  date={docDate}
                  leftLabel="Customer (ลูกค้า)"
                  vendor={{
                    name: header.customer_name || "เงินสด / ทั่วไป",
                    address: header.customer_address,
                    taxId: header.customer_tax_id,
                    phone: header.customer_phone
                  }}
                  rightLabel="" // Hide right label
                  warehouse={{ name: "-" }} // Hide/Empty right content
                  
                  items={items}
                  columns={columns}
                  summary={{
                      totalQty: items.reduce((sum, it) => sum + Number(it.quantity), 0),
                      subtotal: header.subtotal,
                      discount: 0,
                      net: 0,
                      vat: header.tax,
                      grandTotal: header.total,
                      headerDiscount: 0,
                      extra: 0
                  }}
                  note={header.note || ""}
                  signatures={[
                      { title: "ผู้รับวางบิล / ผู้รับของ (Receiver)" },
                      { title: "ผู้ขาย / ผู้อนุมัติ (Authorized Signature)" }
                  ]}
                />
              </div>
            );
          })}
        </div>
      </div>

      <Button icon={<PrinterOutlined />} onClick={handleOpenModal}>
         พิมพ์เอกสาร (Print)
      </Button>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <PrinterOutlined className="text-blue-500" />
            <span>เลือกชุดเอกสารที่ต้องการพิมพ์ (แยกใบ)</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handlePrintOk}
        okText="สั่งพิมพ์"
        cancelText="ยกเลิก"
        centered
        width={1000}
        okButtonProps={{ disabled: selectedPresetIndex === -1 }}
      >
        <div className="py-2">
          <Radio.Group 
            className="w-full grid grid-cols-1 md:grid-cols-4 gap-4"
            value={selectedPresetIndex} 
            onChange={(e) => setSelectedPresetIndex(e.target.value)} 
          >
            {printPresets.map((preset, idx) => (
              <Radio 
                key={idx} 
                value={idx} 
                disabled={preset.disabled}
                className={`w-full h-full border rounded-lg p-3 m-0 flex items-start hover:bg-slate-50 transition-colors ${
                  preset.disabled ? "opacity-50 bg-gray-50" : ""
                } ${selectedPresetIndex === idx ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
              >
                <div className="flex flex-col ml-1 w-full">
                   <div className="font-semibold text-sm leading-tight break-words pr-2">
                      {preset.label}
                   </div>
                   {preset.disabled && (
                     <div className="mt-1">
                        <Tag color="default" className="font-normal text-[10px] m-0">ข้อมูลเอกสารไม่ครบ</Tag>
                     </div>
                   )}
                   <div className="text-xs text-gray-500 mt-2 flex items-start gap-1 leading-snug">
                      <FileTextOutlined className="mt-0.5 shrink-0" /> <span className="break-words">{preset.desc}</span>
                   </div>
                </div>
              </Radio>
            ))}
          </Radio.Group>
        </div>
      </Modal>
    </>
  );
}
