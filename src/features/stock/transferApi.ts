import api from "../../lib/api";
import dayjs from "dayjs";

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

type DocConfig = {
    doc_type: string;
    prefix: string;
    reset_policy: "MONTHLY" | "DAILY" | "YEARLY" | "NONE";
};

function dateToken(issueDate: string, resetPolicy: DocConfig["reset_policy"]) {
    const d = dayjs(issueDate || undefined);
    if (resetPolicy === "DAILY") return d.format("YYYYMMDD");
    if (resetPolicy === "MONTHLY") return d.format("YYYYMM");
    if (resetPolicy === "YEARLY") return d.format("YYYY");
    return "";
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildDocNo(prefix: string, token: string, running: number, width: number) {
    const normalizedPrefix = prefix || "TF-";
    const separator = normalizedPrefix.endsWith("-") ? "" : "-";
    const runningText = String(running).padStart(width, "0");
    return token
        ? `${normalizedPrefix}${separator}${token}-${runningText}`
        : `${normalizedPrefix}${separator}${runningText}`;
}

export async function getNextTransferDocNo(issueDate: string): Promise<string> {
    const settingsRes = await api.get("/company/settings");
    const configs: DocConfig[] = settingsRes.data?.doc_configs || [];
    const config =
        configs.find((c) => c.doc_type === "TF") ||
        configs.find((c) => c.doc_type === "IVT") ||
        ({ doc_type: "TF", prefix: "TF-", reset_policy: "DAILY" } as DocConfig);

    const token = dateToken(issueDate, config.reset_policy || "DAILY");
    const searchPrefix = `${config.prefix || "TF-"}${token}`;
    const transferRes = await listTransfers({
        q: searchPrefix,
        page: 1,
        pageSize: 1000,
        limit: 1000,
    });

    const escapedPrefix = escapeRegExp(config.prefix || "TF-");
    const escapedToken = escapeRegExp(token);
    const pattern = token
        ? new RegExp(`^${escapedPrefix}-?${escapedToken}-(\\d+)$`)
        : new RegExp(`^${escapedPrefix}-?(\\d+)$`);

    let maxRunning = 0;
    let width = 4;

    for (const row of transferRes.rows || []) {
        const match = String(row.doc_no || "").match(pattern);
        if (!match) continue;

        const runningText = match[1];
        maxRunning = Math.max(maxRunning, Number(runningText) || 0);
        width = Math.max(width, runningText.length);
    }

    return buildDocNo(config.prefix || "TF-", token, maxRunning + 1, width);
}

export async function approveTransfer(id: number) {
    const { data } = await api.post(`/stock/transfers/${id}/approve`);
    return data;
}

export async function cancelTransfer(id: number) {
    const { data } = await api.post(`/stock/transfers/${id}/cancel`);
    return data;
}
