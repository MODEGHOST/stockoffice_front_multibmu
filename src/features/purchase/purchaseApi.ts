import api from "../../lib/api";

export type ProductRow = {
  id: number;
  code: string;
  name: string;
  unit: string | null;
  sell_price: number;
  is_active: number;
};

export type WarehouseRow = {
  id: number;
  code: string;
  name: string;
  location: string | null;
  description: string | null;
  is_active: number;
};

export type VendorRow = {
  id: number;
  code: string;
  name: string;
  type?: "VENDOR" | "CUSTOMER" | "BOTH" | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: number;
};

export type TaxType = "EXCLUDE_VAT_7" | "INCLUDE_VAT_7" | "NO_VAT";

export async function listProducts(): Promise<ProductRow[]> {
  const { data } = await api.get("/products");
  return Array.isArray(data) ? data : (data?.rows || []);
}

export async function listWarehouses(): Promise<WarehouseRow[]> {
  const { data } = await api.get("/warehouses");
  return Array.isArray(data) ? data : (data?.rows || []);
}

export async function listVendors(): Promise<VendorRow[]> {
  const { data } = await api.get("/vendors");
  return Array.isArray(data) ? data : (data?.rows || []);
}

export type VendorContactPerson = {
  prefix?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
};

export type VendorDetail = VendorRow & {
  contact_person?: VendorContactPerson;
  contact_people?: VendorContactPerson[];
};

export async function getVendor(id: number): Promise<VendorDetail> {
  const { data } = await api.get(`/vendors/${id}`);
  return data as VendorDetail;
}

export type GrnStatus = "DRAFT" | "APPROVED" | "CANCELLED";

export type GrnHeader = {
  id: number;
  company_id: number;
  grn_no: string;

  po_id?: number | null;
  bill_id?: number | null;

  vendor_id: number;
  warehouse_id: number;
  status: GrnStatus;
  issue_date: string;
  note: string | null;

  vendor_name?: string | null;
  warehouse_name?: string | null;

  created_by: number;
  approved_by?: number | null;
  approved_at?: string | null;

  cancelled_by?: number | null;
  cancelled_at?: string | null;
  cancel_stage?: "DRAFT" | "APPROVED" | null;
  cancel_reason?: string | null;

  created_at?: string;
  updated_at?: string;

  // Added for UI consistency with Bill (Backend might not persist yet)
  extra_charge_amt?: number | null;
  extra_charge_note?: string | null;
  header_discount_type?: "PERCENT" | "AMOUNT" | null;
  header_discount_value?: number | null;
};

export type GrnItem = {
  id: number;
  bill_item_id?: number | null;
  product_id: number;
  code: string;
  name: string;
  qty: number;
  unit_cost: number;
};

export type GrnDetail = {
  header: GrnHeader;
  items: GrnItem[];
};

export type CreateGrnPayload = {
  grn_no: string;
  po_id?: number | null;
  bill_id?: number | null;

  vendor_id: number;
  warehouse_id: number;
  issue_date: string;
  note?: string | null;

  extra_charge_amt?: number;
  extra_charge_note?: string | null;
  header_discount_type?: "PERCENT" | "AMOUNT";
  header_discount_value?: number;

  items: {
    bill_item_id?: number | null;
    product_id: number;
    qty: number;
    unit_cost: number;
    discount_pct?: number;
    discount_amt?: number;
    tax_type?: TaxType;
  }[];
};

export async function createGrn(payload: CreateGrnPayload): Promise<{ id: number }> {
  const { data } = await api.post("/purchase/grn", payload);
  return data;
}

export async function getGrn(id: number): Promise<GrnDetail> {
  const { data } = await api.get(`/purchase/grn/${id}`);
  return data;
}

export async function approveGrn(id: number) {
  const { data } = await api.post(`/purchase/grn/${id}/approve`);
  return data;
}

export async function cancelGrn(id: number, reason: string) {
  const { data } = await api.post(`/purchase/grn/${id}/cancel`, { reason });
  return data;
}

export type GrnListRow = {
  id: number;
  company_id: number;
  grn_no: string;
  status: GrnStatus;
  issue_date: string;
  created_at?: string;

  vendor_name: string;
  warehouse_name: string;

  po_id?: number | null;
  bill_id?: number | null;

  item_count?: number;
  total_amount?: number;
};

export type GrnListResponse = {
  rows: GrnListRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function listGrn(params?: {
  q?: string;
  status?: "" | GrnStatus;
  page?: number;
  pageSize?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}): Promise<GrnListResponse> {
  const { data } = await api.get("/purchase/grn", { params });
  return data;
}

export type PoStatus = "DRAFT" | "APPROVED" | "CANCELLED";

export type PoVendorContactSnapshot = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  position?: string | null;
};

export type PoHeader = {
  id: number;
  company_id: number;
  po_no: string;
  vendor_id: number;
  warehouse_id: number;
  status: PoStatus;
  issue_date: string;
  expected_date: string | null;
  note: string | null;

  created_by: number;
  approved_by: number | null;
  approved_at: string | null;

  cancelled_by: number | null;
  cancelled_at: string | null;
  cancel_reason: string | null;

  created_at?: string;
  updated_at?: string;

  vendor_name?: string;
  warehouse_name?: string;

  vendor_contact_name?: string | null;
  vendor_contact_phone?: string | null;
  vendor_contact_email?: string | null;
  vendor_contact_position?: string | null;

  vendor_person_prefix?: string | null;
  vendor_person_first_name?: string | null;
  vendor_person_last_name?: string | null;
  vendor_person_nickname?: string | null;
  vendor_person_email?: string | null;
  vendor_person_phone?: string | null;
  vendor_person_position?: string | null;
  vendor_person_department?: string | null;

  vendor_person_id?: number | null;
  extra_charge_amt?: number | null;
  extra_charge_note?: string | null;
};

export type PoItem = {
  id: number;
  product_id: number;
  code: string;
  name: string;
  qty: number;
  unit_cost: number;
  discount_pct?: number;
  discount_amt?: number;
  tax_type?: TaxType;
  line_net?: number;
};

export type PoDetail = {
  header: PoHeader;
  items: PoItem[];
};

export type CreatePoPayload = {
  po_no?: string | null;

  vendor_id: number;
  warehouse_id: number;
  issue_date: string;
  expected_date?: string | null;
  note?: string | null;

  vendor_contact?: PoVendorContactSnapshot;
  vendor_person_id?: number | null;

  items: { product_id: number; qty: number; unit_cost: number }[];
};

export type PoListRow = {
  id: number;
  company_id: number;
  po_no: string;
  status: PoStatus;
  issue_date: string;
  expected_date?: string | null;

  vendor_name: string;
  warehouse_name: string;

  item_count?: number;
  total_amount?: number;

  created_at?: string;

  vendor_contact_name?: string | null;

  vendor_person_first_name?: string | null;
  vendor_person_last_name?: string | null;
  vendor_person_phone?: string | null;
  vendor_person_email?: string | null;
};

export type PoListResponse = {
  rows: PoListRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function listPo(params?: {
  q?: string;
  status?: "" | PoStatus;
  page?: number;
  pageSize?: number;
  sort_by?: "po_no" | "vendor_name" | "status" | "issue_date" | "expected_date" | "total_amount";
  sort_dir?: "asc" | "desc";
}): Promise<PoListResponse> {
  const { data } = await api.get("/purchase/po", { params });
  return data;
}

export async function getNextPoNo(issueDate?: string): Promise<{ po_no: string }> {
  const { data } = await api.get("/purchase/po/next-no", {
    params: issueDate ? { issue_date: issueDate } : undefined,
  });
  return data;
}

export async function createPo(payload: CreatePoPayload): Promise<{ id: number; po_no?: string }> {
  const { data } = await api.post("/purchase/po", payload);
  return data;
}

export async function getPo(id: number): Promise<PoDetail> {
  const { data } = await api.get(`/purchase/po/${id}`);
  return data;
}

export async function approvePo(id: number) {
  const { data } = await api.post(`/purchase/po/${id}/approve`);
  return data;
}

export async function cancelPo(id: number, reason: string) {
  const { data } = await api.post(`/purchase/po/${id}/cancel`, { reason });
  return data;
}

export type BillStatus = "DRAFT" | "APPROVED" | "CANCELLED";

export type BillHeader = {
  id: number;
  company_id: number;

  bill_no: string;
  tax_invoice_no: string;

  po_id?: number | null;

  vendor_id: number;
  warehouse_id: number;

  status: BillStatus;
  issue_date: string;
  note?: string | null;

  created_at?: string;
  updated_at?: string;

  vendor_name?: string;
  warehouse_name?: string;

  extra_charge_amt?: number | null;
  extra_charge_note?: string | null;
  header_discount_type?: "PERCENT" | "AMOUNT" | null;
  header_discount_value?: number | null;
  
  paid_date?: string | null;
  finance_account_id?: number | null;
};

export type BillItem = {
  id: number;
  product_id: number;
  code: string;
  name: string;
  qty: number;
  unit_cost: number;
  discount_pct?: number;
  discount_amt: number;
  tax_type: TaxType;
  manual_vat?: number | null;
};

export type BillDetail = {
  header: BillHeader;
  items: BillItem[];
};

export type CreateBillPayload = {
  bill_no: string;
  tax_invoice_no: string;
  po_id?: number | null;

  vendor_id: number;
  vendor_person_id?: number | null;

  warehouse_id: number;
  issue_date: string;
  note?: string | null;

  extra_charge_amt?: number;
  extra_charge_note?: string | null;
  header_discount_type?: "PERCENT" | "AMOUNT";
  header_discount_value?: number;

  items: {
    product_id: number;
    qty: number;
    unit_cost: number;
    discount_pct?: number;
    discount_amt?: number;
    tax_type?: TaxType;
  }[];
  
  paid_date?: string | null;
  finance_account_id?: number | null;
};


export type BillListRow = {
  id: number;
  bill_no: string;
  tax_invoice_no: string;
  status: BillStatus;
  issue_date: string;

  vendor_name: string;
  warehouse_name: string;

  item_count?: number;
  total_amount?: number;
};

export type BillListResponse = {
  rows: BillListRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function listBill(params?: {
  q?: string;
  status?: "" | BillStatus;
  page?: number;
  pageSize?: number;
}): Promise<BillListResponse> {
  const { data } = await api.get("/purchase/bill", { params });
  return data;
}

export async function createBill(payload: CreateBillPayload): Promise<{ id: number }> {
  const { data } = await api.post("/purchase/bill", payload);
  return data;
}

export async function getBill(id: number): Promise<BillDetail> {
  const { data } = await api.get(`/purchase/bill/${id}`);
  return data;
}

export async function approveBill(id: number) {
  const { data } = await api.post(`/purchase/bill/${id}/approve`);
  return data;
}

export async function cancelBill(id: number, reason: string) {
  const { data } = await api.post(`/purchase/bill/${id}/cancel`, { reason });
  return data;
}
