
import { Steps, Card } from "antd";
import { useEffect, useState } from "react";
import { 
  SolutionOutlined, 
  FileTextOutlined, 
  InboxOutlined 
} from "@ant-design/icons";
import dayjs from "dayjs";
import { 
  getPo, 
  getBill, 
  getGrn, 
  listBill, 
  listGrn, 
} from "./purchaseApi";
import { useNavigate } from "react-router-dom";

type DocType = "PO" | "BILL" | "GRN";

interface Props {
  currentId: number;
  currentType: DocType;
}

type StepStatus = "wait" | "process" | "finish" | "error";

interface StepItem {
  title: string;
  status: StepStatus;
  description: React.ReactNode;
  icon?: React.ReactNode;
}

export default function DocumentStepTracker({ currentId, currentType }: Props) {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<StepItem[]>([]);

  useEffect(() => {
    if (!currentId) return;
    loadChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, currentType]);

  async function loadChain() {
    try {
      setLoading(true);
      
      let poData: any = null;
      let billData: any = null;
      let grnData: any = null;

      // 1. Fetch current document to find links
      if (currentType === "PO") {
        const po = await getPo(currentId);
        poData = po.header;
        
        // Search forward for Bill
        if (poData && poData.po_no) {
           try {
             // Try to find bills linked to this PO
             const bRes = await listBill({ q: poData.po_no });
             if (bRes.rows && bRes.rows.length > 0) {
                // Find the one that actually matches po_id
                // Since listBill row might not have po_id, we might need to check details or trust search if unique enough.
                // Better approach: fetch detail of first few candidates
                for (const row of bRes.rows) {
                    const d = await getBill(row.id);
                    if (Number(d.header.po_id) === Number(currentId)) {
                        billData = d.header;
                        break;
                    }
                }
             }
           } catch {}

           try {
             // Try to find GRNs linked to this PO
             // GRN list row has po_id (usually), let's check.
             // If not in type, we fetch detail.
             const gRes = await listGrn({ q: poData.po_no });
             if (gRes.rows && gRes.rows.length > 0) {
                 for (const row of gRes.rows) {
                     // Check if row has po_id, or fetch detail
                     // GrnListRow in purchaseApi has po_id? Yes based on my memory of previous view_file.
                     if ((row as any).po_id === Number(currentId)) {
                        grnData = row; // Use row data for status
                        break;
                     }
                     // Fallback check detail
                     const d = await getGrn(row.id);
                     if (Number(d.header.po_id) === Number(currentId)) {
                        grnData = d.header;
                        break;
                     }
                 }
             }
           } catch (err) {
              console.log("Error searching forward GRN:", err);
           }
        }

      } else if (currentType === "BILL") {
        const bill = await getBill(currentId);
        billData = bill.header;
        if (billData.po_id) {
          try {
             const po = await getPo(billData.po_id);
             poData = po.header;
             
             // Search forward for GRN using PO or Bill No
             if (!grnData) {
                 // Try by Bill ID in GRN if possible (not standard search param), or use PO No
                 try {
                    const gRes = await listGrn({ q: billData.bill_no });
                    if (gRes.rows) {
                       for (const row of gRes.rows) {
                           if ((row as any).bill_id === Number(currentId)) {
                               grnData = row;
                               break;
                           }
                           const d = await getGrn(row.id);
                           if (Number(d.header.bill_id) === Number(currentId)) {
                               grnData = d.header;
                               break;
                           }
                       }
                    }
                 } catch {}
             }

          } catch {}
        }
      } else if (currentType === "GRN") {
        const grn = await getGrn(currentId);
        grnData = grn.header;
        
        if (grnData.bill_id) {
           try {
             const bill = await getBill(grnData.bill_id);
             billData = bill.header;
             if (billData.po_id) {
                const po = await getPo(billData.po_id);
                poData = po.header;
             }
           } catch {}
        } else if (grnData.po_id) {
           // Direct PO -> GRN
           try {
              const po = await getPo(grnData.po_id);
              poData = po.header;
           } catch {}
        }
      }

      // 2. Construct Steps
      const items: StepItem[] = [];

      // --- Step 1: PO ---
      if (poData) {
        const isCurrent = currentType === "PO" && Number(poData.id) === Number(currentId);
        const st = normalizeStatus(poData.status);
        items.push({
          title: `PO: ${poData.po_no}`,
          status: st === "error" ? "error" : "finish",
          icon: <SolutionOutlined />,
          description: (
            <div className="text-xs mt-1">
              <div>{formatDate(poData.issue_date)}</div>
              <div className={`font-semibold ${st === "error" ? "text-red-500" : "text-green-600"}`}>
                {poData.status}
              </div>
              {poData.id && !isCurrent && (
                 <a className="text-blue-500 underline cursor-pointer" onClick={() => nav(`/purchase/po/${poData.id}`)}>
                   ดูเอกสาร
                 </a>
              )}
            </div>
          ),
        });
      } else {
         // Placeholder if missing? Or just skip? 
         if (currentType !== "PO") {
            // If we have Bill but no PO, maybe it's standalone Bill.
            // We can check if Bill has po_id. If 0/null, then no PO step.
         }
      }

      // --- Step 2: Bill ---
      if (billData) {
        const isCurrent = currentType === "BILL" && Number(billData.id) === Number(currentId);
        const st = normalizeStatus(billData.status);
        items.push({
          title: `Bill: ${billData.bill_no}`,
          status: st === "error" ? "error" : "finish",
          icon: <FileTextOutlined />,
          description: (
            <div className="text-xs mt-1">
              <div>{formatDate(billData.issue_date)}</div>
              <div className={`font-semibold ${st === "error" ? "text-red-500" : "text-green-600"}`}>
                 {billData.status}
              </div>
               {billData.id && !isCurrent && (
                 <a className="text-blue-500 underline cursor-pointer" onClick={() => nav(`/purchase/bill/${billData.id}`)}>
                   ดูเอกสาร
                 </a>
              )}
            </div>
          ),
        });
      } else if (poData) {
         // Valid PO, but no Bill yet known in this context
         // If we are at PO view, we don't know future bill.
         if (currentType === "PO") {
             items.push({
                 title: "Bill",
                 status: "wait",
                 icon: <FileTextOutlined />,
                 description: <span className="text-xs text-gray-400">รอสร้าง</span>
             });
         }
      }

      // --- Step 3: GRN ---
      if (grnData) {
        const isCurrent = currentType === "GRN" && Number(grnData.id) === Number(currentId);
        const st = normalizeStatus(grnData.status);
         items.push({
          title: `GRN: ${grnData.grn_no}`,
          status: st === "error" ? "error" : (st === "finish" ? "finish" : "process"),
          icon: <InboxOutlined />,
          description: (
            <div className="text-xs mt-1">
              <div>{formatDate(grnData.issue_date)}</div>
              <div className={`font-semibold ${st === "error" ? "text-red-500" : (st === "finish" ? "text-green-600" : "text-blue-500")}`}>
                 {grnData.status}
              </div>
              {grnData.id && !isCurrent && (
                 <a className="text-blue-500 underline cursor-pointer" onClick={() => nav(`/purchase/grn/${grnData.id}`)}>
                   ดูเอกสาร
                 </a>
              )}
            </div>
          ),
        });
      } else {
         if (currentType === "BILL" || currentType === "PO") {
             items.push({
                 title: "GRN",
                 status: "wait",
                 icon: <InboxOutlined />,
                 description: <span className="text-xs text-gray-400">รอรับของ</span>
             });
         }
      }

      setSteps(items);

    } catch (e) {
      // console.error(e);
      // message.error("โหลด Timeline ไม่สำเร็จ"); 
    } finally {
      setLoading(false);
    }
  }

  function normalizeStatus(s: string): StepStatus {
    if (s === "APPROVED") return "finish";
    if (s === "CANCELLED") return "error";
    return "process"; // DRAFT
  }

  function formatDate(d: string) {
    if (!d) return "";
    return dayjs(d).format("DD/MM/YYYY");
  }

  if (loading) return <Card loading />;
  if (steps.length === 0) return null;

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
