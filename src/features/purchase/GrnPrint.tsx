
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { PrintLayout } from "./PrintLayout";
import type { GrnDetail } from "./purchaseApi";
import { calculateSummary } from "./purchaseUtils";

interface GrnPrintProps {
  data: GrnDetail;
}

export function GrnPrint({ data }: GrnPrintProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  if (!data) return null;

  const { header, items } = data;

  const summary = calculateSummary(items, header);

  const columns = [
      { title: "Item Code", dataIndex: "code", width: "20%" },
      { title: "Description", dataIndex: "name", width: "50%" },
      { title: "Qty", dataIndex: "qty", align: "right", width: "15%", render: (v: number) => v.toLocaleString() },
      { title: "Unit Cost", dataIndex: "unit_cost", align: "right", width: "15%", render: (v: number) => v.toLocaleString() },
  ];

  return (
    <>
      <div style={{ display: "none" }}>
        <PrintLayout
          ref={componentRef}
          title="GOODS RECEIPT NOTE (ใบรับสินค้า)"
          docNo={header.grn_no}
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
              { title: "Received By", name: header.creator_name || "Store Keeper" },
              { title: "Inspect By", name: "Inspector" }
          ]}
        />
      </div>
      <Button icon={<PrinterOutlined />} onClick={() => handlePrint && handlePrint()}>
        Print GRN
      </Button>
    </>
  );
}
