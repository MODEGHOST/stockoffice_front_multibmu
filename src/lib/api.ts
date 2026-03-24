import axios, { AxiosError } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL as string;

const api = axios.create({
  baseURL,
  timeout: 15000,
});

api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) throw new Error("NO_REFRESH_TOKEN");

  const switchCompanyId = localStorage.getItem("switchCompanyId");
  const payload: any = { refreshToken };
  if (switchCompanyId) {
    payload.switchCompanyId = switchCompanyId;
  }

  const r = await axios.post(
    `${baseURL}/auth/refresh`,
    payload,
    { timeout: 15000 }
  );

  const newAccess = r.data?.accessToken as string;
  if (!newAccess) throw new Error("BAD_REFRESH_RESPONSE");

  localStorage.setItem("accessToken", newAccess);
  return newAccess;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as any;

    if (status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = doRefresh().finally(() => (refreshing = null));
        }

        const newAccess = await refreshing;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api.request(original);
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
