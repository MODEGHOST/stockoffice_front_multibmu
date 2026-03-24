// src/components/Navbar.tsx
import { useEffect, useState } from "react";
import { Menu, Button, Space } from "antd";
import { useNavigate } from "react-router-dom";
import { getMeCache, hasPermission, me, logout, subscribeAuth } from "../features/auth/authStore";
import CompanySwitcher from "./CompanySwitcher";
import PwaInstallPrompt from "./PwaInstallPrompt";

export default function Navbar() {
  const nav = useNavigate();
  const [, force] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token && !getMeCache()) me().catch(() => {});
    const unsub = subscribeAuth(() => force((x) => x + 1));
    return unsub;
  }, []);

  const user = getMeCache()?.user;


  // ✅ ถ้ายังไม่มี permission purchase.bill.manage ให้ fallback ใช้ purchase.po.manage ชั่วคราว
  const canBill =
    hasPermission("purchase.bill.manage") || hasPermission("purchase.po.manage");

  // Determine if a parent should be shown based on if any of its children exist
  const masterDataChildren = [
    hasPermission("master.product.manage") ? { key: "/products", label: "สินค้า" } : null,
    hasPermission("master.warehouse.manage") ? { key: "/warehouses", label: "คลังสินค้า" } : null,
    hasPermission("master.vendor.manage") ? { key: "/vendors", label: "ผู้จำหน่าย" } : null,
  ].filter(Boolean);

  const purchaseChildren = [
    hasPermission("purchase.po.manage") ? { key: "/purchase/po", label: "ใบสั่งซื้อ (PO)" } : null,
    canBill ? { key: "/purchase/bill", label: "บิลซื้อ (Bill)" } : null,
    hasPermission("purchase.grn.manage") ? { key: "/purchase/grn", label: "รับสินค้า (GRN)" } : null,
  ].filter(Boolean);

  const salesChildren = [
    hasPermission("sales.inv.manage") ? { key: "/sales/quotation", label: "ใบเสนอราคา (QT)" } : null,
    hasPermission("sales.inv.manage") ? { key: "/sales/invoice", label: "ใบแจ้งหนี้ (IV)" } : null,
    hasPermission("sales.inv.manage") ? { key: "/sales/billing-notes", label: "ใบวางบิล (BL)" } : null,
    hasPermission("sales.inv.manage") ? { key: "/sales/receipt", label: "ใบเสร็จรับเงิน (RE)" } : null,
    hasPermission("sales.inv.manage") ? { key: "/sales/delivery-note", label: "ใบส่งของ (DO)" } : null,
  ].filter(Boolean);

  const inventoryChildren = [
    hasPermission("stock.adjust.manage") ? { key: "/stock/adjustments", label: "ปรับปรุงสต๊อก (ADJ)" } : null,
    hasPermission("stock.adjust.manage") ? { key: "/stock/transfers", label: "โอนย้าย (TF)" } : null,
    hasPermission("stock.adjust.manage") ? { key: "/stock/counts", label: "ตรวจนับ (SC)" } : null,
  ].filter(Boolean);

  const adminChildren = [
    getMeCache()?.roles?.includes("system_owner") ? { key: "/admin/companies", label: "จัดการบริษัทลูกค้า" } : null,
    hasPermission("master.user.manage") ? { key: "/admin/users", label: "ผู้ใช้งาน" } : null,
    hasPermission("master.role.manage") ? { key: "/admin/roles", label: "สิทธิ์การใช้งาน" } : null,
    hasPermission("master.user.manage") ? { key: "/admin/commissions", label: "จ่ายค่าคอมมิชชั่น" } : null,
    hasPermission("master.company.manage") ? { key: "/admin/settings", label: "ตั้งค่าระบบ" } : null,
    hasPermission("system.settings.manage") ? { key: "/admin/logs", label: "ประวัติการใช้งาน" } : null,
  ].filter(Boolean);

  const items = [
    { key: "/", label: "หน้าหลัก" },
    masterDataChildren.length > 0 ? { key: "group-master", label: "ข้อมูลพื้นฐาน", children: masterDataChildren } : null,
    purchaseChildren.length > 0 ? { key: "group-purchase", label: "ซื้อ", children: purchaseChildren } : null,
    salesChildren.length > 0 ? { key: "group-sales", label: "ขาย", children: salesChildren } : null,
    inventoryChildren.length > 0 ? { key: "group-inventory", label: "คลังสินค้า", children: inventoryChildren } : null,
    hasPermission("reports.view") ? { key: "/reports", label: "รายงาน" } : null,
    adminChildren.length > 0 ? { key: "group-admin", label: "ตั้งค่าระบบ", children: adminChildren } : null,
    { key: "/finance", label: "การเงิน" },
  ].filter(Boolean) as any[];

  return (
    <div className="w-full flex items-center justify-between">
      <Menu
        mode="horizontal"
        selectedKeys={[window.location.pathname]}
        items={items}
        onClick={(e) => nav(e.key)}
        className="flex-1"
      />

      <Space>
        <PwaInstallPrompt />
        {getMeCache()?.roles?.includes("system_owner") && <CompanySwitcher />}
        <span className="text-sm text-gray-600">{user?.email}</span>
        <Button
          onClick={() => {
            logout();
            nav("/login", { replace: true });
          }}
        >
          Logout
        </Button>
      </Space>
    </div>
  );
}
