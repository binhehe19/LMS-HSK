package base.co.common.util;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import base.co.common.filter.principal.AuthPrincipal;
import base.co.common.security.RoleName;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

public final class AuthUtils {

    private AuthUtils() {
    }

    public static void requireAuthenticated(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }
    }

    public static AuthPrincipal getPrincipal(Authentication authentication) {
        requireAuthenticated(authentication);
        if (authentication.getPrincipal() instanceof AuthPrincipal principal) {
            return principal;
        }
        throw new ApiException(ErrorCode.UNAUTHORIZED);
    }

    public static String resolveUserId(Authentication authentication) {
        return getPrincipal(authentication).userId();
    }

    public static String resolveEmail(Authentication authentication) {
        return getPrincipal(authentication).email();
    }

    public static Set<String> resolveRoles(Authentication authentication) {
        requireAuthenticated(authentication);
        if (authentication.getPrincipal() instanceof AuthPrincipal principal
                && principal.roles() != null
                && !principal.roles().isEmpty()) {
            return Set.copyOf(principal.roles());
        }
        if (authentication.getAuthorities() == null) {
            return Set.of();
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(StringUtils::hasText)
                .map(AuthUtils::normalizeRole)
                .collect(Collectors.toUnmodifiableSet());
    }

    public static boolean hasRole(Authentication authentication, RoleName role) {
        if (role == null) {
            return false;
        }
        return resolveRoles(authentication).contains(role.name());
    }

    public static boolean hasAnyRole(Authentication authentication, RoleName... roles) {
        if (roles == null || roles.length == 0) {
            return false;
        }
        Set<String> currentRoles = resolveRoles(authentication);
        return Arrays.stream(roles)
                .filter(java.util.Objects::nonNull)
                .map(RoleName::name)
                .anyMatch(currentRoles::contains);
    }

    public static boolean isAdmin(Authentication authentication) {
        return hasRole(authentication, RoleName.ROLE_ADMIN);
    }

    public static boolean isService(Authentication authentication) {
        return hasRole(authentication, RoleName.ROLE_SERVICE);
    }

    private static String normalizeRole(String role) {
        String normalized = role.trim().toUpperCase();
        if (!normalized.startsWith("ROLE_")) {
            normalized = "ROLE_" + normalized;
        }
        return normalized;
    }
}
