import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthUser } from "@/lib/api/auth-client";

/**
 * loading         : chưa kiểm tra phiên với server (không được render nội dung cần bảo vệ)
 * authenticated   : server xác nhận phiên (GET /users/me thành công)
 * unauthenticated : server từ chối (401/403, kể cả sau khi làm mới phiên) -> RequireAuth chuyển sang Authentication_Frontend
 * redirect-loop   : vừa chuyển sang Authentication mà quay về vẫn không có phiên -> KHÔNG tự chuyển nữa, chờ người dùng bấm
 * signed-out      : người dùng chủ động đăng xuất; nơi xử lý đăng xuất tự chuyển trang (RequireAuth không chuyển)
 * error           : không xác minh được (mất mạng, 5xx, chưa cấu hình) -> KHÔNG coi là đã đăng nhập
 */
type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "redirect-loop" | "signed-out" | "error";

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  errorMessage: string | null;
}

const initialAuthState: AuthState = { status: "loading", user: null, errorMessage: null };

const authSlice = createSlice({
  name: "auth",
  initialState: initialAuthState,
  reducers: {
    signinSuccess: (state, action: PayloadAction<AuthUser>) => {
      state.status = "authenticated";
      state.user = action.payload;
      state.errorMessage = null;
    },
    authCheckFailed: (state) => {
      state.status = "unauthenticated";
      state.user = null;
      state.errorMessage = null;
    },
    authRedirectBlocked: (state) => {
      state.status = "redirect-loop";
      state.user = null;
      state.errorMessage = null;
    },
    authCheckError: (state, action: PayloadAction<string>) => {
      state.status = "error";
      state.user = null;
      state.errorMessage = action.payload;
    },
    authCheckRetry: (state) => {
      state.status = "loading";
      state.errorMessage = null;
    },
    signout: (state) => {
      state.status = "signed-out";
      state.user = null;
      state.errorMessage = null;
    },
  },
});

export const { signinSuccess, authCheckFailed, authRedirectBlocked, authCheckError, authCheckRetry, signout } =
  authSlice.actions;
export default authSlice.reducer;
