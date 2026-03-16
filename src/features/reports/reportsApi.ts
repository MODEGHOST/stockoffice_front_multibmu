import api from "../../lib/api";

export async function getStockCard(productId: number, from: string, to: string, warehouseId?: number) {
    const params: any = { product_id: productId, from, to };
    if (warehouseId) params.warehouse_id = warehouseId;
    const { data } = await api.get("/reports/stock-card", { params });
    return data;
}

export async function getAging(type: "AR" | "AP") {
    const { data } = await api.get("/reports/aging", { params: { type } });
    return data;
}

export async function getSalesTrend(from: string, to: string) {
    const { data } = await api.get("/reports/sales-trend", { params: { from, to } });
    return data;
}
