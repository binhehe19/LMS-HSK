"use client";

import { createContext, useContext } from "react";
import type { ManagementArea } from "@/lib/management/area";

/**
 * Khu vực quản lý hiện tại (admin | instructor), do layout của từng nhóm route cung cấp. Trang chỉ khai báo nội dung và dùng
 * ManagementPageFrame, không tự chọn sidebar: chọn sai sidebar so với nhóm route (và role đã được RequireAuth kiểm) là không thể.
 * Không có provider => lỗi rõ ràng thay vì mặc định âm thầm sang một vai trò.
 */
const ManagementAreaContext = createContext<ManagementArea | null>(null);

export const ManagementAreaProvider = ManagementAreaContext.Provider;

export function useManagementArea(): ManagementArea {
  const area = useContext(ManagementAreaContext);
  if (!area) throw new Error("ManagementPageFrame phải nằm trong ManagementShell (thiếu ManagementAreaProvider).");
  return area;
}
