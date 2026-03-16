import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { getMeCache, me } from "../features/auth/authStore";

export default function RequireAuth() {
  const location = useLocation();
  const token = localStorage.getItem("accessToken");
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (!token) return;
    if (getMeCache()) {
      setLoading(false);
      return;
    }
    me()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin />
      </div>
    );
  }

  return <Outlet />;
}
