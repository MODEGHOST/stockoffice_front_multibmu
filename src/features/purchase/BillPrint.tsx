
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { PrintLayout } from "./PrintLayout";
import type { BillDetail } from "./purchaseApi";
import { calculateSummary, calcLine } from "./purchaseUtils";

interface BillPrintProps {
  data: BillDetail;
}

export function BillPrint({ data }: BillPrintProps) {
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
      { title: "Qty", dataIndex: "qty", align: "right", render: (v: number) => v.toLocaleString() },
      { title: "Unit Price", dataIndex: "unit_cost", align: "right", render: (v: number) => v.toLocaleString() },
      { title: "Total", dataIndex: "total", align: "right", render: (_: any, r: any) => {
          const line = calcLine(r);
          return line.total.toLocaleString();
      }}
  ];

  return (
    <>
      <div style={{ display: "none" }}>
        <PrintLayout
          ref={componentRef}
          title="RECEIVING BILL / INVOICE (ใบรับบิล)"
          docNo={header.bill_no}
          date={header.issue_date}
          vendor={{
            name: header.vendor_name || "",
          }}
          warehouse={{
              name: header.warehouse_name || ""
          }}
          items={items}
          columns={columns}
          summary={{
              totalQty: summary.totalQty,
              subtotal: summary.base,
              discount: summary.discount,
              net: summary.net,
              vat: summary.vat,
              grandTotal: summary.grandTotal,
              extra: summary.extra,
              headerDiscount: summary.headerDiscount
          }}
          note={header.note || ""}
          signatures={[
              { title: "Received By", name: "Store Keeper" },
              { title: "Approved By", name: "Manager" }
          ]}
        />
      </div>
      <Button icon={<PrinterOutlined />} onClick={() => handlePrint && handlePrint()}>
        Print Bill
      </Button>
    </>
  );
}
