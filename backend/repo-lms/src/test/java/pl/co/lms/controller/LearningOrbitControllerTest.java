package pl.co.lms.controller;

import base.co.common.filter.principal.AuthPrincipal;
import base.co.common.exception.ApiException;
import jakarta.validation.Validation;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.beans.factory.annotation.Autowired;
import pl.co.lms.dto.request.UpdateLearningOrbitSpaceRequest;
import pl.co.lms.service.LearningOrbitService;

import java.time.ZoneId;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = LearningOrbitControllerTest.Config.class)
class LearningOrbitControllerTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean LearningOrbitService service() { return mock(LearningOrbitService.class); }
        @Bean LearningOrbitController controller(LearningOrbitService service) { return new LearningOrbitController(service); }
    }
    @Autowired LearningOrbitController controller;
    @Autowired LearningOrbitService service;
    @AfterEach void clear() { SecurityContextHolder.clearContext(); reset(service); }

    @Test void summaryDerivesStudentFromAuthenticatedPrincipal() {
        var auth = authentication("learner-1", "ROLE_STUDENT");
        controller.getSummary(auth, "Asia/Ho_Chi_Minh");
        verify(service).getSummary("learner-1", ZoneId.of("Asia/Ho_Chi_Minh"));
    }
    @Test void rejectsAnonymousAndInvalidTimezone() {
        assertThatThrownBy(() -> controller.getSummary(null, "UTC")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> controller.getSummary(authentication("learner-1", "ROLE_STUDENT"), "not-a-timezone")).isInstanceOf(ApiException.class);
        verifyNoInteractions(service);
    }
    @Test void studentCannotChangeSpaceScores() {
        SecurityContextHolder.getContext().setAuthentication(authentication("learner-1", "ROLE_STUDENT"));
        assertThatThrownBy(() -> controller.updateSpace("learner-2", new UpdateLearningOrbitSpaceRequest(3, 2, 3, 3, 2, null))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(service);
    }
    @Test void adminMayUpdateSpace() {
        SecurityContextHolder.getContext().setAuthentication(authentication("admin-1", "ROLE_ADMIN"));
        var request = new UpdateLearningOrbitSpaceRequest(3, 2, 3, 3, 2, null);
        controller.updateSpace("learner-1", request);
        verify(service).updateSpace("learner-1", request);
    }
    @Test void validatesFourSegmentRangeAndRecommendationLength() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(new UpdateLearningOrbitSpaceRequest(0, 5, null, 2, 3, "x".repeat(1001)))).hasSize(3);
            assertThat(factory.getValidator().validate(new UpdateLearningOrbitSpaceRequest(null, null, null, null, null, null))).isEmpty();
        }
    }
    private static UsernamePasswordAuthenticationToken authentication(String id, String role) {
        return new UsernamePasswordAuthenticationToken(new AuthPrincipal(id, true, Set.of(role)), null, List.of(new SimpleGrantedAuthority(role)));
    }
}
