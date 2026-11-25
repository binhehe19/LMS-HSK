package base.co.common.security;

public final class SecurityConstants {
    private SecurityConstants() {
    }

    // ----- Headers -----
    public static final String HEADER_AUTHORIZATION = "Authorization";
    public static final String HEADER_BEARER_PREFIX = "Bearer ";
    public static final String HEADER_REQUEST_ID = "X-Request-Id";
    // Upstream identity propagation
    public static final String HEADER_USER_ID = "X-User-Id";
    public static final String HEADER_ROLES = "X-Roles";
    // Exam additions
    public static final String HEADER_SESSION_ID = "X-Session-Id";
    public static final String HEADER_CLIENT_IP = "X-Client-IP";
    public static final String HEADER_INTERNAL_TOKEN = "X-Internal-Token";

    // ----- Cookies -----
    public static final String COOKIE_ACCESS_TOKEN = "access_token";
    public static final String COOKIE_REFRESH_TOKEN = "refresh_token";

    // ----- JWT Claims -----
    public static final String CLAIM_USER_ID = "uid";
    public static final String CLAIM_USER_CODE = "user_code";
    public static final String CLAIM_EMAIL = "email";
    public static final String CLAIM_ROLES = "roles";
    public static final String CLAIM_EMAIL_VERIFIED = "email_verified";
    public static final String CLAIM_TYPE = "typ";
    public static final String CLAIM_PARENT_JTI = "prt";

    // ----- JWT typ values -----
    public static final String TYP_ACCESS = "access";
    public static final String TYP_REFRESH = "refresh";
    public static final String TYP_INTERNAL = "internal";

    // ----- JWT audience values -----
    public static final String AUD_EXTERNAL = "external";
    public static final String AUD_INTERNAL = "internal";
}
