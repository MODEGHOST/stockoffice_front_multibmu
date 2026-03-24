import { useState, useEffect } from "react";
import { Layout, Breadcrumb, Alert } from "antd";
import Navbar from "./Navbar";
import { Outlet, useLocation, Link } from "react-router-dom";
import PwaUpdater from "./PwaUpdater";

const { Header, Content } = Layout;

export default function AppLayout() {
  const loc = useLocation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);
  const paths = loc.pathname.split("/").filter(Boolean);

  const UNCLICKABLE = ["purchase", "sales", "stock", "admin"];
  const THAI_MAP: Record<string, string> = {
    purchase: "จัดซื้อ", po: "ใบสั่งซื้อ", grn: "รับสินค้า", bill: "บิลซื้อ",
    sales: "ขาย", quotation: "ใบเสนอราคา", invoice: "ใบแจ้งหนี้", "delivery-note": "ใบส่งของ", receipt: "ใบเสร็จ", "billing-notes": "ใบวางบิล",
    admin: "ผู้ดูแลระบบ", users: "ผู้ใช้งาน", roles: "ตำแหน่ง", settings: "ตั้งค่า", companies: "สาขา/บริษัท", commissions: "ค่าคอมมิชชั่น", logs: "ประวัติการใช้งาน",
    stock: "คลังสินค้า", adjustments: "ปรับปรุงสต๊อก", transfers: "โอนย้าย", counts: "ตรวจนับ", "company": "ภาพรวม",
    products: "สินค้า", warehouses: "คลัง", vendors: "ผู้จำหน่าย", finance: "การเงิน", new: "สร้างใหม่",
  };

  const breadcrumbItems = [
    { title: <Link to="/">หน้าหลัก</Link> },
    ...paths.map((p, i) => {
      const url = `/${paths.slice(0, i + 1).join("/")}`;
      
      // If it's an ID (number), just show "รายละเอียด" (Detail) unclickable
      const isId = /^\d+$/.test(p);
      const isUnclickable = UNCLICKABLE.includes(p) || isId;
      
      const readable = isId ? "รายละเอียด" : (THAI_MAP[p] || p.replace(/-/g, " "));
      
      return {
        title: isUnclickable ? (
          <span className="capitalize text-gray-500">{readable}</span>
        ) : (
          <Link to={url} className="capitalize">{readable}</Link>
        ),
      };
    })
  ];

  return (
    <Layout className="min-h-screen bg-gray-50">
      <PwaUpdater />
      <Header 
        className="!bg-white !px-4 shadow-sm flex items-center fixed top-0 left-0 w-full z-[100]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Navbar />
      </Header>

      <Content 
        className="pt-[80px]" 
        style={{ paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-[1500px] w-full px-4 lg:px-8 mx-auto">
          {isOffline && (
            <div className="mb-4">
              <Alert 
                message="ไม่มีการเชื่อมต่ออินเทอร์เน็ต (Offline)" 
                description="คุณกำลังใช้งานแบบออฟไลน์ ระบบจะไม่สามารถดึงข้อมูลล่าสุดหรือบันทึกข้อมูลขึ้นเซิร์ฟเวอร์ได้ชั่วคราว" 
                type="error" 
                showIcon 
                banner 
                className="rounded-lg shadow-sm"
              />
            </div>
          )}
          {paths.length > 0 && (
            <div className="mb-4">
              <Breadcrumb items={breadcrumbItems} />
            </div>
          )}
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}
