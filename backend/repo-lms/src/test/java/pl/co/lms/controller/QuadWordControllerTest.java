package pl.co.lms.controller;

import base.co.common.filter.principal.AuthPrincipal;
import base.co.common.web.GlobalExceptionHandler;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import pl.co.lms.dto.request.StartQuadWordRequest;
import pl.co.lms.dto.response.QuadWordSessionResponse;
import pl.co.lms.entity.*;
import pl.co.lms.service.QuadWordService;
import java.util.List;
import java.util.Set;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class QuadWordControllerTest {
    QuadWordService service;
    MockMvc mvc;
    @BeforeEach void setup() {
        SecurityContextHolder.clearContext(); service = mock(QuadWordService.class);
        mvc = MockMvcBuilders.standaloneSetup(new QuadWordController(service))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void usesJwtIdentityAndDoesNotExposeAnAnswerWhilePlaying() throws Exception {
        var principal = new AuthPrincipal("owner", true, Set.of("ROLE_STUDENT"));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
        when(service.start(eq("owner"), any())).thenReturn(new QuadWordSessionResponse("s", QuadWordSource.VOCABULARY,
                "_____", 5, List.of(), 6, QuadWordStatus.PLAYING, null));
        mvc.perform(post("/games/quad-word/sessions").contentType("application/json")
                .content("{\"source\":\"VOCABULARY\",\"userId\":\"spoofed\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("playing"))
                .andExpect(jsonPath("$.data.answer").doesNotExist()).andExpect(jsonPath("$.data.review").isEmpty())
                .andExpect(jsonPath("$.data.hint").doesNotExist()).andExpect(jsonPath("$.data.meaning").doesNotExist());
        verify(service).start("owner", new StartQuadWordRequest(QuadWordSource.VOCABULARY));
    }
    @Test void validatesSourceAndGuessPayloadsBeforeEnteringService() throws Exception {
        for (String body : List.of("{}", "{\"source\":\"DEMO\"}", "{\"source\":\"GRAMMAR\"}"))
            mvc.perform(post("/games/quad-word/sessions").contentType("application/json").content(body)).andExpect(status().isBadRequest());
        for (String body : List.of("{}", "{\"requestId\":\"r\",\"input\":\"hotel\"}",
                "{\"requestId\":\"r\",\"input\":\"hotel\",\"expectedGuessCount\":6}"))
            mvc.perform(post("/games/quad-word/sessions/s/guesses").contentType("application/json").content(body)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void emptyLibraryIsNoContentRatherThanDemoFallback() throws Exception {
        mvc.perform(post("/games/quad-word/sessions").contentType("application/json").content("{\"source\":\"VOCABULARY\"}"))
                .andExpect(status().isNoContent());
    }
}
