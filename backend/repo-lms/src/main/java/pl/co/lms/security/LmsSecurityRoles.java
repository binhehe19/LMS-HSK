package pl.co.lms.security;

import base.co.common.filter.principal.AuthPrincipal;
import base.co.common.security.RoleName;
import org.springframework.security.core.Authentication;

import java.util.Set;

/**
 * Chuỗi phân quyền @PreAuthorize theo cụm tính năng LMS 2.0, đồng bộ với route-registry.ts ở frontend.
 */
public final class LmsSecurityRoles {

    private LmsSecurityRoles() {
    }

    /** Cụm 2: Quản lý Lớp học & Học viên. */
    public static final String CLASS_OPS = "hasAnyAuthority('ROLE_ADMIN','ROLE_TRAINING_OPS')";

    /** Cụm 3: Quản lý Giáo trình (Syllabus). */
    public static final String SYLLABUS_MANAGE = "hasAnyAuthority('ROLE_ADMIN','ROLE_TRAINING_OPS','ROLE_RND','ROLE_TEACHER','ROLE_MENTOR')";

    /** Cụm 4: Quản lý Học liệu & Nội dung. */
    public static final String CONTENT_MANAGE = "hasAnyAuthority('ROLE_ADMIN','ROLE_TRAINING_OPS','ROLE_RND','ROLE_TEACHER','ROLE_MENTOR')";

    /** Cụm 5: Giảng dạy, Chấm bài & Phân tích lớp. */
    public static final String GRADING_MANAGE = "hasAnyAuthority('ROLE_ADMIN','ROLE_TRAINING_OPS','ROLE_TEACHER','ROLE_MENTOR')";

    private static final Set<String> CONTENT_ROLE_NAMES = Set.of(
            RoleName.ROLE_ADMIN.name(),
            RoleName.ROLE_TRAINING_OPS.name(),
            RoleName.ROLE_RND.name(),
            RoleName.ROLE_TEACHER.name(),
            RoleName.ROLE_MENTOR.name()
    );

    public static boolean canManageContent(AuthPrincipal user) {
        return user != null && CONTENT_ROLE_NAMES.stream().anyMatch(user::hasRole);
    }

    public static boolean canManageContent(Authentication auth) {
        if (auth == null) return false;
        if (auth.getPrincipal() instanceof AuthPrincipal principal && canManageContent(principal)) {
            return true;
        }
        return auth.getAuthorities().stream()
                .anyMatch(a -> CONTENT_ROLE_NAMES.contains(a.getAuthority()));
    }
}
