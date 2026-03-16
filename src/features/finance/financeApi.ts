import api from "../../lib/api";

export interface FinanceAccount {
  id: number;
  company_id: number;
  type: "CASH" | "BANK" | "EWALLET" | "ADVANCE";
  name: string;
  provider_name: string | null;
  account_no: string | null;
  account_name: string | null;
  person_name: string | null;
  contact_number: string | null;
  balance: string | number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceAccountData extends Omit<FinanceAccount, "id" | "company_id" | "balance" | "is_active" | "created_at" | "updated_at"> {
  balance?: number | string;
}

export interface FinanceTransaction {
  id: number;
  transaction_type: "INCOME" | "EXPENSE";
  amount: number | string;
  reference_type: string | null;
  reference_id: number | null;
  transaction_date: string;
  created_at: string;
  running_balance?: number;
  
  invoice_no?: string | null;
  receipt_no?: string | null;
  sales_customer_name?: string | null;
  
  bill_no?: string | null;
  purchase_tax_invoice?: string | null;
  purchase_vendor_name?: string | null;
}

export const financeApi = {
  list: async () => {
    const res = await api.get<FinanceAccount[]>("/finance-accounts");
    return res.data;
  },
  
  create: async (data: FinanceAccountData) => {
    const res = await api.post<FinanceAccount>("/finance-accounts", data);
    return res.data;
  },

  update: async (id: number, data: FinanceAccountData) => {
    const res = await api.put<FinanceAccount>(`/finance-accounts/${id}`, data);
    return res.data;
  },

  delete: async (id: number) => {
    const res = await api.delete(`/finance-accounts/${id}`);
    return res.data;
  },

  getTransactions: async (id: number, params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get<FinanceTransaction[]>(`/finance-accounts/${id}/transactions`, { params });
    return res.data;
  }
};
