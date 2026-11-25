package pl.co.lms.controller;

import base.co.common.filter.principal.AuthPrincipal;
import base.co.common.web.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import pl.co.lms.dto.request.DictionarySessionData;
import pl.co.lms.dto.request.SaveDictionarySessionRequest;
import pl.co.lms.dto.response.DictionaryProfileResponse;
import pl.co.lms.service.DictionaryService;
import pl.co.lms.service.LearningResourceService;

import java.time.Instant;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DictionaryControllerTest {
    DictionaryService service;
    MockMvc mvc;
    ObjectMapper mapper=new ObjectMapper().findAndRegisterModules();
    @BeforeEach void setup() {
        service=mock(DictionaryService.class);
        mvc=MockMvcBuilders.standaloneSetup(new DictionaryController(service)).setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    private UsernamePasswordAuthenticationToken user() {
        return new UsernamePasswordAuthenticationToken(new AuthPrincipal("learner-1",true,Set.of("ROLE_STUDENT")),null,List.of());
    }
    @Test void requiresAuthenticationAndAlwaysUsesPrincipalOwnerEvenWhenCallerSuppliesOtherUser() throws Exception {
        mvc.perform(get("/dictionary/profile")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
        when(service.getProfile("learner-1")).thenReturn(DictionaryProfileResponse.empty());
        mvc.perform(get("/dictionary/profile?userId=someone-else").principal(user())).andExpect(status().isOk()).andExpect(jsonPath("$.data.goal").value(30));
        verify(service).getProfile("learner-1");
    }
    @Test void validatesGoalsAndNestedAnswerBoundsBeforeCallingService() throws Exception {
        mvc.perform(put("/dictionary/goal").principal(user()).contentType(MediaType.APPLICATION_JSON).content("{\"goal\":0}")).andExpect(status().isBadRequest());
        var data=new DictionarySessionData(1,List.of("word"),"content",1,0,List.of(),
                Map.of("word",new DictionarySessionData.Answer("x".repeat(2001),true,false,true)),Map.of(),Map.of(),false,Instant.now().toString(),null,null);
        mvc.perform(put("/dictionary/sessions/word").principal(user()).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(new SaveDictionarySessionRequest(null,false,data)))).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void lessonAndReviewParametersDoNotAllowReadingAnotherLearner() throws Exception {
        mvc.perform(get("/dictionary/sessions/word?review=true&userId=other").principal(user())).andExpect(status().isOk());
        verify(service).getSession("learner-1","word",true,null,null);
        mvc.perform(get("/dictionary/sessions").principal(user())).andExpect(status().isOk());
        verify(service).completedSessions("learner-1");
    }
    @Test void startingWordUsesTheAuthenticatedLearner() throws Exception {
        mvc.perform(post("/dictionary/words/word/start?userId=other").principal(user()))
                .andExpect(status().isOk());
        verify(service).startWord("learner-1", "word");
    }
    @Test void vocabularyDictionaryUsesTheSameRoutesAndProtectsDrafts() throws Exception {
        var resources = mock(LearningResourceService.class);
        var routes = MockMvcBuilders.standaloneSetup(new LearningResourceController(resources, null))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();

        routes.perform(get("/learning-resources/dictionary").param("keyword", "work"))
                .andExpect(status().isOk());
        verify(resources).searchVocabulary("work", null, null, null, null, 0, 20);

        try {
            SecurityContextHolder.getContext().setAuthentication(user());
            routes.perform(get("/learning-resources/dictionary").param("language", "zh")
                            .param("keyword", "hao").param("hskLevel", "1").param("includeDrafts", "true"))
                    .andExpect(status().isOk());
            verify(resources).searchPublishedDictionaryHanzi("hao", 1, null, null, null, 0, 20);
            verify(resources, never()).searchDictionaryHanzi(any(), any(), any(), any(), any(), anyInt(), anyInt());

            var admin = new AuthPrincipal("admin-1", true, Set.of("ROLE_ADMIN"));
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(admin, null, List.of()));
            routes.perform(get("/learning-resources/dictionary").param("language", "zh")
                            .param("keyword", "shu").param("includeDrafts", "true"))
                    .andExpect(status().isOk());
            verify(resources).searchDictionaryHanzi("shu", null, null, null, null, 0, 20);

            routes.perform(get("/learning-resources/dictionary").param("language", "zh").param("keyword", "shui"))
                    .andExpect(status().isOk());
            verify(resources).searchPublishedDictionaryHanzi("shui", null, null, null, null, 0, 20);
        } finally {
            SecurityContextHolder.clearContext();
        }

        routes.perform(get("/learning-resources/dictionary/word").param("language", "zh"))
                .andExpect(status().isOk());
        verify(resources).getPublishedDictionaryHanzi("word");
    }

}
