package pl.co.lms.client;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

// Token chuyển sang CMS: header Authorization, hoặc cookie access_token khi đăng nhập bằng cookie (không có header).
class CmsClientAuthorizationTest {

    @Test
    void usesAuthorizationHeaderWhenPresent() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer header-token");
        request.setCookies(new Cookie("access_token", "cookie-token"));

        assertThat(CmsClient.bearerOf(request)).isEqualTo("Bearer header-token");
    }

    @Test
    void fallsBackToAccessTokenCookie_whenNoHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("refresh_token", "refresh"), new Cookie("access_token", "cookie-token"));

        assertThat(CmsClient.bearerOf(request)).isEqualTo("Bearer cookie-token");
    }

    @Test
    void returnsNull_whenNeitherHeaderNorCookie() {
        assertThat(CmsClient.bearerOf(new MockHttpServletRequest())).isNull();

        MockHttpServletRequest onlyRefresh = new MockHttpServletRequest();
        onlyRefresh.setCookies(new Cookie("refresh_token", "refresh"));
        assertThat(CmsClient.bearerOf(onlyRefresh)).isNull();
    }

    @Test
    void ignoresBlankHeaderAndBlankCookie() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "  ");
        request.setCookies(new Cookie("access_token", " "));

        assertThat(CmsClient.bearerOf(request)).isNull();
    }
}
