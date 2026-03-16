import { createBrowserRouter } from "react-router-dom";
import RequireAuth from "../lib/guard";
import AppLayout from "../components/AppLayout";

import LoginPage from "../features/auth/LoginPage";
import DashboardPage from "../features/dashboard/DashboardPage";

import ProductListPage from "../features/products/ProductListPage";
import WarehouseListPage from "../features/warehouses/WarehouseListPage";
import WarehouseDetailPage from "../features/warehouses/WarehouseDetailPage";
import CompanyStockPage from "../features/warehouses/CompanyStockPage"; 

import VendorListPage from "../features/vendors/VendorListPage";

import GrnListPage from "../features/purchase/GrnListPage";
import GrnCreatePage from "../features/purchase/GrnCreatePage";
import GrnDetailPage from "../features/purchase/GrnDetailPage";

import PoListPage from "../features/purchase/PoListPage";
import PoCreatePage from "../features/purchase/PoCreatePage";
import PoDetailPage from "../features/purchase/PoDetailPage";

import BillListPage from "../features/purchase/BillListPage";
import BillCreatePage from "../features/purchase/BillCreatePage";
import BillDetailPage from "../features/purchase/BillDetailPage";

import InvoiceListPage from "../features/sales/InvoiceListPage";
import InvoiceCreatePage from "../features/sales/InvoiceCreatePage";
import InvoiceDetailPage from "../features/sales/InvoiceDetailPage";
import QuotationListPage from "../features/sales/QuotationListPage";
import DeliveryNoteListPage from "../features/sales/DeliveryNoteListPage";
import ReceiptListPage from "../features/sales/ReceiptListPage";
import BillingNoteListPage from "../features/sales/BillingNoteListPage";
import BillingNoteCreatePage from "../features/sales/BillingNoteCreatePage";
import BillingNoteDetailPage from "../features/sales/BillingNoteDetailPage";

import UsersPage from "../features/admin/UsersPage";
import SettingsPage from "../features/admin/SettingsPage";
import CommissionPaymentPage from "../features/admin/CommissionPaymentPage";

import AdjustmentListPage from "../features/stock/AdjustmentListPage";
import AdjustmentCreatePage from "../features/stock/AdjustmentCreatePage";
import AdjustmentDetailPage from "../features/stock/AdjustmentDetailPage";

import TransferListPage from "../features/stock/TransferListPage";
import TransferCreatePage from "../features/stock/TransferCreatePage";
import TransferDetailPage from "../features/stock/TransferDetailPage";

import CountListPage from "../features/stock/CountListPage";
import CountCreatePage from "../features/stock/CountCreatePage";
import CountDetailPage from "../features/stock/CountDetailPage";

import ReportsDashboard from "../features/reports/ReportsDashboard";
import FinanceAccountsPage from "../features/finance/FinanceAccountsPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },

          { path: "products", element: <ProductListPage /> },

          { path: "warehouses", element: <WarehouseListPage /> },
          { path: "warehouses/:id", element: <WarehouseDetailPage /> },

          { path: "stock/company", element: <CompanyStockPage /> }, 

          { path: "vendors", element: <VendorListPage /> },

          { path: "purchase/po", element: <PoListPage /> },
          { path: "purchase/po/new", element: <PoCreatePage /> },
          { path: "purchase/po/:id", element: <PoDetailPage /> },

          { path: "purchase/grn", element: <GrnListPage /> },
          { path: "purchase/grn/new", element: <GrnCreatePage /> },
          { path: "purchase/grn/:id", element: <GrnDetailPage /> },

          { path: "purchase/bill", element: <BillListPage /> },
          { path: "purchase/bill/new", element: <BillCreatePage /> },
          { path: "purchase/bill/:id", element: <BillDetailPage /> },

          { path: "sales/quotation", element: <QuotationListPage /> },
          { path: "sales/invoice", element: <InvoiceListPage /> },
          { path: "sales/delivery-note", element: <DeliveryNoteListPage /> },
          { path: "sales/receipt", element: <ReceiptListPage /> },
          { path: "sales/billing-notes", element: <BillingNoteListPage /> },
          { path: "sales/billing-notes/new", element: <BillingNoteCreatePage /> },
          { path: "sales/billing-notes/:id", element: <BillingNoteDetailPage /> },
          
          { path: "sales/invoice/new", element: <InvoiceCreatePage /> },
          { path: "sales/invoice/:id", element: <InvoiceDetailPage /> },



          { path: "admin/users", element: <UsersPage /> },
          { path: "admin/settings", element: <SettingsPage /> },
          { path: "admin/commissions", element: <CommissionPaymentPage /> },

          { path: "stock/adjustments", element: <AdjustmentListPage /> },
          { path: "stock/adjustments/new", element: <AdjustmentCreatePage /> },
          { path: "stock/adjustments/:id", element: <AdjustmentDetailPage /> },

          { path: "stock/transfers", element: <TransferListPage /> },
          { path: "stock/transfers/new", element: <TransferCreatePage /> },
          { path: "stock/transfers/:id", element: <TransferDetailPage /> },

          { path: "stock/counts", element: <CountListPage /> },
          { path: "stock/counts/new", element: <CountCreatePage /> },
          { path: "stock/counts/:id", element: <CountDetailPage /> },

          { path: "reports", element: <ReportsDashboard /> },
          
          { path: "finance", element: <FinanceAccountsPage /> },
        ],
      },
    ],
  },
]);
