import { configureStore } from "@reduxjs/toolkit";
import authReducer, { type AuthState } from "@/redux/slices/auth-slice";

/** Tạo store mới cho mỗi lần render phía server/mỗi test (khuyến nghị của Redux cho App Router). */
export function makeStore(preloadedAuth?: Partial<AuthState>) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: preloadedAuth
      ? { auth: { status: "loading" as const, user: null, errorMessage: null, ...preloadedAuth } }
      : undefined,
  });
}

type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
