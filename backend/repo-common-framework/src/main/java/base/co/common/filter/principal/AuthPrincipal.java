package base.co.common.filter.principal;

import java.io.Serial;
import java.io.Serializable;
import java.security.Principal;
import java.util.Collection;
import java.util.Set;

/**
 * Authentication principal carried by {@code BearerTokenAuthenticationFilter}.
 * The {@code email} field is optional — services that don't put email in JWT
 * can leave it null without breaking equality/hashCode semantics of records.
 */
public record AuthPrincipal(String userId, String email, boolean emailVerified, Set<String> roles)
        implements Principal, Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    /** Convenience constructor for callers that don't have an email. */
    public AuthPrincipal(String userId, boolean emailVerified, Set<String> roles) {
        this(userId, null, emailVerified, roles);
    }

    @Override
    public String getName() {
        return email != null ? email : userId;
    }

    public boolean hasRole(String role) {
        return roles != null && roles.contains(role);
    }

    public boolean hasAnyRole(Collection<String> candidate) {
        return roles != null && candidate.stream().anyMatch(roles::contains);
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }
}
