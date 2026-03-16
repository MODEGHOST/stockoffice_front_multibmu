import { Layout } from "antd";
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";

const { Header, Content } = Layout;

export default function AppLayout() {
  return (
    <Layout className="min-h-screen">
      <Header className="!bg-white !px-4 shadow-sm flex items-center">
        <Navbar />
      </Header>

      <Content className="p-4">
        <div className="max-w-[1200px] mx-auto">
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}
