import { createBrowserRouter } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Spin } from "antd";

import RequireAuth from "../lib/guard";
import AppLayout from "../components/AppLayout";

// Helper to wrap lazy components in Suspense
const Loadable = (Component: React.LazyExoticComponent<any>) => (props: any) => (
  <Suspense
    fallback={
      <div className="flex items-center justify-center p-10 min-h-[50vh]">
        <Spin size="large" />
      </div>
    }
  >
    <Component {...props} />
  </Suspense>
);

const LoginPage = Loadable(lazy(() => import("../features/auth/LoginPage")));
const DashboardPage = Loadable(lazy(() => import("../features/dashboard/DashboardPage")));
const ProductScanPage = Loadable(lazy(() => import("../features/products/ProductScanPage")));

const ProductListPage = Loadable(lazy(() => import("../features/products/ProductListPage")));
const WarehouseListPage = Loadable(lazy(() => import("../features/warehouses/WarehouseListPage")));
const WarehouseDetailPage = Loadable(lazy(() => import("../features/warehouses/WarehouseDetailPage")));
const CompanyStockPage = Loadable(lazy(() => import("../features/warehouses/CompanyStockPage")));

const VendorListPage = Loadable(lazy(() => import("../features/vendors/VendorListPage")));

const GrnListPage = Loadable(lazy(() => import("../features/purchase/GrnListPage")));
const GrnCreatePage = Loadable(lazy(() => import("../features/purchase/GrnCreatePage")));
const GrnDetailPage = Loadable(lazy(() => import("../features/purchase/GrnDetailPage")));

const PoListPage = Loadable(lazy(() => import("../features/purchase/PoListPage")));
const PoCreatePage = Loadable(lazy(() => import("../features/purchase/PoCreatePage")));
const PoDetailPage = Loadable(lazy(() => import("../features/purchase/PoDetailPage")));

const BillListPage = Loadable(lazy(() => import("../features/purchase/BillListPage")));
const BillCreatePage = Loadable(lazy(() => import("../features/purchase/BillCreatePage")));
const BillDetailPage = Loadable(lazy(() => import("../features/purchase/BillDetailPage")));

const ScanToSalePage = Loadable(lazy(() => import("../features/sales/ScanToSalePage")));

const InvoiceListPage = Loadable(lazy(() => import("../features/sales/InvoiceListPage")));
const InvoiceCreatePage = Loadable(lazy(() => import("../features/sales/InvoiceCreatePage")));
const InvoiceDetailPage = Loadable(lazy(() => import("../features/sales/InvoiceDetailPage")));
const QuotationListPage = Loadable(lazy(() => import("../features/sales/QuotationListPage")));
const DeliveryNoteListPage = Loadable(lazy(() => import("../features/sales/DeliveryNoteListPage")));
const ReceiptListPage = Loadable(lazy(() => import("../features/sales/ReceiptListPage")));
const BillingNoteListPage = Loadable(lazy(() => import("../features/sales/BillingNoteListPage")));
const BillingNoteCreatePage = Loadable(lazy(() => import("../features/sales/BillingNoteCreatePage")));
const BillingNoteDetailPage = Loadable(lazy(() => import("../features/sales/BillingNoteDetailPage")));

const UsersPage = Loadable(lazy(() => import("../features/admin/UsersPage")));
const SettingsPage = Loadable(lazy(() => import("../features/admin/SettingsPage")));
const CommissionPaymentPage = Loadable(lazy(() => import("../features/admin/CommissionPaymentPage")));
const CPCreatePage = Loadable(lazy(() => import("../features/admin/CPCreatePage")));
const CompanyManagePage = Loadable(lazy(() => import("../features/admin/CompanyManagePage")));
const RolesPage = Loadable(lazy(() => import("../features/admin/RolesPage")));
const AuditLogsPage = Loadable(lazy(() => import("../features/admin/AuditLogsPage")));

const AdjustmentListPage = Loadable(lazy(() => import("../features/stock/AdjustmentListPage")));
const AdjustmentCreatePage = Loadable(lazy(() => import("../features/stock/AdjustmentCreatePage")));
const AdjustmentDetailPage = Loadable(lazy(() => import("../features/stock/AdjustmentDetailPage")));

const TransferListPage = Loadable(lazy(() => import("../features/stock/TransferListPage")));
const TransferCreatePage = Loadable(lazy(() => import("../features/stock/TransferCreatePage")));
const TransferDetailPage = Loadable(lazy(() => import("../features/stock/TransferDetailPage")));

const CountListPage = Loadable(lazy(() => import("../features/stock/CountListPage")));
const CountCreatePage = Loadable(lazy(() => import("../features/stock/CountCreatePage")));
const CountDetailPage = Loadable(lazy(() => import("../features/stock/CountDetailPage")));

const ReportsDashboard = Loadable(lazy(() => import("../features/reports/ReportsDashboard")));
const FinanceAccountsPage = Loadable(lazy(() => import("../features/finance/FinanceAccountsPage")));

export const router = createBrowserRouter([
  { path: "/p/:hash", element: <ProductScanPage /> },
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

          { path: "sales/scanner", element: <ScanToSalePage /> },
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
          { path: "admin/roles", element: <RolesPage /> },
          { path: "admin/settings", element: <SettingsPage /> },
          { path: "admin/companies", element: <CompanyManagePage /> },
          { path: "admin/commissions", element: <CommissionPaymentPage /> },
          { path: "admin/commissions/new", element: <CPCreatePage /> },
          { path: "admin/logs", element: <AuditLogsPage /> },

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
