package pl.co.lms.controller;

import base.co.common.filter.principal.AuthPrincipal;
import base.co.common.web.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import pl.co.lms.service.studymaterials.StudyMaterialService;
import pl.co.lms.service.studymaterials.StudyMaterialVocabularyService;
import java.util.List;
import java.util.Set;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class StudyMaterialControllerTest {
    StudyMaterialService service;
    StudyMaterialVocabularyService vocabulary;
    MockMvc mvc;
    @BeforeEach void setup() {
        service = mock(StudyMaterialService.class); vocabulary = mock(StudyMaterialVocabularyService.class);
        mvc = MockMvcBuilders.standaloneSetup(new StudyMaterialController(service), new StudyMaterialManagementController(service, vocabulary)).setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    private UsernamePasswordAuthenticationToken user(String role) {
        return new UsernamePasswordAuthenticationToken(new AuthPrincipal("learner-1", true, Set.of(role)), null, List.of());
    }
    @Test void requiresAuthenticationAndResolvesOwnerFromPrincipalOnly() throws Exception {
        mvc.perform(get("/study-materials/home")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
        mvc.perform(get("/study-materials/home?userId=someone-else").principal(user("ROLE_STUDENT"))).andExpect(status().isOk());
        verify(service).home("learner-1");
        mvc.perform(put("/study-materials/article/state?userId=someone-else").principal(user("ROLE_STUDENT")).contentType(MediaType.APPLICATION_JSON).content("{\"saved\":true}")).andExpect(status().isOk());
        verify(service).saveState(eq("learner-1"), eq("article"), argThat(request -> request.saved() && request.note() == null));
    }
    @Test void managementRequiresAdminForReadsWritesPublicationAndDetection() throws Exception {
        mvc.perform(get("/management/study-materials").principal(user("ROLE_STUDENT"))).andExpect(status().isForbidden());
        mvc.perform(delete("/management/study-materials/article").principal(user("ROLE_USER"))).andExpect(status().isForbidden());
        mvc.perform(post("/management/study-materials/article/publish").principal(user("ROLE_STUDENT")).contentType(MediaType.APPLICATION_JSON).content("{\"versionId\":\"version\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/management/study-materials/detect-vocabulary").principal(user("ROLE_STUDENT")).contentType(MediaType.APPLICATION_JSON).content("{\"paragraphs\":[{\"en\":\"Some text\"}]}")).andExpect(status().isForbidden());
        mvc.perform(get("/management/study-materials/vocabulary-units").principal(user("ROLE_STUDENT"))).andExpect(status().isForbidden());
        verifyNoInteractions(service, vocabulary);
        mvc.perform(get("/management/study-materials/article").principal(user("ROLE_ADMIN"))).andExpect(status().isOk());
        mvc.perform(get("/management/study-materials/article").principal(user("ROLE_TEACHER"))).andExpect(status().isOk());
        mvc.perform(get("/management/study-materials/article").principal(user("ROLE_RND"))).andExpect(status().isOk());
        verify(service, times(3)).managementDetail("article");
    }
    @Test void detectsWithinTheExplicitUnitAndListsOnlyAdminSourceOptions() throws Exception {
        mvc.perform(get("/management/study-materials/vocabulary-units").principal(user("ROLE_ADMIN"))).andExpect(status().isOk());
        verify(vocabulary).unitOptions();
        mvc.perform(post("/management/study-materials/detect-vocabulary").principal(user("ROLE_ADMIN")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"paragraphs\":[{\"en\":\"A word\"}],\"variants\":{},\"vocabularyUnit\":{\"packageVersionId\":\"package-v1\",\"sessionNo\":1}}"))
                .andExpect(status().isOk());
        verify(vocabulary).detect(anyList(), anyMap(), argThat(unit -> unit.packageVersionId().equals("package-v1") && unit.sessionNo() == 1));
    }
    @Test void validatesNotesPositionsAndVersionsBeforeInvokingService() throws Exception {
        mvc.perform(put("/study-materials/article/state").principal(user("ROLE_STUDENT")).contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"" + "x".repeat(301) + "\"}")).andExpect(status().isBadRequest());
        mvc.perform(put("/study-materials/article/progress").principal(user("ROLE_STUDENT")).contentType(MediaType.APPLICATION_JSON).content("{\"versionId\":\"v1\",\"position\":-1}")).andExpect(status().isBadRequest());
        mvc.perform(put("/study-materials/article/progress").principal(user("ROLE_STUDENT")).contentType(MediaType.APPLICATION_JSON).content("{\"position\":2}")).andExpect(status().isBadRequest());
        mvc.perform(post("/study-materials/article/recall").principal(user("ROLE_STUDENT")).contentType(MediaType.APPLICATION_JSON).content("{\"versionId\":\"v1\",\"answers\":{}}")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void rejectsUnknownCategoriesAndOversizedSearches() throws Exception {
        mvc.perform(get("/study-materials?category=unknown").principal(user("ROLE_STUDENT"))).andExpect(status().isBadRequest());
        mvc.perform(get("/study-materials").param("keyword", "x".repeat(501)).principal(user("ROLE_STUDENT"))).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void routesCatalogFiltersAndProgressToTheExistingAuthenticatedIdentity() throws Exception {
        mvc.perform(get("/study-materials?category=song-ngu&savedOnly=true&sources=Actual%20Tests&size=9").principal(user("ROLE_STUDENT"))).andExpect(status().isOk());
        verify(service).catalog(eq("learner-1"), argThat(filter -> filter.category().path().equals("song-ngu") && filter.savedOnly()), eq(0), eq(9));
        mvc.perform(put("/study-materials/article/progress").principal(user("ROLE_STUDENT")).contentType(MediaType.APPLICATION_JSON).content("{\"versionId\":\"v1\",\"position\":3,\"completed\":true}")).andExpect(status().isOk());
        verify(service).saveProgress(eq("learner-1"), eq("article"), argThat(request -> request.versionId().equals("v1") && request.position() == 3 && request.completed()));
    }
}
