import api from "../../lib/api";

export type ProductRow = {
  id: number;
  company_id: number;
  code: string;
  name: string;
  unit: string | null;
  sell_price: number;
  is_active: number;
  is_vat: number; // ✅ NEW
  created_at?: string;
  updated_at?: string;
};

export type ProductUpsert = {
  code?: string; // ✅ optional (auto gen)
  name: string;
  unit?: string | null;
  sell_price?: number;
  is_active?: number;
  is_vat?: number; // ✅ NEW
};

export async function listProducts(): Promise<ProductRow[]> {
  const { data } = await api.get("/products");
  return Array.isArray(data) ? data : [];
}

export async function createProduct(payload: ProductUpsert) {
  const { data } = await api.post("/products", payload);
  return data;
}

export async function updateProduct(id: number, payload: ProductUpsert) {
  const { data } = await api.put(`/products/${id}`, payload);
  return data;
}

export async function setProductActive(id: number, is_active: number) {
  const { data } = await api.patch(`/products/${id}/active`, { is_active });
  return data;
}

export async function searchProducts(q: string): Promise<ProductRow[]> {
  const { data } = await api.get("/products", { params: { q } });
  return Array.isArray(data) ? (data as ProductRow[]) : []; // adapt if backend returns { rows: ... }
}
