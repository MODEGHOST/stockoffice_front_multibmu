// src/features/sales/billingNoteApi.ts
import api from "../../lib/api";

export type BillingNoteStatus = "ISSUED" | "CANCELLED";

export type BillingNoteRow = {
    id: number;
    company_id: number;
    doc_no: string;
    doc_date: string;
    due_date: string | null;
    customer_id: number;
    customer_name: string | null;
    customer_code: string | null;
    status: BillingNoteStatus;
    total_amount: number;
    note: string | null;
    created_at: string;
    updated_at: string;
};

export type BillingNoteItem = {
    item_id: number;
    sales_id: number;
    invoice_no: string;
    issue_date: string;
    total: number;
    sales_status: string;
    quotation_no: string | null;
    delivery_no: string | null;
    payment_status?: string;
    paid_amount?: number;
    balance_due?: number;
};

export type BillingNoteDetail = BillingNoteRow & {
    customer_address: string | null;
    customer_tax_id: string | null;
    items: BillingNoteItem[];
};

export type CreateBillingNotePayload = {
    customer_id: number;
    issue_date: string;
    due_date?: string | null;
    note?: string | null;
    sales_ids: number[];
};

export async function listBillingNotes(params: { q?: string; page?: number; limit?: number }) {
    const { data } = await api.get("/billing-notes", { params });
    return data as { rows: BillingNoteRow[]; total: number };
}

export async function getBillingNote(id: number) {
    const { data } = await api.get(`/billing-notes/${id}`);
    return data as { header: BillingNoteDetail; items: BillingNoteItem[] };
}

export async function createBillingNote(payload: CreateBillingNotePayload) {
    const { data } = await api.post("/billing-notes", payload);
    return data;
}

export async function cancelBillingNote(id: number) {
    const { data } = await api.post(`/billing-notes/${id}/cancel`);
    return data;
}

export async function payBillingNote(id: number, amount: number) {
    const { data } = await api.post(`/billing-notes/${id}/pay`, { amount });
    return data;
}
