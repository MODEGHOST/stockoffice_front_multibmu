import { useEffect, useState } from "react";
import { Menu, Button, Space, Avatar, Dropdown, Drawer } from "antd";
import { useNavigate } from "react-router-dom";
import { UserOutlined, MenuOutlined, LogoutOutlined } from "@ant-design/icons";
import { getMeCache, hasPermission, me, logout, subscribeAuth } from "../features/auth/authStore";
import CompanySwitcher from "./CompanySwitcher";
import PwaInstallPrompt from "./PwaInstallPrompt";

export default function Navbar() {
  const nav = useNavigate();
  const [, force] = useState(0);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token && !getMeCache()) me().catch(() => { });
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
    hasPermission("sales.inv.manage") ? { key: "/sales/scanner", label: "สแกนขาย (POS)" } : null,
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
    hasPermission("master.company.manage") ? { key: "/admin/settings", label: "ตั้งค่าระบบ / ข้อมูลบริษัท" } : null,
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

  const userMenu = [
    {
      key: "email",
      label: <span className="text-gray-500">{user?.email || "User Profile"}</span>,
      disabled: true,
    },
    { type: "divider" },
    {
      key: "logout",
      label: "Logout",
      icon: <LogoutOutlined />,
      danger: true,
      onClick: () => {
        logout();
        nav("/login", { replace: true });
      },
    },
  ];

  return (
    <div className="w-full flex items-center justify-between">
      {/* Mobile Hamburger Button */}
      <div className="lg:hidden flex-none mr-4">
        <Button
          type="text"
          icon={<MenuOutlined className="text-lg" />}
          onClick={() => setDrawerVisible(true)}
        />
      </div>

      {/* Desktop Menu */}
      <div className="hidden lg:block flex-1 overflow-hidden">
        <Menu
          mode="horizontal"
          selectedKeys={[window.location.pathname]}
          items={items}
          onClick={(e) => nav(e.key)}
          className="border-b-0 w-full"
        />
      </div>

      {/* Right Side UI */}
      <Space className="flex-none gap-4">
        <div className="hidden sm:block">
          <PwaInstallPrompt />
        </div>
        {getMeCache()?.roles?.includes("system_owner") && <CompanySwitcher />}
        <Dropdown menu={{ items: userMenu as any }} placement="bottomRight" trigger={['click']}>
          <div className="cursor-pointer hover:bg-gray-100 p-1 pr-2 rounded-full transition-colors flex items-center gap-2 border border-transparent hover:border-gray-200">
            <Avatar icon={<UserOutlined />} className="bg-blue-600 flex-shrink-0" />
            <span className="hidden sm:block text-sm font-medium text-gray-700 min-w-[50px]">
              {user?.first_name || user?.email?.split('@')[0] || "Profile"}
            </span>
          </div>
        </Dropdown>
      </Space>

      {/* Mobile Drawer */}
      <Drawer
        title="เมนูระบบ"
        placement="left"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        <div className="p-4 border-b">
          <PwaInstallPrompt />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[window.location.pathname]}
          items={items}
          onClick={(e) => {
            setDrawerVisible(false);
            nav(e.key);
          }}
          className="border-r-0"
        />
      </Drawer>
    </div>
  );
}
