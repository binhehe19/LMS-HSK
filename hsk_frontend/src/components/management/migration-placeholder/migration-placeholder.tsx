"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { findNavTitle } from "@/components/management/nav-titles";
import { findRoute, firstMigratedRouteFor } from "@/lib/management/route-registry";
import { useAppSelector } from "@/redux/hooks";

const noopSubscribe = () => () => {};

/**
 * Có trang trước để quay lại không. Ưu tiên Navigation API (canGoBack; không tính trang about:blank ban đầu của tab mới); trình duyệt chưa có thì dùng
 * history.length (gần đúng, có thể đếm cả trang trống của tab mới).
 */
function hasPreviousEntry(): boolean {
  const navigation = (window as unknown as { navigation?: { canGoBack: boolean } }).navigation;
  return navigation ? navigation.canGoBack : window.history.length > 1;
}

/**
 * Trang "Chức năng đang được chuyển đổi" cho route hợp lệ của HSK cũ chưa chuyển (NOT_MIGRATED), hiện ĐÚNG URL cũ, trong khung quản lý
 * (sidebar/menu/active giữ nguyên). Một component dùng chung cho mọi route; không có nút hay chức năng giả:
 *  - "Quay lại trang trước" chỉ hiện khi tab có lịch sử để quay lại.
 *  - Liên kết về màn hình quản lý chỉ hiện nếu role có ít nhất một màn hình ĐÃ chuyển (nếu không thì nói rõ là chưa có).
 */
export function MigrationPlaceholder({ pathname }: { pathname: string }) {
  const router = useRouter();
  const roles = useAppSelector((state) => state.auth.user?.roles);
  const canGoBack = useSyncExternalStore(noopSubscribe, hasPreviousEntry, () => false);

  const route = findRoute(pathname);
  const title = findNavTitle(pathname);
  const home = firstMigratedRouteFor(roles);
  const homeTitle = home ? (findNavTitle(home.path) ?? home.path) : null;

  return (
    <ManagementPageFrame>
      <div className="card" data-testid="migration-placeholder" data-route={route?.path ?? pathname}>
        <div className="card-body text-center py-5 px-4">
          <i className="isax isax-setting-2 fs-1 text-primary mb-3 d-inline-block" aria-hidden="true" />
          <h3 className="mb-2">Chức năng đang được chuyển đổi</h3>
          <p className="text-muted mb-3">
            {title ? <strong>{title}</strong> : "Màn hình này"} đang được chuyển sang hệ thống mới nên chưa sử dụng được ở đây. Địa chỉ trang không thay
            đổi; khi chuyển xong, bạn sẽ dùng lại đúng địa chỉ này.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            {home && (
              <Link href={home.path} prefetch={false} className="btn btn-primary" data-testid="placeholder-home-link">
                Về {homeTitle}
              </Link>
            )}
            {canGoBack && (
              <button type="button" className="btn btn-outline-primary" onClick={() => router.back()} data-testid="placeholder-back">
                Quay lại trang trước
              </button>
            )}
          </div>
          {!home && (
            <p className="text-muted small mt-3 mb-0" data-testid="placeholder-no-home">
              Hiện chưa có màn hình quản lý nào đã chuyển dành cho vai trò của bạn.
            </p>
          )}
        </div>
      </div>
    </ManagementPageFrame>
  );
}
