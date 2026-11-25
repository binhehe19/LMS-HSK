package pl.co.lms.service.placement;

import base.co.common.exception.*;
import base.co.common.filter.principal.AuthPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;

final class PlacementAccess {
    private PlacementAccess() {}
    static String user() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof AuthPrincipal p) return p.userId();
        throw new ApiException(ErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập để sử dụng Test đầu vào");
    }
    static void admin() {
        user();
        if (SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .noneMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Chỉ quản trị viên được quản lý Test đầu vào");
        }
    }
    static ApiException missing() { return new ApiException(ErrorCode.E227, "Không tìm thấy dữ liệu Test đầu vào"); }
    static ApiException invalid(String message) { return new ApiException(ErrorCode.E200, message); }
}
