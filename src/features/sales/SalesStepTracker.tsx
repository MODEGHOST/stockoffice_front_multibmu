import { Steps, Card } from "antd";
import { useEffect, useState } from "react";
import { 
  SolutionOutlined, 
  FileTextOutlined, 
  InboxOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

interface Props {
  header?: any; // The Sale Header object
}

type StepStatus = "wait" | "process" | "finish" | "error";

interface StepItem {
  title: string;
  status: StepStatus;
  description: React.ReactNode;
  icon?: React.ReactNode;
}

export default function SalesStepTracker({ header }: Props) {
  const [steps, setSteps] = useState<StepItem[]>([]);

  useEffect(() => {
    if (!header) return;
    
    const items: StepItem[] = [];

    const makeStep = (
      docNo: string | null | undefined,
      docDate: string | null | undefined,
      label: string,
      iconNode: React.ReactNode,
      isCancelled: boolean
    ) => {
      const hasDoc = !!docNo;
      const status = isCancelled && hasDoc ? "error" : (hasDoc ? "finish" : "wait");
      
      return {
        title: hasDoc ? `${label}: ${docNo}` : label,
        status: status as StepStatus,
        icon: iconNode,
        description: hasDoc ? (
          <div className="text-xs mt-1">
            {docDate && <div>{fmtDate(docDate)}</div>}
            <div className={`font-semibold ${isCancelled ? "text-red-500" : "text-green-600"}`}>
              {isCancelled ? "ยกเลิก" : "เสร็จสมบูรณ์"}
            </div>
          </div>
        ) : (
          <span className="text-xs text-gray-400">รอสร้างเอกสาร</span>
        )
      };
    };

    const isCancelled = header.status === "CANCELLED";

    // 1. Quotation (QT)
    items.push(makeStep(header.quotation_no, header.quotation_date, "ใบเสนอราคา (QT)", <SolutionOutlined />, isCancelled));

    // 2. Invoice (IV)
    items.push(makeStep(header.invoice_no, header.issue_date, "ใบแจ้งหนี้ (IV)", <FileTextOutlined />, isCancelled));

    // 3. Receipt (RE)
    items.push(makeStep(header.receipt_no, header.receipt_date, "ใบเสร็จรับเงิน (RE)", <InboxOutlined />, isCancelled));

    // 4. Delivery (DO)
    items.push(makeStep(header.delivery_no, header.delivery_date, "ใบส่งของ (DO)", <InboxOutlined />, isCancelled));

    // 5. Tax Invoice (TAX)
    items.push(makeStep(header.tax_invoice_no, header.tax_invoice_date, "ใบกำกับภาษี (TAX)", <FileTextOutlined />, isCancelled));

    setSteps(items);
  }, [header]);

  function fmtDate(d: string) {
    if (!d) return "";
    return dayjs(d).format("DD/MM/YYYY");
  }

  if (!header || steps.length === 0) return null;

  return (
    <Card className="mb-4 shadow-sm" bodyStyle={{ paddingTop: 24, paddingBottom: 12 }}>
      <Steps
        items={steps}
        labelPlacement="vertical"
        size="small"
      />
    </Card>
  );
}
