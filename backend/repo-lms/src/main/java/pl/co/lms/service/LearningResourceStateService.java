package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.entity.FlashcardStatus;
import pl.co.lms.entity.LearningResourceState;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.VocabularyComprehensionLevel;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceStateRepository;

import java.time.Instant;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
public class LearningResourceStateService {

    private final LearningResourceStateRepository stateRepository;
    private final LearningResourceRepository resourceRepository;

    private LearningResourceState getOrCreate(String userId, String resourceId) {
        if (userId == null || userId.isBlank()) {
            throw new ApiException(ErrorCode.E200, "userId is required");
        }
        resourceRepository.findByIdAndDeletedFalse(resourceId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "LearningResource not found: " + resourceId));

        return stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse(userId, resourceId)
                .orElseGet(() -> LearningResourceState.builder()
                        .userId(userId)
                        .learningResourceId(resourceId)
                        .build());
    }

    public LearningResourceState updateFlashcardStatus(String userId, String resourceId, FlashcardStatus status) {
        LearningResourceState state = getOrCreate(userId, resourceId);
        state.setStatus(status);
        state.setLastReviewedAt(Instant.now());
        state.setReviewCount(state.getReviewCount() + 1);
        return stateRepository.save(state);
    }

    public LearningResourceState updateVocabularyState(
            String userId,
            String resourceId,
            Boolean saved,
            String note,
            VocabularyComprehensionLevel comprehensionLevel) {

        LearningResourceState state = getOrCreate(userId, resourceId);
        if (saved != null) {
            state.setSaved(saved);
        }
        if (note != null) {
            state.setNote(note);
        }
        if (comprehensionLevel != null) {
            recordVocabularyReview(state, comprehensionLevel, Instant.now());
            state.setComprehensionLevel(comprehensionLevel);
            syncSourceVocabulary(userId, resourceId, comprehensionLevel);
        }
        return stateRepository.save(state);
    }

    /** Lesson copies keep their own notes, while vocabulary mastery is also visible on the source map. */
    private void syncSourceVocabulary(String userId, String resourceId, VocabularyComprehensionLevel level) {
        var resource = resourceRepository.findByIdAndDeletedFalse(resourceId).orElse(null);
        if (resource == null || resource.getType() != LearningResourceType.VOCABULARY
                || resource.isInLibrary() || resource.getSourceResourceId() == null) return;
        var source = resourceRepository.findByIdAndDeletedFalse(resource.getSourceResourceId()).orElse(null);
        if (source == null || source.getType() != LearningResourceType.VOCABULARY
                || !source.isInLibrary() || source.getPublishedVersionId() == null
                || resource.getWordKey() == null || resource.getWordKey().isBlank()
                || !resource.getWordKey().equals(source.getWordKey())) return;
        var state = getOrCreate(userId, source.getId());
        recordVocabularyReview(state, level, Instant.now());
        state.setComprehensionLevel(level);
        stateRepository.save(state);
    }

    /** Starting a lesson is learning activity, not a successful review. Repeated saves are idempotent. */
    public LearningResourceState startVocabularyLearning(String userId, String resourceId) {
        LearningResourceState state = getOrCreate(userId, resourceId);
        if (state.getComprehensionLevel() == null && state.getStatus() != null && state.getStatus() != FlashcardStatus.NOT_LEARNED)
            return state;
        if (state.getComprehensionLevel() != null && state.getComprehensionLevel() != VocabularyComprehensionLevel.UNKNOWN) {
            if (state.getReviewAt() == null) {
                if (state.getLastReviewedAt() == null) state.setLastReviewedAt(Instant.now());
                state.setReviewAt(state.getLastReviewedAt().plus(1, ChronoUnit.DAYS));
                return stateRepository.save(state);
            }
            return state;
        }
        state.setComprehensionLevel(VocabularyComprehensionLevel.LEARNING);
        state.setStatus(FlashcardStatus.LEARNING);
        state.setSaved(true);
        state.setLastReviewedAt(Instant.now());
        state.setReviewAt(state.getLastReviewedAt().plus(1, ChronoUnit.DAYS));
        return stateRepository.save(state);
    }

    /** Initialize legacy schedules without treating migration as another recall. */
    public void scheduleMissingVocabularyReviews(String userId) {
        for (var state : stateRepository.findPublishedLibraryVocabularyStates(userId)) {
            if (state.getReviewAt() != null) continue;
            var level = state.getComprehensionLevel();
            if (level == null && state.getStatus() == FlashcardStatus.LEARNED) level = VocabularyComprehensionLevel.KNOWN;
            if (level == null && state.getStatus() == FlashcardStatus.LEARNING) level = VocabularyComprehensionLevel.LEARNING;
            if (level == null || level == VocabularyComprehensionLevel.UNKNOWN) continue;
            state.setComprehensionLevel(level);
            var anchor = state.getLastReviewedAt() != null ? state.getLastReviewedAt()
                    : state.getUpdatedAt() != null ? state.getUpdatedAt() : Instant.now();
            state.setLastReviewedAt(anchor);
            state.setReviewAt(anchor.plus(1, ChronoUnit.DAYS));
            stateRepository.save(state);
        }
    }

    // Successful due recalls extend the interval: 1, 3, 7, 14, 30 days. Failure resets it to one day.
    private static void recordVocabularyReview(LearningResourceState state, VocabularyComprehensionLevel next, Instant now) {
        if (next == VocabularyComprehensionLevel.UNKNOWN) {
            state.setStatus(FlashcardStatus.NOT_LEARNED);
            state.setReviewAt(null);
            return;
        }
        long days = 1;
        if (next == VocabularyComprehensionLevel.KNOWN && state.getComprehensionLevel() == VocabularyComprehensionLevel.KNOWN
                && state.getLastReviewedAt() != null && state.getReviewAt() != null) {
            long previous = Duration.between(state.getLastReviewedAt(), state.getReviewAt()).toDays();
            days = state.getReviewAt().isAfter(now) ? Math.max(1, previous)
                    : previous < 1 ? 1 : previous < 3 ? 3 : previous < 7 ? 7 : previous < 14 ? 14 : 30;
        }
        state.setStatus(next == VocabularyComprehensionLevel.KNOWN ? FlashcardStatus.LEARNED : FlashcardStatus.LEARNING);
        state.setLastReviewedAt(now);
        state.setReviewAt(now.plus(days, ChronoUnit.DAYS));
        state.setReviewCount(state.getReviewCount() + 1);
    }

    @Transactional(readOnly = true)
    public Optional<LearningResourceState> getState(String userId, String resourceId) {
        return stateRepository.findByUserIdAndLearningResourceIdAndDeletedFalse(userId, resourceId);
    }

    @Transactional(readOnly = true)
    public List<LearningResourceState> getStatesForResources(String userId, List<String> resourceIds) {
        return stateRepository.findByUserIdAndLearningResourceIdInAndDeletedFalse(userId, resourceIds);
    }

    @Transactional(readOnly = true)
    public List<LearningResourceState> getSavedResources(String userId) {
        return stateRepository.findByUserIdAndSavedTrueAndDeletedFalse(userId);
    }

    private static final pl.co.lms.dto.response.VocabularyUserSummaryResponse EMPTY_SUMMARY =
            new pl.co.lms.dto.response.VocabularyUserSummaryResponse(0, 0, 0, java.util.Map.of());

    /** Tiến độ từ vựng của người dùng trong phạm vi cấp độ/chủ đề (bỏ trống = cả Kho); groupBy = "topic" hoặc "level" để tách theo nhóm. */
    @Transactional(readOnly = true)
    public pl.co.lms.dto.response.VocabularyUserSummaryResponse getVocabularySummary(String userId, String cefrLevel, String topic, String groupBy) {
        if (userId == null || userId.isBlank()) return EMPTY_SUMMARY;
        DictionaryScope scope = DictionaryScope.of(cefrLevel, topic);
        List<Object[]> rows = stateRepository.countVocabularyStatesSummary(userId, scope.cefrMode(), scope.cefr(), scope.topicMode(), scope.topicLower());
        if (rows.isEmpty() || rows.get(0) == null) return EMPTY_SUMMARY;
        Object[] row = rows.get(0);
        long known = row[0] instanceof Number n ? n.longValue() : 0L;
        long learning = row[1] instanceof Number n ? n.longValue() : 0L;
        long saved = row[2] instanceof Number n ? n.longValue() : 0L;
        java.util.Map<String, pl.co.lms.dto.response.VocabularyUserSummaryResponse.GroupProgress> groups = new java.util.LinkedHashMap<>();
        List<Object[]> grouped = "topic".equals(groupBy)
                ? stateRepository.countVocabularyStatesByTopic(userId, scope.cefrMode(), scope.cefr(), scope.topicMode(), scope.topicLower())
                : "level".equals(groupBy)
                ? stateRepository.countVocabularyStatesByLevel(userId, scope.cefrMode(), scope.cefr(), scope.topicMode(), scope.topicLower())
                : List.of();
        for (Object[] r : grouped) {
            String name = r[0] == null ? "" : String.valueOf(r[0]).strip();
            long k = r[1] instanceof Number n ? n.longValue() : 0L;
            long l = r[2] instanceof Number n ? n.longValue() : 0L;
            groups.put(name, new pl.co.lms.dto.response.VocabularyUserSummaryResponse.GroupProgress(k, l));
        }
        return new pl.co.lms.dto.response.VocabularyUserSummaryResponse(known, learning, saved, groups);
    }

    /** Các từ người dùng đang học (NEW/LEARNING) trong phạm vi, mới cập nhật trước, tối đa limit (1–500): nguồn hàng đợi ôn tập. */
    @Transactional(readOnly = true)
    /** T? ?? ??n h?n ?n (reviewAt <= now) c?a ng??i d?ng, h?n s?m nh?t tr??c, t?i ?a 500. */
    public List<LearningResourceState> getDueVocabularyStates(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        return stateRepository.findTop500ByUserIdAndReviewAtLessThanEqualAndDeletedFalseOrderByReviewAtAsc(userId, java.time.Instant.now());
    }

    public List<LearningResourceState> getLearningVocabularyStates(String userId, String cefrLevel, String topic, int limit) {
        if (userId == null || userId.isBlank()) return List.of();
        DictionaryScope scope = DictionaryScope.of(cefrLevel, topic);
        return stateRepository.findLearningVocabularyStates(userId, scope.cefrMode(), scope.cefr(), scope.topicMode(), scope.topicLower(),
                Math.min(500, Math.max(1, limit)));
    }
}
