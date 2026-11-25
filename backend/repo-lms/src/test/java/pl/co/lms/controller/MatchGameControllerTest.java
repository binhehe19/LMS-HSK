package pl.co.lms.controller;

import base.co.common.filter.principal.AuthPrincipal;
import base.co.common.web.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import pl.co.lms.dto.request.StartMatchGameRequest;
import pl.co.lms.dto.response.MatchGameSessionResponse;
import pl.co.lms.entity.MatchGameSource;
import pl.co.lms.service.MatchGameService;
import java.util.List;
import java.util.Set;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MatchGameControllerTest {
    MatchGameService service;
    MockMvc mvc;
    @BeforeEach void setup() {
        SecurityContextHolder.clearContext(); service = mock(MatchGameService.class);
        mvc = MockMvcBuilders.standaloneSetup(new MatchGameController(service))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @Test void identityComesFromAuthenticationAndResponseUsesExistingEnvelope() throws Exception {
        var user = new AuthPrincipal("jwt-owner", true, Set.of("ROLE_STUDENT"));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, List.of()));
        when(service.start(eq("jwt-owner"), any())).thenReturn(new MatchGameSessionResponse("s", "key", MatchGameSource.DEMO, List.of(), 1));
        try {
            mvc.perform(post("/games/match/sessions").contentType("application/json").content("{\"source\":\"DEMO\",\"displayName\":\"Alice\",\"userId\":\"spoofed\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.data.id").value("s"));
            verify(service).start("jwt-owner", new StartMatchGameRequest(MatchGameSource.DEMO,"Alice"));
        } finally { SecurityContextHolder.clearContext(); }
    }
    @Test void validatesSourceAndNestedMovesBeforeService() throws Exception {
        for (String body : List.of("{}", "{\"source\":\"INVALID\"}")) mvc.perform(post("/games/match/sessions").contentType("application/json").content(body)).andExpect(status().isBadRequest());
        for (String body : List.of("{\"moves\":[],\"elapsedTenths\":0}", "{\"moves\":[{\"round\":-1,\"firstTileId\":\"\",\"secondTileId\":\"c-def\",\"pairTenths\":0,\"atTenths\":0}],\"elapsedTenths\":11}"))
            mvc.perform(post("/games/match/sessions/s/results").contentType("application/json").content(body)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
