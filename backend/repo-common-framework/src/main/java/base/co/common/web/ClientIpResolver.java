package base.co.common.web;

import jakarta.servlet.http.HttpServletRequest;
import base.co.common.security.SecurityConstants;
import base.co.common.util.StringUtils;

public final class ClientIpResolver {

    private ClientIpResolver() {
    }

    public static String resolve(HttpServletRequest request) {
        String clientIp = request.getHeader(SecurityConstants.HEADER_CLIENT_IP);
        if (StringUtils.hasText(clientIp)) {
            return clientIp.trim();
        }

        String realIp = request.getHeader("X-Real-IP");
        if (StringUtils.hasText(realIp)) {
            return realIp.trim();
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwardedFor)) {
            String[] parts = forwardedFor.split(",");
            if (parts.length > 0 && StringUtils.hasText(parts[0])) {
                return parts[0].trim();
            }
        }

        String remoteAddr = request.getRemoteAddr();
        return StringUtils.hasText(remoteAddr) ? remoteAddr : "unknown";
    }
}
