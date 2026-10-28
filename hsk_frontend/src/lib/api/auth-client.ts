// Gọi Authentication_Backend dùng chung (KHÔNG phải backend LMS). Chỉ gồm các endpoint mà LMS_Frontend cũ và LMS_IELTS
// đều dùng: GET /users/me và POST /logout (+ POST /refresh trong auth-session.ts). Không có login/đăng ký: đăng nhập diễn ra
// trên Authentication_Frontend (xem lib/auth/auth-redirect.ts).
import { apiFetch, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getAuthApiBase } from "@/lib/api/auth-session";
import { clearTokens, getRefreshToken } from "@/lib/auth/token-store";

function authApiBase(): string {
  const base = getAuthApiBase();
  if (!base) throw new ApiNotConfiguredError();
  return base;
}

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
  return apiFetch<AuthUser>(authApiBase(), "/users/me", { method: "GET" });
}

/**
 * Đăng xuất phía server (Auth thu hồi refresh token và xóa cookie) rồi quên token trong bộ nhớ. Idempotent: luôn thành công
 * ở phía gọi, lỗi mạng/Auth không được chặn việc rời phiên cục bộ (như HSK cũ).
 */
export async function logoutRemote(): Promise<void> {
  try {
    const refreshToken = getRefreshToken();
    await apiFetch<void>(authApiBase(), "/logout", {
      method: "POST",
      body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
      skipRefresh: true,
    });
  } catch {
    // Không chặn việc rời phiên cục bộ.
  } finally {
    clearTokens();
  }
}
