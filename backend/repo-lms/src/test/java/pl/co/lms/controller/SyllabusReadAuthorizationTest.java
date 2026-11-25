package pl.co.lms.controller;

import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.AccessDeniedException;
import pl.co.lms.client.CmsClient;
import pl.co.lms.client.dto.CmsSyllabusDetail;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class SyllabusReadAuthorizationTest {

    @Configuration
    @EnableMethodSecurity
    static class Config {

        @Bean
        CmsClient cms() {
            return mock(CmsClient.class);
        }

        @Bean
        SyllabusController controller(CmsClient cms) {
            return new SyllabusController(cms);
        }

    }

    @AfterEach
    void logout() {
        SecurityContextHolder.clearContext();
    }

    private void login(String role) {
        SecurityContextHolder.getContext()
            .setAuthentication(
                    new UsernamePasswordAuthenticationToken("user", "", List.of(new SimpleGrantedAuthority(role))));
    }

    @Test
    void warmDataNeverBypassesStudentAuthorization() {
        try (var context = new AnnotationConfigApplicationContext(Config.class)) {
            var cms = context.getBean(CmsClient.class);
            var controller = context.getBean(SyllabusController.class);
            when(cms.getSyllabusDetail("s")).thenReturn(new CmsSyllabusDetail());
            login("ROLE_ADMIN");
            controller.getSyllabusDetail("s");
            login("ROLE_STUDENT");
            assertThatThrownBy(() -> controller.getSyllabusDetail("s")).isInstanceOf(AccessDeniedException.class);
            verify(cms, times(1)).getSyllabusDetail("s");
            assertThatThrownBy(controller::evictCache).isInstanceOf(AccessDeniedException.class);
        }
    }

}
