import { useEffect, useState } from "react";
import { Dropdown, message, Spin } from "antd";
import type { MenuProps } from "antd";
import { DownOutlined, ShopOutlined, GlobalOutlined } from "@ant-design/icons";
import api from "../lib/api";

type CompanyType = { id: number; name: string };

export default function CompanySwitcher() {
  const [companies, setCompanies] = useState<CompanyType[]>([]);
  const [loading, setLoading] = useState(false);
  const currentSwitchId = localStorage.getItem("switchCompanyId");

  useEffect(() => {
    // Only System Owner can see this, their roles check is done in Navbar
    api.get("/admin/companies")
      .then((res) => {
        setCompanies(Array.isArray(res.data) ? res.data : []);
      })
      .catch((e) => {
        message.error("Failed to load companies: " + e.message);
      });
  }, []);

  const handleMenuClick: MenuProps["onClick"] = async (e) => {
    const targetId = e.key === "null" ? null : Number(e.key);
    
    // Prevent re-switching to the current active context
    if (String(targetId) === String(currentSwitchId) || (targetId === null && !currentSwitchId)) {
      return; 
    }

    setLoading(true);
    try {
      // 1. Get new token with embedded company_id
      const { data } = await api.post("/auth/switch-company", { targetCompanyId: targetId });
      
      // 2. Save new token
      localStorage.setItem("accessToken", data.accessToken);
      if (targetId === null) {
        localStorage.removeItem("switchCompanyId");
      } else {
        localStorage.setItem("switchCompanyId", String(targetId));
      }
      
      // 3. Force reload app completely to dump all caches
      message.loading("Switching context...", 1);
      setTimeout(() => {
        window.location.href = "/";
      }, 500);

    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.message || "สลับบริษัทไม่สำเร็จ");
      setLoading(false);
    }
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "null",
      icon: <GlobalOutlined />,
      label: <span className="font-semibold text-blue-600">-- ระบบหลัก (Global View) --</span>,
    },
    { type: "divider" },
    ...companies.map((c) => ({
      key: String(c.id),
      icon: <ShopOutlined />,
      label: c.name,
    })),
  ];

  const currentComp = companies.find(c => String(c.id) === currentSwitchId);
  const displayLabel = currentComp ? currentComp.name : "Global System (Owner)";
  
  return (
    <div className="flex items-center">
      {loading ? (
        <Spin size="small" />
      ) : (
        <Dropdown menu={{ items: menuItems, onClick: handleMenuClick, selectedKeys: [currentSwitchId ?? "null"] }} trigger={["click"]}>
          <div className="flex items-center gap-2 cursor-pointer px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors border border-yellow-300 shadow-sm ml-4">
            <ShopOutlined />
            <span className="text-sm font-semibold truncate max-w-[150px]">
              {displayLabel}
            </span>
            <DownOutlined className="text-xs" />
          </div>
        </Dropdown>
      )}
    </div>
  );
}
