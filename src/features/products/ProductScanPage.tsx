import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, Typography, Spin, Divider, Result, Alert } from "antd";
import api from "../../lib/api";

const { Title, Text } = Typography;

type ScanResult = {
  code: string;
  name: string;
  unit: string | null;
  qty: number;
};

export default function ProductScanPage() {
  const { hash } = useParams<{ hash: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // ใช้ baseURL ปกติแต่ยิงไปที่ /public แทน (ถ้ามีการทำ reverse proxy ต้องระวัง)
        // หรือถ้าปกติ api ชี้ไปที่ http://localhost:4000/api อยู่แล้ว
        // การกำหนด axios instance แบบนี้ปกติจะมุดไปที่ baseURL /public
        const res = await api.get(`/public/p/${hash}`, {
          // แจ้งไม่ให้ API แนบ Token ของระบบถ้าไม่จำเป็น (เพื่อให้เป็น Public แท้จริง)
          headers: { Authorization: "" }
        });
        
        setData(res.data);
      } catch (e: any) {
        setError(e?.response?.data?.message || "ไม่สามารถดึงข้อมูลสินค้านี้ได้ หรือรหัส QR ไม่ถูกต้อง");
      } finally {
        setLoading(false);
      }
    }

    if (hash) {
      // เนื่องจาก baseUrl ของ api.ts คือ http://localhost:4000 (โดยไม่ได้ต่อท้าย /api)
      // การยิง /public/p/:hash จะไปตกที่ Backend Public Routes ของเราพอดี
      fetchData();
    }
  }, [hash]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <Spin size="large" />
        <p className="mt-4 text-gray-500">กำลังโหลดข้อมูลสินค้า...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
         <Result
          status="warning"
          title="ไม่พบข้อมูลสินค้า"
          subTitle={error}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card 
        className="w-full max-w-md shadow-lg rounded-2xl border-none"
        bodyStyle={{ padding: "32px 24px" }}
      >
        <div className="text-center mb-6">
          <Text type="secondary" className="text-lg tracking-widest uppercase font-semibold">
             รหัสสินค้า / CODE
          </Text>
          <Title level={2} className="!mt-1 !mb-0 text-indigo-600">
            {data.code}
          </Title>
        </div>

        <Divider />

        <div className="text-center mb-6">
          <Text type="secondary" className="text-sm">
             ชื่อสินค้า
          </Text>
          <Title level={4} className="!mt-2 !mb-0 text-gray-800 line-clamp-3">
            {data.name}
          </Title>
        </div>

        <Divider />

        <div className="bg-indigo-50 rounded-xl p-6 text-center border border-indigo-100">
           <Text type="secondary" className="text-sm">
             จำนวนคงเหลือ (Stock)
          </Text>
          <div className="mt-2 flex items-baseline justify-center gap-2">
            <span className="text-5xl font-bold text-indigo-700">
              {data.qty.toLocaleString()}
            </span>
            <span className="text-xl text-indigo-500 font-medium">
              {data.unit || "ชิ้น"}
            </span>
          </div>
        </div>
        
        <Alert 
          className="mt-6 rounded-lg text-center bg-transparent border-none text-gray-400" 
          message="ข้อมูลถูกถึงมา ณ เวลาปัจจุบัน"
          type="info" 
          showIcon={false} 
        />
      </Card>
    </div>
  );
}
