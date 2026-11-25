package pl.co.lms.service;

import base.co.common.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pl.co.lms.dto.request.BlastGameHitRequest;
import pl.co.lms.dto.request.StartBlastGameRequest;
import pl.co.lms.dto.request.SubmitBlastGameRequest;
import pl.co.lms.entity.BlastGameEndReason;
import pl.co.lms.entity.BlastGameSession;
import pl.co.lms.entity.BlastGameSource;
import pl.co.lms.entity.json.VocabularyGameCard;
import pl.co.lms.repository.BlastGameSessionRepository;
import pl.co.lms.service.game.VocabularyGameDeckProvider;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BlastGameServiceTest {
    @Mock BlastGameSessionRepository sessions;
    @Mock VocabularyGameDeckProvider decks;
    ObjectMapper mapper=new ObjectMapper();
    BlastGameService service;
    @BeforeEach void setup() { service=new BlastGameService(sessions,decks,mapper); }
    @Test void createsOwnedDemoSnapshotWithOriginalSixSecondsPerWord() throws Exception {
        when(decks.datasetKey(anyList())).thenReturn("key");
        when(sessions.save(any())).thenAnswer(i->{BlastGameSession s=i.getArgument(0);s.setId("s");return s;});
        var result=service.start("owner",new StartBlastGameRequest(BlastGameSource.DEMO,"<b>Alice</b>"));
        assertThat(result.cards()).hasSize(12);assertThat(result.durationMs()).isEqualTo(72000);
        var captor=org.mockito.ArgumentCaptor.forClass(BlastGameSession.class);verify(sessions).save(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo("owner");assertThat(captor.getValue().getDisplayName()).isEqualTo("Alice");
        assertThat(mapper.readTree(captor.getValue().getCards())).hasSize(12);
    }
    @Test void libraryRequiresTwoUsableWordsNoFallbackAndOwnerRequired() {
        when(decks.library(32)).thenReturn(List.of(new VocabularyGameCard("c0","hello","xin chào")));
        assertThatThrownBy(()->service.start("owner",new StartBlastGameRequest(BlastGameSource.LIBRARY,null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.deck(null,BlastGameSource.DEMO)).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.result("other","s")).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->service.submit("other","s",request(2000))).isInstanceOf(ApiException.class);
        verify(sessions).findByIdAndUserIdAndDeletedFalse("s","other");verify(sessions).lockOwned("s","other");verify(sessions,never()).save(any());
    }
    @Test void originalBestRuleIsHigherScoreThenFasterTimeAndRetryStoresOnlyOnce() throws Exception {
        var session=session();when(sessions.lockOwned("s","owner")).thenReturn(Optional.of(session));
        var previous=new BlastGameSession();previous.setScore(2);previous.setElapsedMs(2500);
        when(sessions.findByDatasetKeyAndUserIdAndCompletedAtIsNotNullAndDeletedFalseOrderByScoreDescElapsedMsAsc(any(),any(),any())).thenReturn(List.of(previous),List.of(session),List.of(session));
        var result=service.submit("owner","s",request(2000));
        assertThat(result.score()).isEqualTo(2);assertThat(result.isNewBest()).isTrue();assertThat(result.bestElapsedMs()).isEqualTo(2000);
        assertThat(service.submit("owner","s",new SubmitBlastGameRequest(List.of(),12000,BlastGameEndReason.TIMEOUT))).isEqualTo(result);
        assertThat(mapper.readTree(session.getHits())).hasSize(2);verify(sessions,times(1)).saveAndFlush(session);
    }
    @Test void worseScoreOrSameScoreSlowerCannotReplacePersonalBest() throws Exception {
        var session=session();when(sessions.lockOwned("s","owner")).thenReturn(Optional.of(session));
        var previous=new BlastGameSession();previous.setScore(2);previous.setElapsedMs(1800);
        when(sessions.findByDatasetKeyAndUserIdAndCompletedAtIsNotNullAndDeletedFalseOrderByScoreDescElapsedMsAsc(any(),any(),any())).thenReturn(List.of(previous));
        var result=service.submit("owner","s",request(2000));
        assertThat(result.isNewBest()).isFalse();assertThat(result.bestElapsedMs()).isEqualTo(1800);
    }
    @Test void rejectsFutureTimeBeforeStoringResult() throws Exception {
        var session=session();session.setStartedAt(Instant.now());when(sessions.lockOwned("s","owner")).thenReturn(Optional.of(session));
        assertThatThrownBy(()->service.submit("owner","s",new SubmitBlastGameRequest(List.of(),12000,BlastGameEndReason.TIMEOUT))).isInstanceOf(ApiException.class);
        verify(sessions,never()).saveAndFlush(any());
    }
    BlastGameSession session() throws Exception {
        var s=new BlastGameSession();s.setId("s");s.setUserId("owner");s.setDatasetKey("key");s.setTotalWords(2);s.setStartedAt(Instant.now().minusSeconds(30));
        s.setCards(mapper.writeValueAsString(List.of(new VocabularyGameCard("c0","hello","xin chào"),new VocabularyGameCard("c1","world","thế giới"))));return s;
    }
    SubmitBlastGameRequest request(int elapsed) { return new SubmitBlastGameRequest(List.of(new BlastGameHitRequest("c0","c0",1000),new BlastGameHitRequest("c1","c1",1500)),elapsed,BlastGameEndReason.COMPLETED); }
}
