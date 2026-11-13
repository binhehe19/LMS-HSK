// Gọi Authentication_Backend dùng chung (KHÔNG phải backend LMS) qua host của app: gateway (oauth2-proxy) chỉ chuyển tiếp
// /users/me kèm phiên của proxy. Chỉ có GET /users/me; đăng nhập/đăng xuất đi qua /oauth2/* (xem lib/auth/auth-redirect.ts).
// Khi `next dev`, next.config.ts chuyển /api/auth/* tới NEXT_PUBLIC_AUTH_API_BASE_URL.
import { apiFetch } from "@/lib/api/api-client";

const AUTH_API_BASE_URL = "/api/auth";

// Hình dạng tối thiểu của GET /users/me (ProfileResponse của Authentication_Backend) mà giao diện cần.
export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string | null;
  /** Role NGUYÊN VĂN từ Auth (vd "ROLE_ADMIN"). Không ánh xạ/gộp role. */
  roles: string[];
  emailVerified?: boolean;
}

export async function getCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>(AUTH_API_BASE_URL, "/users/me", { method: "GET" });
}
