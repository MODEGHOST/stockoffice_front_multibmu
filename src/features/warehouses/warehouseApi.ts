import api from "../../lib/api";

export type WarehouseRow = {
  id: number;
  company_id: number;
  code: string;
  name: string;
  location: string | null;
  province: string | null;
  district: string | null;
  sub_district: string | null;
  zip_code: string | null;
  description: string | null;
  is_active: number;
  created_at?: string;
  updated_at?: string;
};

export type WarehouseUpsert = {
  code: string;
  name: string;
  location?: string | null;
  province?: string | null;
  district?: string | null;
  sub_district?: string | null;
  zip_code?: string | null;
  description?: string | null;
  is_active?: number;
};

export type StockSummaryRow = {
  company_id: number;
  warehouse_id: number;
  warehouse_code: string;
  warehouse_name: string;
  product_id: number;
  product_code: string;
  product_name: string;
  qty: number;
  updated_at?: string;
};

export type LotRow = {
  id: number;
  company_id?: number;
  product_id: number;
  warehouse_id: number;
  received_date: string;
  unit_cost: number;
  qty_in: number;
  qty_out: number;
  available?: number;
};

export async function listWarehouses(): Promise<WarehouseRow[]> {
  const { data } = await api.get("/warehouses");
  return Array.isArray(data) ? data : [];
}

export async function getWarehouse(id: number): Promise<WarehouseRow> {
  const { data } = await api.get(`/warehouses/${id}`);
  return data as WarehouseRow;
}

export async function createWarehouse(payload: WarehouseUpsert) {
  const { data } = await api.post("/warehouses", payload);
  return data;
}

export async function updateWarehouse(id: number, payload: WarehouseUpsert) {
  const { data } = await api.put(`/warehouses/${id}`, payload);
  return data;
}

export async function setWarehouseActive(id: number, is_active: number) {
  const { data } = await api.patch(`/warehouses/${id}/active`, { is_active });
  return data;
}

export async function stockSummary(): Promise<StockSummaryRow[]> {
  const { data } = await api.get("/stock/summary");
  return Array.isArray(data) ? data : [];
}

export async function fifoLots(product_id: number, warehouse_id: number): Promise<LotRow[]> {
  const { data } = await api.get("/stock/lots", { params: { product_id, warehouse_id } });
  return Array.isArray(data) ? (data as LotRow[]) : [];
}

export type FifoHistoryRow = {
  move_id: number;
  created_at: string;
  ref_type: string;
  ref_id: number | string;
  move_type: "IN" | "OUT";
  display_qty: number;
  note: string | null;
  warehouse_code: string | null;
  warehouse_name: string | null;

  move_value: number;
  balance_qty: number;
  balance_value: number;

  lot_details: Array<{
    qty: number;
    unit_cost: number;
  }>;
};

export async function getFifoHistory(
  product_id: number,
  type: "GLOBAL" | "WAREHOUSE",
  warehouse_id?: number
): Promise<FifoHistoryRow[]> {
  const { data } = await api.get("/stock/fifo-history", {
    params: { product_id, type, warehouse_id },
  });
  return Array.isArray(data) ? data : [];
}

import { useState, useEffect } from "react";

export function useWarehouses() {
  const [data, setData] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listWarehouses().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  return { data, loading };
}
