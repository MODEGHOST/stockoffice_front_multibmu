import api from "../../lib/api";

export interface TransferListRow {
    id: number;
    doc_no: string;
    issue_date: string;
    source_warehouse_name: string;
    target_warehouse_name: string;
    status: "DRAFT" | "APPROVED" | "CANCELLED";
}

export interface TransferItem {
    id: number;
    product_id: number;
    product_code: string;
    product_name: string;
    qty: number;
}

export interface TransferDetail {
    header: {
        id: number;
        doc_no: string;
        issue_date: string;
        status: "DRAFT" | "APPROVED" | "CANCELLED";
        source_warehouse_id: number;
        target_warehouse_id: number;
        source_warehouse_name: string;
        target_warehouse_name: string;
        note: string;
        created_at: string;
        created_by: number;
        approved_at?: string;
        cancelled_at?: string;
    };
    items: TransferItem[];
}

export async function listTransfers(params?: any): Promise<{ rows: TransferListRow[], total: number }> {
    const { data } = await api.get("/stock/transfers", { params });
    return data;
}

export async function getTransfer(id: number): Promise<TransferDetail> {
    const { data } = await api.get(`/stock/transfers/${id}`);
    return data;
}

export async function createTransfer(payload: any) {
    const { data } = await api.post("/stock/transfers", payload);
    return data;
}

export async function approveTransfer(id: number) {
    const { data } = await api.post(`/stock/transfers/${id}/approve`);
    return data;
}

export async function cancelTransfer(id: number) {
    const { data } = await api.post(`/stock/transfers/${id}/cancel`);
    return data;
}
