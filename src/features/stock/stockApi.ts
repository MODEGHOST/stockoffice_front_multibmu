import api from "../../lib/api";

export interface AdjustmentListRow {
  id: number;
  doc_no: string;
  issue_date: string;
  warehouse_name: string;
  reason: string;
  status: "DRAFT" | "APPROVED" | "CANCELLED";
  created_by_name: string;
}

export interface AdjustmentItem {
  id: number;
  product_id: number;
  code: string;
  name: string;
  unit: string;
  direction: "IN" | "OUT";
  qty: number;
  unit_cost: number | null;
  note: string;
}

export interface AdjustmentDetail {
  header: {
    id: number;
    doc_no: string;
    warehouse_id: number;
    status: "DRAFT" | "APPROVED" | "CANCELLED";
    reason: string;
    created_at: string;
    created_by: number;
    approved_at?: string;
    cancelled_at?: string;
    cancel_reason?: string;
  };
  items: AdjustmentItem[];
}

export async function listAdjustments(status?: string): Promise<AdjustmentListRow[]> {
  const params: any = {};
  if (status) params.status = status;
  const { data } = await api.get("/adjustments", { params });
  return Array.isArray(data) ? data : [];
}

export async function getAdjustment(id: number): Promise<AdjustmentDetail> {
  const { data } = await api.get(`/adjustments/${id}`);
  return data;
}

export async function createAdjustment(payload: any) {
  const { data } = await api.post("/adjustments", payload);
  return data;
}

export async function approveAdjustment(id: number) {
  const { data } = await api.post(`/adjustments/${id}/approve`);
  return data;
}

export async function cancelAdjustment(id: number, reason: string) {
  const { data } = await api.post(`/adjustments/${id}/cancel`, { reason });
  return data;
}

export async function getStockCheck(product_id: number, warehouse_id: number): Promise<{ qty: number }> {
  const { data } = await api.get(`/stock/check`, { params: { product_id, warehouse_id } });
  return data;
}
