package pl.co.lms.service;

import base.co.common.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import pl.co.lms.dto.request.*;
import pl.co.lms.dto.response.MatchGameCardResponse;
import pl.co.lms.entity.*;
import pl.co.lms.repository.*;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MatchGameServiceTest {
    @Mock MatchGameSessionRepository sessions;
    @Mock LearningResourceVersionRepository versions;
    ObjectMapper mapper = new ObjectMapper();
    MatchGameService service;
    @BeforeEach void setup() { service = new MatchGameService(sessions, new pl.co.lms.service.game.VocabularyGameDeckProvider(versions, mapper), mapper); }
    @Test void authenticatedDemoCreatesFrozenDeckAndStableDataset() throws Exception {
        when(sessions.save(any())).thenAnswer(i -> { MatchGameSession s = i.getArgument(0); s.setId("session"); return s; });
        var result = service.start("owner",new StartMatchGameRequest(MatchGameSource.DEMO,"<b>Alice</b>"));
        assertThat(result.cards()).hasSize(12); assertThat(result.totalRounds()).isEqualTo(2);
        var shuffled = new ArrayList<>(result.cards()); Collections.reverse(shuffled);
        assertThat(service.datasetKey(shuffled)).isEqualTo(result.datasetKey());
        shuffled.set(0,new MatchGameCardResponse(shuffled.getFirst().id(),"changed","meaning"));
        assertThat(service.datasetKey(shuffled)).isNotEqualTo(result.datasetKey());
        var captor=org.mockito.ArgumentCaptor.forClass(MatchGameSession.class); verify(sessions).save(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo("owner"); assertThat(captor.getValue().getDisplayName()).isEqualTo("Alice");
        assertThat(mapper.readTree(captor.getValue().getCards())).hasSize(12);
        verifyNoInteractions(versions);
    }
    @Test void libraryStartsFromDictionaryCommonMeaningWithoutDefinitions() {
        var good=version("vg","good",LearningResourceVersionStatus.PUBLISHED);
        good.setContent("{\"word\":\"<b>hello</b>\",\"commonMeaning\":\"<b>xin chào</b>\"}");
        when(versions.findPublishedGameContent(eq(LearningResourceType.VOCABULARY),any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(good)));
        when(sessions.save(any())).thenAnswer(i -> { MatchGameSession s = i.getArgument(0);s.setId("session");return s; });
        var result=service.start("owner",new StartMatchGameRequest(MatchGameSource.LIBRARY,null));
        assertThat(result.cards()).containsExactly(new MatchGameCardResponse("good","hello","xin chào"));
    }
    @Test void noSilentDemoFallbackAndOwnershipChecks() {
        when(versions.findPublishedGameContent(any(),any())).thenReturn(new PageImpl<>(List.of()));
        assertThatThrownBy(() -> service.start("owner",new StartMatchGameRequest(MatchGameSource.LIBRARY,null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.start(null,new StartMatchGameRequest(MatchGameSource.DEMO,null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.result("other","session")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.submit("other","session",new SubmitMatchGameRequest(List.of(),0))).isInstanceOf(ApiException.class);
        verify(sessions).findByIdAndUserIdAndDeletedFalse("session","other");verify(sessions).lockOwned("session","other");verify(sessions,never()).save(any());
    }
    @Test void submitRecomputesScoreStoresOnceAndRetryIsIdempotent() throws Exception {
        var session=new MatchGameSession();session.setId("s");session.setUserId("owner");session.setDatasetKey("key");session.setStartedAt(Instant.now().minusSeconds(30));
        session.setCards(mapper.writeValueAsString(List.of(new MatchGameCardResponse("c0","hello","xin chào"))));
        when(sessions.lockOwned("s","owner")).thenReturn(Optional.of(session));
        when(sessions.findByDatasetKeyAndUserIdAndCompletedAtIsNotNullAndDeletedFalseOrderByScoreDescElapsedTenthsAsc(eq("key"),eq("owner"),any()))
                .thenReturn(List.of(),List.of(session),List.of(session));
        var request=new SubmitMatchGameRequest(List.of(new MatchGameMoveRequest(0,"c0-term","c0-def",53,53)),64);
        var result=service.submit("owner","s",request);
        assertThat(result.score()).isEqualTo(149);assertThat(result.isNewBest()).isTrue();assertThat(session.getCompletedAt()).isNotNull();
        assertThat(mapper.readTree(session.getMoves())).hasSize(1);
        assertThat(service.submit("owner","s",new SubmitMatchGameRequest(List.of(),0))).isEqualTo(result);
        verify(sessions,times(1)).saveAndFlush(session);
    }
    @Test void tieUsesFasterTimeAndFutureClockRejected() throws Exception {
        var session=new MatchGameSession();session.setId("s");session.setUserId("owner");session.setDatasetKey("k");session.setStartedAt(Instant.now().minusSeconds(30));
        session.setCards(mapper.writeValueAsString(List.of(new MatchGameCardResponse("c0","hello","xin chào"))));
        when(sessions.lockOwned("s","owner")).thenReturn(Optional.of(session));
        var best=new MatchGameSession();best.setScore(160);best.setElapsedTenths(10);
        when(sessions.findByDatasetKeyAndUserIdAndCompletedAtIsNotNullAndDeletedFalseOrderByScoreDescElapsedTenthsAsc(any(),any(),any())).thenReturn(List.of(best));
        var result=service.submit("owner","s",new SubmitMatchGameRequest(List.of(new MatchGameMoveRequest(0,"c0-term","c0-def",0,0)),11));
        assertThat(result.isNewBest()).isFalse();assertThat(result.bestElapsedTenths()).isEqualTo(10);
        session.setCompletedAt(null);session.setStartedAt(Instant.now());
        assertThatThrownBy(() -> service.submit("owner","s",new SubmitMatchGameRequest(List.of(new MatchGameMoveRequest(0,"c0-term","c0-def",0,1000)),1011))).isInstanceOf(ApiException.class);
    }
    private LearningResourceVersion version(String id,String resource,LearningResourceVersionStatus status) {
        var v=new LearningResourceVersion();v.setId(id);v.setResourceId(resource);v.setStatus(status);
        v.setContent("{\"word\":\"<b>hello</b>\",\"definitions\":[{\"meaningVi\":\"<script>bad()</script>xin chào\"}]}");return v;
    }
}
