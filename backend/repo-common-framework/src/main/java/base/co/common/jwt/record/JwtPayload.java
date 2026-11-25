package base.co.common.jwt.record;

import java.util.Set;

/**
 * Decoded JWT payload. {@code email} is optional — populated when the token
 * carries an "email" claim, null otherwise.
 */
public record JwtPayload(String jti,
                         String userId,
                         String email,
                         Set<String> roles,
                         boolean emailVerified,
                         String type,
                         String parentJti) {

    /** Convenience constructor for callers that don't have an email claim. */
    public JwtPayload(String jti, String userId, Set<String> roles,
                      boolean emailVerified, String type, String parentJti) {
        this(jti, userId, null, roles, emailVerified, type, parentJti);
    }
}
