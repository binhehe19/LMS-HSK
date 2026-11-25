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
import pl.co.lms.dto.request.StartBlastGameRequest;
import pl.co.lms.dto.response.BlastGameSessionResponse;
import pl.co.lms.entity.BlastGameSource;
import pl.co.lms.service.BlastGameService;
import java.util.List;
import java.util.Set;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class BlastGameControllerTest {
    BlastGameService service;
    MockMvc mvc;
    @BeforeEach void setup() {
        SecurityContextHolder.clearContext();service=mock(BlastGameService.class);
        mvc=MockMvcBuilders.standaloneSetup(new BlastGameController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @Test void authenticatedIdentityAndExistingEnvelope() throws Exception {
        var user=new AuthPrincipal("jwt-owner",true,Set.of("ROLE_STUDENT"));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user,null,List.of()));
        when(service.start(eq("jwt-owner"),any())).thenReturn(new BlastGameSessionResponse("s","key",BlastGameSource.DEMO,List.of(),72000));
        try {
            mvc.perform(post("/games/blast/sessions").contentType("application/json").content("{\"source\":\"DEMO\",\"displayName\":\"Alice\",\"userId\":\"spoofed\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.data.durationMs").value(72000));
            verify(service).start("jwt-owner",new StartBlastGameRequest(BlastGameSource.DEMO,"Alice"));
        } finally { SecurityContextHolder.clearContext(); }
    }
    @Test void validatesSourceReasonAndHitsBeforeService() throws Exception {
        for(String body:List.of("{}","{\"source\":\"INVALID\"}")) mvc.perform(post("/games/blast/sessions").contentType("application/json").content(body)).andExpect(status().isBadRequest());
        for(String body:List.of("{\"hits\":null,\"elapsedMs\":12000,\"reason\":\"TIMEOUT\"}","{\"hits\":[],\"elapsedMs\":12000,\"reason\":\"INVALID\"}",
                "{\"hits\":[{\"questionCardId\":\"\",\"cardId\":\"c0\",\"atMs\":-1}],\"elapsedMs\":12000,\"reason\":\"TIMEOUT\"}"))
            mvc.perform(post("/games/blast/sessions/s/results").contentType("application/json").content(body)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
