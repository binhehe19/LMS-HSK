package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.request.UpdateLearningOrbitSpaceRequest;
import pl.co.lms.dto.response.LearningOrbitResponse;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.repository.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LearningOrbitService {
    private static final List<AssessmentAttemptStatus> CLOSED = List.of(AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIME_OUT);
    private static final List<String> SKILLS = List.of(ResourceSubTypes.PRACTICE_LISTENING, ResourceSubTypes.PRACTICE_READING,
            ResourceSubTypes.PRACTICE_WRITING, ResourceSubTypes.PRACTICE_SPEAKING);
    private final LearningOrbitSpaceRepository spaceRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final AssessmentAnswerRepository answerRepository;
    private final LearningResourceRepository resourceRepository;
    private final LearningResourceVersionRepository versionRepository;
    private final LearningResourceStateRepository stateRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public LearningOrbitResponse getSummary(String userId, ZoneId zone) {
        requireUser(userId);
        Instant now = Instant.now();
        List<AssessmentAttempt> attempts = attemptRepository.findByUserIdAndStatusInAndDeletedFalse(userId, CLOSED);
        List<String> ids = attempts.stream().map(AssessmentAttempt::getId).toList();
        List<AssessmentAnswer> answers = ids.isEmpty() ? List.of() : answerRepository.findByAttemptIdInAndDeletedFalse(ids);
        Map<String, List<AssessmentAnswer>> answersByAttempt = answers.stream().collect(Collectors.groupingBy(AssessmentAnswer::getAttemptId));
        Set<String> provisional = answers.stream().filter(a -> a.getGradingStatus() == AssessmentAnswerGradingStatus.AI_GRADED)
                .map(AssessmentAnswer::getAttemptId).collect(Collectors.toSet());
        LearningOrbitResponse.Vocabulary vocab = vocabulary(userId, now);
        return new LearningOrbitResponse(spaceRepository.findByUserIdAndDeletedFalse(userId).map(this::space).orElseGet(() -> space(null)),
                band(attempts, provisional), vocab, achievement(attempts, now, zone), classes(attempts, answersByAttempt, provisional), now);
    }

    private LearningOrbitResponse.Band band(List<AssessmentAttempt> attempts, Set<String> provisional) {
        Map<String, List<AssessmentAttempt>> recent = new HashMap<>();
        for (String type : SKILLS) {
            recent.put(type, attempts.stream().filter(a -> type.equals(a.getSubType()) && a.getGradingStatus() == AssessmentGradingStatus.GRADED
                            && a.getTotalPoints() != null && a.getTotalPoints().signum() > 0 && a.getEarnedPoints() != null)
                    .sorted(Comparator.comparing(LearningOrbitService::submittedAt).reversed().thenComparing(AssessmentAttempt::getId, Comparator.reverseOrder()))
                    .limit(2).toList());
        }
        List<String> versionIds = recent.values().stream().flatMap(Collection::stream).map(AssessmentAttempt::getLearningResourceVersionId).filter(Objects::nonNull).distinct().toList();
        Map<String, LearningResourceVersion> versions = versionIds.isEmpty() ? Map.of() : versionRepository.findByIdInAndDeletedFalse(versionIds).stream()
                .collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));
        return new LearningOrbitResponse.Band(SKILLS.stream().map(type -> new LearningOrbitResponse.Skill(ResourceSubTypes.practiceSkillOf(type), recent.get(type).stream().map(a -> {
            LearningResourceVersion version = versions.get(a.getLearningResourceVersionId());
            // Deleted/missing content cannot supply a score scale; do not guess it from raw points.
            String display = version == null ? "POINTS" : scoreDisplay(version, type);
            return new LearningOrbitResponse.Score(a.getEarnedPoints(), a.getTotalPoints(), display, submittedAt(a), provisional.contains(a.getId()));
        }).toList())).toList());
    }

    private String scoreDisplay(LearningResourceVersion version, String type) {
        QuizContent content = version.getContentAs(QuizContent.class, objectMapper);
        JsonNode layout = content == null ? null : content.getLayout();
        String display = layout == null ? "" : layout.path("meta").path("scoreDisplay").asText("");
        if (Set.of("POINTS", "PERCENT", "IELTS_SCALE_9", "IELTS_READING_BAND", "IELTS_LISTENING_BAND").contains(display)) return display;
        return switch (type) {
            case ResourceSubTypes.PRACTICE_READING -> "IELTS_READING_BAND";
            case ResourceSubTypes.PRACTICE_LISTENING -> "IELTS_LISTENING_BAND";
            case ResourceSubTypes.PRACTICE_WRITING, ResourceSubTypes.PRACTICE_SPEAKING -> "IELTS_SCALE_9";
            default -> "PERCENT";
        };
    }

    private LearningOrbitResponse.Vocabulary vocabulary(String userId, Instant now) {
        long total = resourceRepository.countByTypeAndSubTypeAndInLibraryTrueAndPublishedVersionIdIsNotNullAndDeletedFalse(LearningResourceType.VOCABULARY, ResourceSubTypes.EN);
        List<LearningResourceState> states = stateRepository.findPublishedLibraryVocabularyStates(userId);
        // Older installations can contain duplicate state rows. Keep the most recently updated state per word.
        Map<String, LearningResourceState> unique = states.stream().collect(Collectors.toMap(LearningResourceState::getLearningResourceId, Function.identity(),
                (a, b) -> time(a.getUpdatedAt()).isAfter(time(b.getUpdatedAt())) ? a : b));
        long known = unique.values().stream().filter(s -> level(s) == VocabularyComprehensionLevel.KNOWN).count();
        long learning = unique.values().stream().filter(s -> level(s) == VocabularyComprehensionLevel.LEARNING).count();
        long saved = unique.values().stream().filter(LearningResourceState::isSaved).count();
        long due = unique.values().stream().filter(s -> s.getReviewAt() != null && !s.getReviewAt().isAfter(now)).count();
        return new LearningOrbitResponse.Vocabulary(total, known, learning, saved, due);
    }

    static LearningOrbitResponse.Achievement achievement(List<AssessmentAttempt> attempts, Instant now, ZoneId zone) {
        BigDecimal points = attempts.stream().filter(a -> a.getGradingStatus() == AssessmentGradingStatus.GRADED)
                .map(AssessmentAttempt::getEarnedPoints).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        Set<LocalDate> days = attempts.stream().map(AssessmentAttempt::getSubmittedAt).filter(Objects::nonNull)
                .filter(date -> !date.isAfter(now)).map(date -> date.atZone(zone).toLocalDate()).collect(Collectors.toSet());
        LocalDate cursor = now.atZone(zone).toLocalDate();
        if (!days.contains(cursor)) cursor = cursor.minusDays(1);
        int streak = 0;
        while (days.contains(cursor)) { streak++; cursor = cursor.minusDays(1); }
        return new LearningOrbitResponse.Achievement(points, attempts.size(), days.size(), streak);
    }

    static LearningOrbitResponse.Classes classes(List<AssessmentAttempt> attempts, Map<String, List<AssessmentAnswer>> answers, Set<String> provisional) {
        List<AssessmentAttempt> inClass = attempts.stream().filter(a -> a.getContextType() == AssessmentContextType.CLASS_SESSION).toList();
        Map<String, List<AssessmentAttempt>> groups = inClass.stream().collect(Collectors.groupingBy(a -> a.getLearningResourceId() + ":" + a.getSessionId()));
        long revised = groups.values().stream().mapToLong(g -> Math.max(0, g.size() - 1)).sum();
        long feedback = inClass.stream().filter(a -> answers.getOrDefault(a.getId(), List.of()).stream().anyMatch(answer ->
                (answer.getGradingStatus() == AssessmentAnswerGradingStatus.MANUAL_GRADED || answer.getGradingStatus() == AssessmentAnswerGradingStatus.SCORE_UPDATED)
                        && answer.getGraderComment() != null && !answer.getGraderComment().isBlank())).count();
        long improved = groups.values().stream().filter(group -> {
            List<AssessmentAttempt> ordered = group.stream().filter(a -> a.getGradingStatus() == AssessmentGradingStatus.GRADED && !provisional.contains(a.getId())
                            && a.getTotalPoints() != null && a.getTotalPoints().signum() > 0 && a.getEarnedPoints() != null)
                    .sorted(Comparator.comparing(LearningOrbitService::submittedAt).reversed().thenComparing(AssessmentAttempt::getId, Comparator.reverseOrder())).limit(2).toList();
            if (ordered.size() < 2) return false;
            // Cross multiplication compares percentages across different total-points scales without rounding.
            return ordered.get(0).getEarnedPoints().multiply(ordered.get(1).getTotalPoints())
                    .compareTo(ordered.get(1).getEarnedPoints().multiply(ordered.get(0).getTotalPoints())) > 0;
        }).count();
        int tracked = (int) inClass.stream().map(AssessmentAttempt::getSubType).filter(SKILLS::contains).distinct().count();
        return new LearningOrbitResponse.Classes(revised, feedback, improved, tracked);
    }

    private LearningOrbitResponse.Space space(LearningOrbitSpace value) {
        return new LearningOrbitResponse.Space(List.of(
                new LearningOrbitResponse.SpaceStep("scope", "S · Scope", value == null ? null : value.getScopeLevel()),
                new LearningOrbitResponse.SpaceStep("probe", "P · Probe", value == null ? null : value.getProbeLevel()),
                new LearningOrbitResponse.SpaceStep("assemble", "A · Assemble", value == null ? null : value.getAssembleLevel()),
                new LearningOrbitResponse.SpaceStep("communicate", "C · Communicate", value == null ? null : value.getCommunicateLevel()),
                new LearningOrbitResponse.SpaceStep("evaluate", "E · Evaluate", value == null ? null : value.getEvaluateLevel())),
                value == null ? null : value.getRecommendation(), value == null ? null : value.getUpdatedAt());
    }

    @Transactional
    public LearningOrbitResponse.Space updateSpace(String userId, UpdateLearningOrbitSpaceRequest request) {
        requireUser(userId);
        LearningOrbitSpace value = spaceRepository.findByUserIdAndDeletedFalse(userId).orElseGet(() -> {
            LearningOrbitSpace created = new LearningOrbitSpace(); created.setUserId(userId); return created;
        });
        value.setScopeLevel(request.scope()); value.setProbeLevel(request.probe()); value.setAssembleLevel(request.assemble());
        value.setCommunicateLevel(request.communicate()); value.setEvaluateLevel(request.evaluate()); value.setRecommendation(request.recommendation());
        return space(spaceRepository.saveAndFlush(value));
    }

    private static VocabularyComprehensionLevel level(LearningResourceState state) {
        if (state.getComprehensionLevel() != null) return state.getComprehensionLevel();
        return state.getStatus() == FlashcardStatus.LEARNED ? VocabularyComprehensionLevel.KNOWN
                : state.getStatus() == FlashcardStatus.LEARNING ? VocabularyComprehensionLevel.LEARNING : VocabularyComprehensionLevel.UNKNOWN;
    }
    private static Instant submittedAt(AssessmentAttempt attempt) { return time(attempt.getSubmittedAt() != null ? attempt.getSubmittedAt() : attempt.getCreatedAt()); }
    private static Instant time(Instant value) { return value == null ? Instant.EPOCH : value; }
    private static void requireUser(String userId) {
        if (userId == null || userId.isBlank() || userId.length() > 26) throw new ApiException(ErrorCode.E200, "Mã người dùng không hợp lệ");
    }
}
