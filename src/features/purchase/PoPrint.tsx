
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { PrintLayout } from "./PrintLayout";
import type { PoDetail } from "./purchaseApi";
import { calculateSummary, calcLine } from "./purchaseUtils";

interface PoPrintProps {
  data: PoDetail;
}

export function PoPrint({ data }: PoPrintProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  if (!data) return null;

  const { header, items } = data;

  const summary = calculateSummary(items, header);

  const columns = [
      { title: "Item Code", dataIndex: "code", width: "15%" },
      { title: "Description", dataIndex: "name", width: "35%" },
      { title: "Qty", dataIndex: "qty", align: "right", width: "10%", render: (v: number) => v.toLocaleString() },
      { title: "Unit Price", dataIndex: "unit_cost", align: "right", width: "15%", render: (v: number) => v.toLocaleString() },
      { title: "Discount", dataIndex: "discount", align: "right", width: "10%", render: (_: any, r: any) => {
         const line = calcLine(r);
         return line.discount > 0 ? line.discount.toLocaleString() : "-";
      }},
      { title: "Total", dataIndex: "total", align: "right", width: "15%", render: (_: any, r: any) => {
          const line = calcLine(r);
          return line.beforeTax.toLocaleString(); // show beforeTax amount usually for PO lines? Or Net?
          // In PoDetail, it shows "total" which is after tax if INCLUDE_VAT, or before tax + vat if EXCLUDE.
          // But usually Print columns show "Amount" which is Qty*Price - Discount.
          // Let's use `afterDiscount` to be safe and standard (Net Amount). 
          // If we want "Total including VAT", we use line.total. 
          // Looking at PoDetail logic row 541: <Input value={r.total.toLocaleString()} ... />
          // So let's match the UI, which uses `total`.
          return line.total.toLocaleString();
      }}
  ];

  return (
    <>
      <div style={{ display: "none" }}>
        <PrintLayout
          ref={componentRef}
          title="PURCHASE ORDER (ใบสั่งซื้อ)"
          docNo={header.po_no}
          date={header.issue_date}
          vendor={{
            name: header.vendor_name || "",
            // address: ... (if available in header or need fetch)
            contact: header.vendor_contact_name || "-",
            phone: header.vendor_contact_phone || undefined
          }}
          warehouse={{
              name: header.warehouse_name || ""
          }}
          items={items}
          columns={columns}
          summary={{
              totalQty: summary.totalQty,
              subtotal: summary.base, // Base amount before discount
              discount: summary.discount, // Total discount
              net: summary.net, // Net before VAT
              vat: summary.vat,
              grandTotal: summary.grandTotal,
              extra: summary.extra,
              headerDiscount: summary.headerDiscount
          }}
          note={header.note || ""}
          signatures={[
              { title: "Prepared By", name: "Purchaser" },
              { title: "Authorized By", name: "Manager" }
          ]}
        />
      </div>
      <Button icon={<PrinterOutlined />} onClick={() => handlePrint && handlePrint()}>
        Print PO
      </Button>
    </>
  );
}
