package pl.co.lms.controller;

import base.co.common.filter.principal.AuthPrincipal;
import base.co.common.web.GlobalExceptionHandler;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import pl.co.lms.service.StudentPortalService;
import java.util.List;
import java.util.Set;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class StudentPortalControllerTest {
    StudentPortalService service;
    MockMvc mvc;
    final UsernamePasswordAuthenticationToken user = new UsernamePasswordAuthenticationToken(new AuthPrincipal("owner", true, Set.of()), null, List.of());
    @BeforeEach void setup() {
        service = mock(StudentPortalService.class);
        mvc = MockMvcBuilders.standaloneSetup(new StudentPortalController(service)).setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @Test void ignoresUserIdQueryAndUsesAuthenticatedOwner() throws Exception {
        when(service.favorites("owner", null, null, 0, 12, "newest")).thenReturn(new StudentPortalService.PortalPage<>(List.of(), 0, 0, 0, 12));
        mvc.perform(get("/me/favorites?userId=victim").principal(user)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0)).andExpect(jsonPath("$.data.items").isArray());
        verify(service).favorites("owner", null, null, 0, 12, "newest");
        mvc.perform(delete("/me/favorites/resource?userId=victim").principal(user)).andExpect(status().isOk());
        verify(service).removeFavorite("owner", "resource");
    }
    @Test void rejectsMissingIdentity() throws Exception {
        mvc.perform(get("/me/profile")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }
    @Test void rejectsOutOfRangeGoalsBeforeCallingService() throws Exception {
        mvc.perform(put("/me/profile").principal(user).contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetBand\":10,\"weeklyMinutes\":1,\"leaderboardVisible\":true}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void acceptsClearingOptionalGoals() throws Exception {
        when(service.saveProfile(eq("owner"), any())).thenReturn(new StudentPortalService.Profile(null, null, null, 150, false));
        mvc.perform(put("/me/profile").principal(user).contentType(MediaType.APPLICATION_JSON)
                .content("{\"publicName\":null,\"targetBand\":null,\"targetDate\":null,\"weeklyMinutes\":150,\"leaderboardVisible\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.weeklyMinutes").value(150))
                .andExpect(jsonPath("$.data.leaderboardVisible").value(false));
    }
}
