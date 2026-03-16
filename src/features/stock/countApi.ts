import api from "../../lib/api";

export interface CountListRow {
    id: number;
    doc_no: string;
    issue_date: string;
    warehouse_name: string;
    status: "DRAFT" | "APPROVED" | "CANCELLED";
}

export interface CountItem {
    id: number;
    product_id: number;
    product_code: string;
    product_name: string;
    system_qty: number;
    counted_qty: number;
    variance_qty: number;
}

export interface CountDetail {
    header: {
        id: number;
        doc_no: string;
        issue_date: string;
        status: "DRAFT" | "APPROVED" | "CANCELLED";
        warehouse_id: number;
        warehouse_name: string;
        note: string;
        adjustment_id?: number;
        adjustment_doc_no?: string;
        created_at: string;
        created_by: number;
        approved_at?: string;
        cancelled_at?: string;
    };
    items: CountItem[];
}

export async function listCounts(params?: any): Promise<{ rows: CountListRow[], total: number }> {
    const { data } = await api.get("/stock/counts", { params });
    return data;
}

export async function getCount(id: number): Promise<CountDetail> {
    const { data } = await api.get(`/stock/counts/${id}`);
    return data;
}

export async function createCount(payload: any) {
    const { data } = await api.post("/stock/counts", payload);
    return data;
}

export async function approveCount(id: number) {
    const { data } = await api.post(`/stock/counts/${id}/approve`);
    return data;
}

export async function cancelCount(id: number) {
    const { data } = await api.post(`/stock/counts/${id}/cancel`);
    return data;
}
