// vendorApi.ts
import api from "../../lib/api";

export type VendorContactChannel =
  | "phone"
  | "email"
  | "website"
  | "fax"
  | "line"
  | "facebook"
  | "other";

export type VendorContact = {
  id?: number;
  vendor_id?: number;
  label?: string | null;
  channel: VendorContactChannel;
  value: string;
  is_primary?: number; // 0/1
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type VendorBankAccount = {
  id?: number;
  vendor_id?: number;
  bank_code?: string | null;
  bank_name: string;
  account_name: string;
  account_no: string;
  branch_code?: string | null;
  is_default?: number; // 0/1
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type VendorPerson = {
  id?: number;
  vendor_id?: number;
  prefix?: string | null;
  first_name: string; // backend require
  last_name?: string | null;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  is_primary?: number; // 0/1
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type VendorAddress = {
  id?: number;
  vendor_id?: number;
  addr_type?: "registered" | "shipping";
  contact_name?: string | null;
  address_line?: string | null;
  subdistrict?: string | null;
  district?: string | null;
  province?: string | null;
  postcode?: string | null;
  country?: string | null; // default TH
};

/**
 * Payment Term = Rule ที่ติดไปกับเอกสาร
 * - by_days: ครบกำหนด = วันเอกสาร + X วัน
 * - by_month_day: ครบกำหนด = “ทุกวันที่ N ของเดือน”
 * - by_date: (legacy) วันที่แน่ชัด
 */
export type VendorPaymentTerm =
  | { type: "by_days"; due_days: number }
  | { type: "by_month_day"; month_day: number }
  | { type: "by_date"; due_date: string };

/**
 * ✅ legal_form รองรับตาม requirement
 * - corporate (นิติบุคคล)
 * - personal (บุคคลธรรมดา/ร้านค้า/คณะบุคคล/ห้างหุ้นส่วนสามัญ)
 *
 * NOTE: DB ของคุณเป็น varchar(30) เลยเก็บค่าเหล่านี้ได้เลย
 */
export type VendorLegalForm =
  | "company_limited" // บริษัทจำกัด
  | "public_company" // บริษัทมหาชนจำกัด
  | "limited_partnership" // หจก.
  | "foundation" // มูลนิธิ
  | "association" // สมาคม
  | "joint_venture" // กิจการร่วมค้า
  | "other" // อื่นๆ
  | "personal_individual" // บุคคลธรรมดา
  | "personal_ordinary_partnership" // ห้างหุ้นส่วนสามัญ
  | "personal_shop" // ร้านค้า
  | "personal_group"; // คณะบุคคล

export type VendorRow = {
  id: number;
  company_id: number;

  code: string;
  name: string;
  type?: "VENDOR" | "CUSTOMER" | "BOTH" | null;

  tax_id: string | null;
  tax_country?: "TH" | "OTHER" | null;

  office_type?: "hq" | "branch" | "unknown" | null;

  legal_entity_type?: "corporate" | "individual" | null;
  legal_form?: VendorLegalForm | null;

  business_name?: string | null;
  person_first_name?: string | null;
  person_last_name?: string | null;

  phone: string | null;
  email: string | null;
  address: string | null;

  // legacy columns
  payment_term_type?: "by_days" | "by_date" | "by_month_day" | null;
  payment_due_days?: number | null;
  payment_due_date?: string | null;
  payment_month_day?: number | null;

  is_active: number;

  created_at?: string;
  updated_at?: string;
};

export type VendorDetail = VendorRow & {
  registered_address: VendorAddress | null;
  shipping_address: VendorAddress | null;
  contacts: VendorContact[];
  people: VendorPerson[];
  bank_accounts: VendorBankAccount[];
  payment_term?: VendorPaymentTerm;
};

export type VendorUpsert = {
  code?: string;
  name: string;
  type?: "VENDOR" | "CUSTOMER" | "BOTH" | null;

  tax_id?: string | null;
  tax_country?: "TH" | "OTHER" | null;

  office_type?: "hq" | "branch" | "unknown" | null;

  legal_entity_type?: "corporate" | "individual" | null;
  legal_form?: VendorLegalForm | null;

  business_name?: string | null;
  person_first_name?: string | null;
  person_last_name?: string | null;

  phone?: string | null;
  email?: string | null;
  address?: string | null;

  is_active?: number;

  registered_address?: {
    contact_name?: string | null;
    address_line?: string | null;
    subdistrict?: string | null;
    district?: string | null;
    province?: string | null;
    postcode?: string | null;
    country?: string | null;
  };

  shipping_address?: {
    contact_name?: string | null;
    address_line?: string | null;
    subdistrict?: string | null;
    district?: string | null;
    province?: string | null;
    postcode?: string | null;
    country?: string | null;
  };

  goods_shipping_address?: {
    contact_name?: string | null;
    phone?: string | null;
    address_line?: string | null;
    subdistrict?: string | null;
    district?: string | null;
    province?: string | null;
    postcode?: string | null;
    country?: string | null;
  };

  contacts?: VendorContact[];
  people?: VendorPerson[];
  bank_accounts?: VendorBankAccount[];

  payment_term?: VendorPaymentTerm;
};

export async function listVendors(params: Record<string, any> = {}): Promise<{ rows: VendorRow[], total: number }> {
  const { data } = await api.get("/vendors", { params });
  if (Array.isArray(data)) return { rows: data, total: data.length };
  return { rows: data?.rows || [], total: data?.total || 0 };
}

export async function getVendor(id: number): Promise<VendorDetail> {
  const { data } = await api.get(`/vendors/${id}`);
  return data as VendorDetail;
}

export async function createVendor(payload: VendorUpsert) {
  const { data } = await api.post("/vendors", payload);
  return data;
}

export async function updateVendor(id: number, payload: VendorUpsert) {
  const { data } = await api.put(`/vendors/${id}`, payload);
  return data;
}

export async function setVendorActive(id: number, is_active: number) {
  const { data } = await api.patch(`/vendors/${id}/active`, { is_active });
  return data;
}

export async function getNextVendorCode(type: "VENDOR" | "CUSTOMER" | "BOTH" = "VENDOR"): Promise<string> {
  const { data } = await api.get("/vendors/next-code", { params: { type } });
  return data?.code || "";
}
