package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.request.SaveDictationAnswerRequest;
import pl.co.lms.dto.request.SaveShadowingRecordingRequest;
import pl.co.lms.dto.request.StartLanguagePracticeAttemptRequest;
import pl.co.lms.dto.response.LanguagePracticeAttemptResponse;
import pl.co.lms.dto.response.LanguagePracticeSegmentResponse;
import pl.co.lms.entity.LanguagePracticeAttempt;
import pl.co.lms.entity.LanguagePracticeAttemptStatus;
import pl.co.lms.entity.LanguagePracticeMode;
import pl.co.lms.entity.LanguagePracticeSegmentAttempt;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.entity.LearningResourceVersionStatus;
import pl.co.lms.entity.json.AudioPracticeContent;
import pl.co.lms.repository.LanguagePracticeAttemptRepository;
import pl.co.lms.repository.LanguagePracticeSegmentAttemptRepository;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceVersionRepository;

import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Lượt luyện của học viên, tách hẳn AssessmentAttempt vì đây không phải bài thi/bài về nhà theo lớp:
 * không có session CMS, time limit, Redis lock hay queue chấm AI. Nội dung luôn lấy từ pinned
 * LearningResourceVersion đã PUBLISHED để các lần publish sau không đổi kết quả cũ.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class LanguagePracticeService {

    private final LearningResourceRepository resourceRepository;
    private final LearningResourceVersionRepository versionRepository;
    private final LanguagePracticeAttemptRepository attemptRepository;
    private final LanguagePracticeSegmentAttemptRepository segmentAttemptRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<pl.co.lms.dto.response.LanguagePracticeCatalogItem> catalog(LanguagePracticeMode mode) {
        return versionRepository.findPublishedGameContent(LearningResourceType.AUDIO_PRACTICE,
                        org.springframework.data.domain.Pageable.unpaged()).stream()
                .map(version -> {
                    var content = version.getContentAs(AudioPracticeContent.class, objectMapper);
                    if (content == null || content.getSegments() == null || content.getSegments().isEmpty()) return null;
                    boolean enabled = mode == LanguagePracticeMode.SHADOWING
                            ? Boolean.TRUE.equals(content.getShadowingEnabled()) : Boolean.TRUE.equals(content.getDictationEnabled());
                    boolean video = content.getYoutubeVideoId() != null && !content.getYoutubeVideoId().isBlank();
                    boolean audio = content.getAudioFileId() != null && !content.getAudioFileId().isBlank();
                    if (!enabled || (!video && !audio)) return null;
                    return new pl.co.lms.dto.response.LanguagePracticeCatalogItem(version.getResourceId(),
                            content.getTitle(), content.getDescription(), content.getLevel(), video ? "video" : "audio",
                            content.getDurationMillis() == null ? 0 : content.getDurationMillis(), content.getSegments().size());
                }).filter(java.util.Objects::nonNull).toList();
    }

    public LanguagePracticeAttemptResponse startOrResume(
            String userId,
            String resourceId,
            StartLanguagePracticeAttemptRequest request) {

        PublishedPractice published = loadPublishedPractice(resourceId);
        assertModeEnabled(published.content(), request.mode());
        boolean restart = Boolean.TRUE.equals(request.restart());

        var active = attemptRepository
                .findFirstByCreatedByAndResourceVersionIdAndModeAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                        userId, published.version().getId(), request.mode(), LanguagePracticeAttemptStatus.IN_PROGRESS);
        if (active.isPresent()) {
            if (!restart) {
                return toResponse(active.get());
            }
            LanguagePracticeAttempt abandoned = active.get();
            abandoned.setStatus(LanguagePracticeAttemptStatus.ABANDONED);
            attemptRepository.save(abandoned);
            attemptRepository.flush();
        }

        // Sau khi hoàn thành, frontend phải gửi restart=true mới tạo lượt mới. Nhờ vậy refresh trang
        // vẫn trả về đúng kết quả vừa làm thay vì âm thầm xóa tiến độ.
        if (!restart) {
            var completed = attemptRepository
                    .findFirstByCreatedByAndResourceVersionIdAndModeAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                            userId, published.version().getId(), request.mode(), LanguagePracticeAttemptStatus.COMPLETED);
            if (completed.isPresent()) {
                return toResponse(completed.get());
            }
        }

        LanguagePracticeAttempt attempt = LanguagePracticeAttempt.builder()
                .resourceId(resourceId)
                .resourceVersionId(published.version().getId())
                .mode(request.mode())
                .status(LanguagePracticeAttemptStatus.IN_PROGRESS)
                .build();
        // Auditing cũng điền createdBy, nhưng gán rõ ở đây để ownership không phụ thuộc vào cấu hình audit.
        attempt.setCreatedBy(userId);
        return toResponse(attemptRepository.save(attempt));
    }

    @Transactional(readOnly = true)
    public LanguagePracticeAttemptResponse getAttempt(String userId, String attemptId) {
        return toResponse(getAttemptForUser(userId, attemptId));
    }

    public LanguagePracticeAttemptResponse saveDictationAnswer(
            String userId,
            String attemptId,
            int segmentNo,
            SaveDictationAnswerRequest request) {

        LanguagePracticeAttempt attempt = getMutableAttempt(userId, attemptId, LanguagePracticeMode.DICTATION);
        AudioPracticeContent.AudioPracticeSegment segment = getSegment(attempt, segmentNo);
        LanguagePracticeSegmentAttempt segmentAttempt = getOrCreateSegmentAttempt(attempt.getId(), segment.getSegmentNo());
        if (segmentAttempt.getDictationCheckedAt() != null) {
            throw new ApiException(ErrorCode.E220,
                    "Đoạn Dictation đã được kiểm tra; hãy tạo lượt mới để làm lại");
        }
        segmentAttempt.setDictationAnswer(safeAnswer(request.answerText()));
        segmentAttemptRepository.save(segmentAttempt);
        return toResponse(attempt);
    }

    public LanguagePracticeAttemptResponse checkDictationAnswer(
            String userId,
            String attemptId,
            int segmentNo,
            SaveDictationAnswerRequest request) {

        LanguagePracticeAttempt attempt = getAttemptForUser(userId, attemptId);
        if (attempt.getMode() != LanguagePracticeMode.DICTATION) {
            throw new ApiException(ErrorCode.E200, "Attempt mode does not match this action");
        }
        AudioPracticeContent.AudioPracticeSegment segment = getSegment(attempt, segmentNo);
        LanguagePracticeSegmentAttempt segmentAttempt = getOrCreateSegmentAttempt(attempt.getId(), segment.getSegmentNo());
        // Sau lần chấm đầu tiên transcript đã được trả về client. Giữ nguyên kết quả để request lặp
        // (double click/retry mạng) không thể thay đổi đáp án và điểm của đoạn đã lộ đáp án.
        if (segmentAttempt.getDictationCheckedAt() != null) {
            return toResponse(attempt);
        }
        if (attempt.getStatus() != LanguagePracticeAttemptStatus.IN_PROGRESS) {
            throw new ApiException(ErrorCode.E220, "Attempt is no longer in progress");
        }
        Instant now = Instant.now();
        segmentAttempt.setDictationAnswer(safeAnswer(request.answerText()));
        segmentAttempt.setDictationCorrect(isAcceptedDictationAnswer(segment, segmentAttempt.getDictationAnswer()));
        segmentAttempt.setDictationCheckedAt(now);
        segmentAttempt.setCompletedAt(now);
        segmentAttemptRepository.save(segmentAttempt);
        completeWhenEverySegmentIsDone(attempt);
        return toResponse(attempt);
    }

    public LanguagePracticeAttemptResponse saveShadowingRecording(
            String userId,
            String attemptId,
            int segmentNo,
            SaveShadowingRecordingRequest request) {

        LanguagePracticeAttempt attempt = getMutableAttempt(userId, attemptId, LanguagePracticeMode.SHADOWING);
        AudioPracticeContent.AudioPracticeSegment segment = getSegment(attempt, segmentNo);
        LanguagePracticeSegmentAttempt segmentAttempt = getOrCreateSegmentAttempt(attempt.getId(), segment.getSegmentNo());
        segmentAttempt.setRecordingFileId(request.recordingFileId().trim());
        segmentAttempt.setRecordingDurationMillis(request.recordingDurationMillis());
        segmentAttempt.setCompletedAt(Instant.now());
        segmentAttemptRepository.save(segmentAttempt);
        completeWhenEverySegmentIsDone(attempt);
        return toResponse(attempt);
    }

    private LanguagePracticeAttempt getMutableAttempt(String userId, String attemptId, LanguagePracticeMode requiredMode) {
        LanguagePracticeAttempt attempt = getAttemptForUser(userId, attemptId);
        if (attempt.getMode() != requiredMode) {
            throw new ApiException(ErrorCode.E200, "Attempt mode does not match this action");
        }
        if (attempt.getStatus() != LanguagePracticeAttemptStatus.IN_PROGRESS) {
            throw new ApiException(ErrorCode.E220, "Attempt is no longer in progress");
        }
        return attempt;
    }

    private LanguagePracticeAttempt getAttemptForUser(String userId, String attemptId) {
        LanguagePracticeAttempt attempt = attemptRepository.findByIdAndDeletedFalse(attemptId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "LanguagePracticeAttempt không tồn tại"));
        if (!userId.equals(attempt.getCreatedBy())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Bạn không có quyền truy cập lượt luyện này");
        }
        return attempt;
    }

    private AudioPracticeContent.AudioPracticeSegment getSegment(LanguagePracticeAttempt attempt, int segmentNo) {
        if (segmentNo < 1) {
            throw new ApiException(ErrorCode.E200, "segmentNo must be greater than zero");
        }
        return contentForAttempt(attempt).getSegments().stream()
                .filter(segment -> segment.getSegmentNo() != null && segmentNo == segment.getSegmentNo())
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Audio practice segment không tồn tại"));
    }

    private LanguagePracticeSegmentAttempt getOrCreateSegmentAttempt(String attemptId, int segmentNo) {
        return segmentAttemptRepository.findByAttemptIdAndSegmentNoAndDeletedFalse(attemptId, segmentNo)
                .orElseGet(() -> LanguagePracticeSegmentAttempt.builder()
                        .attemptId(attemptId)
                        .segmentNo(segmentNo)
                        .build());
    }

    private void completeWhenEverySegmentIsDone(LanguagePracticeAttempt attempt) {
        int totalSegments = contentForAttempt(attempt).getSegments().size();
        long completedSegments = segmentAttemptRepository.countByAttemptIdAndCompletedAtIsNotNullAndDeletedFalse(attempt.getId());
        if (completedSegments >= totalSegments) {
            attempt.setStatus(LanguagePracticeAttemptStatus.COMPLETED);
            attempt.setCompletedAt(Instant.now());
            attemptRepository.save(attempt);
        }
    }

    private LanguagePracticeAttemptResponse toResponse(LanguagePracticeAttempt attempt) {
        AudioPracticeContent content = contentForAttempt(attempt);
        List<LanguagePracticeSegmentAttempt> saved = segmentAttemptRepository
                .findByAttemptIdAndDeletedFalseOrderBySegmentNoAsc(attempt.getId());
        Map<Integer, LanguagePracticeSegmentAttempt> savedBySegment = new HashMap<>();
        for (LanguagePracticeSegmentAttempt item : saved) {
            savedBySegment.put(item.getSegmentNo(), item);
        }

        List<LanguagePracticeSegmentResponse> segments = content.getSegments().stream()
                .sorted(Comparator.comparing(AudioPracticeContent.AudioPracticeSegment::getSegmentNo))
                .map(segment -> toSegmentResponse(attempt.getMode(), segment, savedBySegment.get(segment.getSegmentNo())))
                .toList();
        int completedCount = (int) saved.stream().filter(item -> item.getCompletedAt() != null).count();
        int correctDictationCount = (int) saved.stream().filter(item -> Boolean.TRUE.equals(item.getDictationCorrect())).count();

        return new LanguagePracticeAttemptResponse(
                attempt.getId(),
                attempt.getResourceId(),
                attempt.getResourceVersionId(),
                attempt.getMode(),
                attempt.getStatus(),
                content.getTitle(),
                content.getDescription(),
                content.getLevel(),
                content.getTopic(),
                content.getAudioFileId(),
                content.getAudioFileName(),
                content.getAudioMimeType(),
                content.getYoutubeVideoId(),
                content.getDurationMillis(),
                completedCount,
                correctDictationCount,
                content.getSegments().size(),
                attempt.getCreatedAt(),
                attempt.getCompletedAt(),
                segments);
    }

    private LanguagePracticeSegmentResponse toSegmentResponse(
            LanguagePracticeMode mode,
            AudioPracticeContent.AudioPracticeSegment segment,
            LanguagePracticeSegmentAttempt saved) {

        // Điều kiện lộ đáp án nằm ở server. Học viên Dictation không thể mở DevTools và đọc
        // transcript, IPA, bản dịch hoặc accepted answers trước khi tự bấm kiểm tra đoạn đó.
        boolean revealAnswer = mode == LanguagePracticeMode.SHADOWING
                || (saved != null && saved.getDictationCheckedAt() != null);
        return new LanguagePracticeSegmentResponse(
                segment.getSegmentNo(),
                segment.getStartMillis(),
                segment.getEndMillis(),
                revealAnswer ? segment.getTranscript() : null,
                revealAnswer ? segment.getTranslationVi() : null,
                revealAnswer ? segment.getIpa() : null,
                saved != null ? saved.getDictationAnswer() : null,
                saved != null ? saved.getDictationCorrect() : null,
                saved != null ? saved.getDictationCheckedAt() : null,
                saved != null ? saved.getRecordingFileId() : null,
                saved != null ? saved.getRecordingDurationMillis() : null,
                saved != null ? saved.getCompletedAt() : null);
    }

    private PublishedPractice loadPublishedPractice(String resourceId) {
        LearningResource resource = resourceRepository.findByIdAndDeletedFalse(resourceId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "LearningResource không tồn tại"));
        if (resource.getType() != LearningResourceType.AUDIO_PRACTICE) {
            throw new ApiException(ErrorCode.E200, "LearningResource is not an audio practice");
        }
        if (resource.getPublishedVersionId() == null) {
            throw new ApiException(ErrorCode.E220, "Audio practice has not been published");
        }
        LearningResourceVersion version = versionRepository.findByIdAndDeletedFalse(resource.getPublishedVersionId())
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Published audio practice version không tồn tại"));
        if (version.getStatus() != LearningResourceVersionStatus.PUBLISHED) {
            throw new ApiException(ErrorCode.E220, "Audio practice version is not published");
        }
        AudioPracticeContent content = version.getContentAs(AudioPracticeContent.class, objectMapper);
        if (content == null || content.getSegments() == null) {
            throw new ApiException(ErrorCode.E200, "Audio practice content is invalid");
        }
        return new PublishedPractice(resource, version, content);
    }

    private AudioPracticeContent contentForAttempt(LanguagePracticeAttempt attempt) {
        // Resource bị soft-delete không được mở lượt mới (loadPublishedPractice vẫn lọc deleted),
        // nhưng lượt đã ghim version phải còn đọc được để không mất tiến độ/kết quả lịch sử.
        LearningResource resource = resourceRepository.findById(attempt.getResourceId())
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "LearningResource không tồn tại"));
        if (resource.getType() != LearningResourceType.AUDIO_PRACTICE) {
            throw new ApiException(ErrorCode.E200, "Attempt resource is not an audio practice");
        }
        LearningResourceVersion version = versionRepository.findByIdAndDeletedFalse(attempt.getResourceVersionId())
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Audio practice version không tồn tại"));
        if (!attempt.getResourceId().equals(version.getResourceId())
                || version.getStatus() != LearningResourceVersionStatus.PUBLISHED) {
            throw new ApiException(ErrorCode.E220, "Audio practice version is no longer available");
        }
        AudioPracticeContent content = version.getContentAs(AudioPracticeContent.class, objectMapper);
        if (content == null || content.getSegments() == null) {
            throw new ApiException(ErrorCode.E200, "Audio practice content is invalid");
        }
        return content;
    }

    private void assertModeEnabled(AudioPracticeContent content, LanguagePracticeMode mode) {
        boolean enabled = mode == LanguagePracticeMode.SHADOWING
                ? Boolean.TRUE.equals(content.getShadowingEnabled())
                : Boolean.TRUE.equals(content.getDictationEnabled());
        if (!enabled) {
            throw new ApiException(ErrorCode.E220, "This practice mode is not enabled for the resource");
        }
    }

    private boolean isAcceptedDictationAnswer(AudioPracticeContent.AudioPracticeSegment segment, String answer) {
        String normalizedAnswer = normalize(answer);
        if (normalizedAnswer.isEmpty()) {
            return false;
        }
        List<String> accepted = new ArrayList<>();
        accepted.add(segment.getTranscript());
        if (segment.getAcceptedDictationAnswers() != null) {
            accepted.addAll(segment.getAcceptedDictationAnswers());
        }
        return accepted.stream().filter(value -> value != null && !value.isBlank())
                .map(this::normalize)
                .anyMatch(normalizedAnswer::equals);
    }

    private String safeAnswer(String answer) {
        return answer == null ? "" : answer.trim();
    }

    private String normalize(String value) {
        String decomposed = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return decomposed.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private record PublishedPractice(
            LearningResource resource,
            LearningResourceVersion version,
            AudioPracticeContent content) {}
}
