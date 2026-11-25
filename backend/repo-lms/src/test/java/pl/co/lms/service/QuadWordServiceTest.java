package pl.co.lms.service;

import base.co.common.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pl.co.lms.dto.request.*;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.*;
import pl.co.lms.repository.QuadWordSessionRepository;
import pl.co.lms.service.game.QuadWordCandidateProvider;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class QuadWordServiceTest {
    QuadWordSessionRepository sessions = mock(QuadWordSessionRepository.class);
    QuadWordCandidateProvider candidates = mock(QuadWordCandidateProvider.class);
    ObjectMapper mapper = new ObjectMapper();
    QuadWordService service = new QuadWordService(sessions, candidates, mapper);
    QuadWordSession session;
    @BeforeEach void session() throws Exception {
        session = new QuadWordSession(); session.setId("s"); session.setUserId("owner"); session.setSource(QuadWordSource.VOCABULARY);
        session.setStatus(QuadWordStatus.PLAYING); session.setExpiresAt(Instant.now().plusSeconds(86400));
        session.setGuesses("[]"); session.setCandidate(mapper.writeValueAsString(candidate("hotel")));
    }
    @Test void createsFrozenSessionAndConcealsAllAnswerFields() throws Exception {
        var c = candidate("hotel");
        when(candidates.candidates()).thenReturn(List.of(c));
        when(candidates.choose(List.of(c), null)).thenReturn(c);
        when(sessions.save(any())).thenAnswer(i -> { QuadWordSession s = i.getArgument(0); s.setId("new"); return s; });
        var response = service.start("owner", new StartQuadWordRequest(QuadWordSource.VOCABULARY));
        assertThat(response.pattern()).isEqualTo("_____"); assertThat(response.remaining()).isEqualTo(6);
        assertThat(response.review()).isNull();
        assertThat(mapper.writeValueAsString(response)).doesNotContain("hotel", "resourceVersionId", "candidate", "hint", "khách sạn", "A place to stay");
    }
    @Test void emptyLibraryIsExplicitAndNeverUsesDemo() {
        when(candidates.candidates()).thenReturn(List.of());
        when(candidates.choose(List.of(), null)).thenReturn(null);
        assertThat(service.start("owner", new StartQuadWordRequest(QuadWordSource.VOCABULARY))).isNull();
        verify(sessions, never()).save(any());
    }
    @Test void retryOfAnAcceptedGuessDoesNotSpendAnotherTurnEvenAfterWinning() {
        when(sessions.lockOwned("s", "owner")).thenReturn(Optional.of(session));
        var payload = new SubmitQuadWordGuessRequest("request-1", "hotel", 0);
        var won = service.guess("owner", "s", payload);
        var retry = service.guess("owner", "s", payload);
        assertThat(won.status()).isEqualTo(QuadWordStatus.WON); assertThat(retry).isEqualTo(won);
        assertThat(retry.review().answer()).isEqualTo("hotel"); verify(sessions, times(1)).saveAndFlush(any());
        assertThat(retry.review().meaning()).isEqualTo("khách sạn");
        assertThatThrownBy(() -> service.guess("owner", "s", new SubmitQuadWordGuessRequest("request-1", "hello", 0))).isInstanceOf(ApiException.class);
    }
    @Test void invalidDuplicateAndStaleGuessesDoNotSpendATurn() {
        when(sessions.lockOwned("s", "owner")).thenReturn(Optional.of(session));
        assertThatThrownBy(() -> service.guess("owner", "s", new SubmitQuadWordGuessRequest("r1", "hot", 0))).isInstanceOf(ApiException.class);
        var next = service.guess("owner", "s", new SubmitQuadWordGuessRequest("r2", "hello", 0));
        assertThat(next.review()).isNull(); assertThat(next.remaining()).isEqualTo(5);
        assertThatThrownBy(() -> service.guess("owner", "s", new SubmitQuadWordGuessRequest("r3", "HELLO", 1))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.guess("owner", "s", new SubmitQuadWordGuessRequest("r4", "aaaaa", 0))).isInstanceOf(ApiException.class);
        verify(sessions, times(1)).saveAndFlush(any());
    }
    @Test void sixWrongGuessesEndTheSessionAndReloadReadsTheSnapshot() {
        when(sessions.lockOwned("s", "owner")).thenReturn(Optional.of(session));
        when(sessions.findByIdAndUserIdAndDeletedFalse("s", "owner")).thenReturn(Optional.of(session));
        for (int i = 0; i < 6; i++) service.guess("owner", "s", new SubmitQuadWordGuessRequest("r" + i, String.valueOf((char)('a' + i)).repeat(5), i));
        var result = service.get("owner", "s");
        assertThat(result.remaining()).isZero(); assertThat(result.status()).isEqualTo(QuadWordStatus.LOST);
        assertThat(result.review().answer()).isEqualTo("hotel"); assertThat(result.guesses()).hasSize(6);
        assertThat(result.review().meaning()).isEqualTo("khách sạn");
        assertThatThrownBy(() -> service.guess("owner", "s", new SubmitQuadWordGuessRequest("new", "hotel", 5))).isInstanceOf(ApiException.class);
        verifyNoInteractions(candidates);
    }
    @Test void legacySnapshotsConcealOldHintsUntilTheSessionEnds() throws Exception {
        session.setCandidate(session.getCandidate().replace("\"meaning\":", "\"hint\":"));
        when(sessions.findByIdAndUserIdAndDeletedFalse("s", "owner")).thenReturn(Optional.of(session));
        when(sessions.lockOwned("s", "owner")).thenReturn(Optional.of(session));
        var playing = service.get("owner", "s");
        assertThat(playing.review()).isNull();
        assertThat(mapper.writeValueAsString(playing)).doesNotContain("hotel", "khách sạn", "hint");
        var won = service.guess("owner", "s", new SubmitQuadWordGuessRequest("win", "hotel", 0));
        assertThat(won.review().meaning()).isEqualTo("khách sạn");
        assertThat(service.get("owner", "s").review()).isEqualTo(won.review());
    }
    @Test void ownerAuthenticationAndExpiryAreRequired() {
        assertThatThrownBy(() -> service.get(null, "s")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.get("other", "s")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.guess("other", "s", new SubmitQuadWordGuessRequest("r", "hotel", 0))).isInstanceOf(ApiException.class);
        when(sessions.findByIdAndUserIdAndDeletedFalse("s", "owner")).thenReturn(Optional.of(session));
        session.setExpiresAt(Instant.now().minusSeconds(1));
        assertThatThrownBy(() -> service.get("owner", "s")).isInstanceOf(ApiException.class);
        verify(sessions, never()).saveAndFlush(any());
    }
    private QuadWordCandidate candidate(String answer) {
        return new QuadWordCandidate("r", "v", answer, "khách sạn", new QuadWordReview(answer, "A place to stay", null, null, null, null, null, null));
    }

    @Test void collectionSelectionPersistsTitleAndSkipsWordsAlreadyLearned() {
        var learned = new QuadWordCandidate("known", "v1", "hotel", "khách sạn", candidate("hotel").review());
        var next = new QuadWordCandidate("next", "v2", "ocean", "đại dương", candidate("ocean").review());
        var collection = new QuadWordCandidateProvider.Collection("B2", "500 từ vựng IELTS B2", List.of(learned, next));
        when(candidates.collections()).thenReturn(List.of(collection));
        when(sessions.learnedResourceIds("owner", "B2")).thenReturn(List.of("known"));
        when(candidates.choose(List.of(next), null)).thenReturn(next);
        when(sessions.save(any())).thenAnswer(invocation -> { QuadWordSession value = invocation.getArgument(0); value.setId("new"); return value; });
        var result = service.start("owner", new StartQuadWordRequest(QuadWordSource.VOCABULARY, "B2"));
        assertThat(result.collection().id()).isEqualTo("B2");
        assertThat(result.collection().title()).isEqualTo("500 từ vựng IELTS B2");
        assertThat(result.collection().learned()).isEqualTo(1);
        var saved = org.mockito.ArgumentCaptor.forClass(QuadWordSession.class);
        verify(sessions).save(saved.capture());
        assertThat(saved.getValue().getCandidateResourceId()).isEqualTo("next");
        assertThat(saved.getValue().getCollectionKey()).isEqualTo("B2");
        assertThatThrownBy(() -> service.start("owner", new StartQuadWordRequest(QuadWordSource.VOCABULARY, "C2"))).isInstanceOf(ApiException.class);
    }

    @Test void collectionProgressIsAccountScopedAndDoesNotExposeAnswers() throws Exception {
        var c = candidate("hotel");
        when(candidates.collections()).thenReturn(List.of(new QuadWordCandidateProvider.Collection("B2", "B2 words", List.of(c))));
        when(sessions.learnedResourceIds("owner", "B2")).thenReturn(List.of("r", "removed-resource"));
        when(sessions.learnedResourceIds("other", "B2")).thenReturn(List.of());
        assertThat(service.collections("owner").getFirst().learned()).isEqualTo(1);
        assertThat(service.collections("other").getFirst().learned()).isZero();
        assertThat(mapper.writeValueAsString(service.collections("owner"))).doesNotContain("hotel", "resourceVersionId", "answer");
        assertThatThrownBy(() -> service.collections(null)).isInstanceOf(ApiException.class);
    }
}
