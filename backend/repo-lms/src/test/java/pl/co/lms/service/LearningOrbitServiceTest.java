package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pl.co.lms.dto.request.UpdateLearningOrbitSpaceRequest;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.repository.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LearningOrbitServiceTest {
    @Mock LearningOrbitSpaceRepository space;
    @Mock AssessmentAttemptRepository attempts;
    @Mock AssessmentAnswerRepository answers;
    @Mock LearningResourceRepository resources;
    @Mock LearningResourceVersionRepository versions;
    @Mock LearningResourceStateRepository states;
    private final ObjectMapper mapper = new ObjectMapper();
    private LearningOrbitService service;

    @BeforeEach void setup() { service = new LearningOrbitService(space, attempts, answers, resources, versions, states, mapper); }

    @Test void newLearnerHasNoInventedScoresAndQueriesAreScopedToTheCaller() {
        var result = service.getSummary("learner-1", ZoneId.of("Asia/Ho_Chi_Minh"));
        assertThat(result.space().steps()).hasSize(5).allMatch(s -> s.level() == null);
        assertThat(result.band().skills()).hasSize(4).allMatch(s -> s.results().isEmpty());
        assertThat(result.achievement().completedAttempts()).isZero();
        verify(attempts).findByUserIdAndStatusInAndDeletedFalse(eq("learner-1"), anyCollection());
        verify(states).findPublishedLibraryVocabularyStates("learner-1");
        verify(space).findByUserIdAndDeletedFalse("learner-1");
        verifyNoInteractions(answers, versions);
    }

    @Test void bandUsesSubmissionOrderAndKeepsScoreScaleAndProvisionalFlag() {
        var old = attempt("old", 20, 40, "2026-10-01T10:00:00Z"); old.setUpdatedAt(Instant.parse("2026-10-12T10:00:00Z"));
        var latest = attempt("latest", 30, 40, "2026-10-02T10:00:00Z");
        var pending = attempt("pending", 39, 40, "2026-10-03T10:00:00Z"); pending.setGradingStatus(AssessmentGradingStatus.PENDING);
        when(attempts.findByUserIdAndStatusInAndDeletedFalse(eq("learner-1"), anyCollection())).thenReturn(List.of(old, latest, pending));
        var answer = AssessmentAnswer.builder().attemptId("latest").gradingStatus(AssessmentAnswerGradingStatus.AI_GRADED).build();
        when(answers.findByAttemptIdInAndDeletedFalse(anyCollection())).thenReturn(List.of(answer));
        var version = new LearningResourceVersion(); version.setId("version-1");
        version.setContentFrom(QuizContent.builder().layout(mapper.createObjectNode().set("meta", mapper.createObjectNode().put("scoreDisplay", "IELTS_READING_BAND"))).build(), mapper);
        when(versions.findByIdInAndDeletedFalse(anyList())).thenReturn(List.of(version));
        var reading = service.getSummary("learner-1", ZoneId.of("UTC")).band().skills().stream().filter(s -> s.key().equals("READING")).findFirst().orElseThrow();
        assertThat(reading.results()).hasSize(2);
        assertThat(reading.results().getFirst().earned()).isEqualByComparingTo("30");
        assertThat(reading.results().getFirst().scoreDisplay()).isEqualTo("IELTS_READING_BAND");
        assertThat(reading.results().getFirst().provisional()).isTrue();
    }

    @Test void vocabularyOnlyCountsPublishedLibraryStatesAndRespectsExplicitUnknown() {
        when(resources.countByTypeAndSubTypeAndInLibraryTrueAndPublishedVersionIdIsNotNullAndDeletedFalse(LearningResourceType.VOCABULARY, "EN")).thenReturn(5L);
        var a = LearningResourceState.builder().learningResourceId("a").comprehensionLevel(VocabularyComprehensionLevel.KNOWN).saved(true).build();
        var b = LearningResourceState.builder().learningResourceId("b").comprehensionLevel(VocabularyComprehensionLevel.UNKNOWN).status(FlashcardStatus.LEARNED).build();
        var c = LearningResourceState.builder().learningResourceId("c").status(FlashcardStatus.LEARNING).reviewAt(Instant.EPOCH).build();
        when(states.findPublishedLibraryVocabularyStates("learner-1")).thenReturn(List.of(a, b, c));
        var result = service.getSummary("learner-1", ZoneId.of("UTC")).vocabulary();
        assertThat(result.total()).isEqualTo(5); assertThat(result.known()).isEqualTo(1);
        assertThat(result.learning()).isEqualTo(1); assertThat(result.saved()).isEqualTo(1); assertThat(result.due()).isEqualTo(1);
    }

    @Test void streakUsesLocalDatesAcrossUtcMidnightAndDoesNotIncludeUnrelatedDays() {
        var today = attempt("today", 6, 9, "2026-10-13T17:10:00Z");
        var yesterday = attempt("yesterday", 7, 9, "2026-10-12T18:00:00Z");
        var result = LearningOrbitService.achievement(List.of(today, yesterday), Instant.parse("2026-10-13T17:30:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
        assertThat(result.currentStreak()).isEqualTo(2);
        assertThat(result.submissionDays()).isEqualTo(2);
        assertThat(result.earnedPoints()).isEqualByComparingTo("13");
        var broken = LearningOrbitService.achievement(List.of(yesterday), Instant.parse("2026-10-15T17:30:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
        assertThat(broken.currentStreak()).isZero();
    }

    @Test void verifiedImprovementComparesPercentagesAndExcludesUnapprovedAiAndSelfStudy() {
        var first = attempt("first", 4, 10, "2026-10-01T10:00:00Z");
        var next = attempt("next", 12, 20, "2026-10-02T10:00:00Z");
        var independent = attempt("self", 30, 40, "2026-10-03T10:00:00Z"); independent.setContextType(AssessmentContextType.SELF_STUDY);
        var feedback = AssessmentAnswer.builder().gradingStatus(AssessmentAnswerGradingStatus.MANUAL_GRADED).graderComment("Improved structure").build();
        var result = LearningOrbitService.classes(List.of(first, next, independent), Map.of("next", List.of(feedback)), Set.of());
        assertThat(result.revisedSubmissions()).isEqualTo(1); assertThat(result.verifiedImprovements()).isEqualTo(1);
        assertThat(result.approvedFeedback()).isEqualTo(1); assertThat(result.trackedSkills()).isEqualTo(1);
        assertThat(LearningOrbitService.classes(List.of(first, next), Map.of(), Set.of("next")).verifiedImprovements()).isZero();
    }

    @Test void spaceReplacementCanClearAnAssessmentAndPersistsAllSteps() {
        when(space.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var result = service.updateSpace("learner-1", new UpdateLearningOrbitSpaceRequest(3, 2, null, 3, 2, "Focus on Probe"));
        assertThat(result.steps()).extracting(s -> s.level()).containsExactly(3, 2, null, 3, 2);
        assertThat(result.recommendation()).isEqualTo("Focus on Probe");
        verify(space).saveAndFlush(argThat(value -> value.getUserId().equals("learner-1")));
    }

    private static AssessmentAttempt attempt(String id, int earned, int total, String submitted) {
        var a = AssessmentAttempt.builder().userId("learner-1").subType(ResourceSubTypes.PRACTICE_READING)
                .contextType(AssessmentContextType.CLASS_SESSION).sessionId("session-1").learningResourceId("resource-1")
                .learningResourceVersionId("version-1").status(AssessmentAttemptStatus.SUBMITTED).gradingStatus(AssessmentGradingStatus.GRADED)
                .earnedPoints(BigDecimal.valueOf(earned)).totalPoints(BigDecimal.valueOf(total)).submittedAt(Instant.parse(submitted)).build();
        a.setId(id); a.setCreatedAt(Instant.parse(submitted)); return a;
    }
}
