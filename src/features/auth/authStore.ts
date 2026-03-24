import api from "../../lib/api";

export type MeResponse = {
  user: {
    id: number;
    company_id: number | null;
    first_name: string;
    last_name: string;
    email: string;
    display_name: string | null;
  };
  roles: string[];
  permissions: string[];
};

let _me: MeResponse | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeAuth(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}


export function getMeCache() {
  return _me;
}

export function hasPermission(code: string) {
  return !!_me?.permissions?.includes(code);
}

export async function login(email: string, password: string): Promise<MeResponse> {
  try {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.removeItem("switchCompanyId");
    _me = await me();
    emit();
    return _me;
  } catch (e) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("switchCompanyId");
    _me = null;
    emit();
    throw e;
  }
}

export async function me(): Promise<MeResponse> {
  const { data } = await api.get("/auth/me");
  _me = data;
  emit();
  return data;
}

export function logout() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("switchCompanyId");
  _me = null;
  emit();
}
