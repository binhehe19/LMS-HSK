package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import base.co.common.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pl.co.lms.dto.request.SaveDictationAnswerRequest;
import pl.co.lms.dto.request.SaveShadowingRecordingRequest;
import pl.co.lms.dto.request.StartLanguagePracticeAttemptRequest;
import pl.co.lms.dto.response.LanguagePracticeAttemptResponse;
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

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LanguagePracticeServiceTest {

    @Mock private LearningResourceRepository resourceRepository;
    @Mock private LearningResourceVersionRepository versionRepository;
    @Mock private LanguagePracticeAttemptRepository attemptRepository;
    @Mock private LanguagePracticeSegmentAttemptRepository segmentAttemptRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final List<LanguagePracticeSegmentAttempt> savedSegments = new ArrayList<>();
    private LanguagePracticeService service;
    private LearningResource resource;
    private LanguagePracticeAttempt savedAttempt;

    @BeforeEach
    void setUp() {
        service = new LanguagePracticeService(
                resourceRepository, versionRepository, attemptRepository, segmentAttemptRepository, objectMapper);

        resource = LearningResource.builder().type(LearningResourceType.AUDIO_PRACTICE).build();
        resource.setId("resource-1");
        resource.setPublishedVersionId("version-1");

        AudioPracticeContent content = AudioPracticeContent.builder()
                .title("Morning market")
                .youtubeVideoId("dQw4w9WgXcQ")
                .durationMillis(10_000L)
                .shadowingEnabled(true)
                .dictationEnabled(true)
                .segments(List.of(AudioPracticeContent.AudioPracticeSegment.builder()
                        .segmentNo(1)
                        .startMillis(0L)
                        .endMillis(8_000L)
                        .transcript("Hello, market friend!")
                        .acceptedDictationAnswers(List.of("Hello market friend"))
                        .translationVi("Xin chào người bạn ở chợ!")
                        .build()))
                .build();
        LearningResourceVersion version = LearningResourceVersion.builder()
                .resourceId("resource-1")
                .version(1)
                .status(LearningResourceVersionStatus.PUBLISHED)
                .build();
        version.setId("version-1");
        version.setContentFrom(content, objectMapper);

        when(resourceRepository.findByIdAndDeletedFalse("resource-1")).thenAnswer(invocation ->
                resource.isDeleted() ? Optional.empty() : Optional.of(resource));
        when(resourceRepository.findById("resource-1")).thenReturn(Optional.of(resource));
        when(versionRepository.findByIdAndDeletedFalse("version-1")).thenReturn(Optional.of(version));
        when(attemptRepository.findFirstByCreatedByAndResourceVersionIdAndModeAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                anyString(), anyString(), any(LanguagePracticeMode.class), any(LanguagePracticeAttemptStatus.class)))
                .thenReturn(Optional.empty());
        when(attemptRepository.save(any(LanguagePracticeAttempt.class))).thenAnswer(invocation -> {
            LanguagePracticeAttempt attempt = invocation.getArgument(0);
            if (attempt.getId() == null) attempt.setId("attempt-1");
            if (attempt.getCreatedAt() == null) attempt.setCreatedAt(Instant.now());
            savedAttempt = attempt;
            return attempt;
        });
        when(attemptRepository.findByIdAndDeletedFalse(anyString())).thenAnswer(invocation ->
                Optional.ofNullable(savedAttempt)
                        .filter(attempt -> attempt.getId().equals(invocation.getArgument(0))));
        when(segmentAttemptRepository.findByAttemptIdAndSegmentNoAndDeletedFalse(anyString(), anyInt()))
                .thenAnswer(invocation -> savedSegments.stream()
                        .filter(segment -> segment.getAttemptId().equals(invocation.getArgument(0))
                                && segment.getSegmentNo() == invocation.<Integer>getArgument(1))
                        .findFirst());
        when(segmentAttemptRepository.findByAttemptIdAndDeletedFalseOrderBySegmentNoAsc(anyString()))
                .thenAnswer(invocation -> savedSegments.stream()
                        .filter(segment -> segment.getAttemptId().equals(invocation.getArgument(0)))
                        .toList());
        when(segmentAttemptRepository.save(any(LanguagePracticeSegmentAttempt.class))).thenAnswer(invocation -> {
            LanguagePracticeSegmentAttempt segment = invocation.getArgument(0);
            if (segment.getId() == null) segment.setId("segment-attempt-1");
            if (!savedSegments.contains(segment)) savedSegments.add(segment);
            return segment;
        });
        when(segmentAttemptRepository.countByAttemptIdAndCompletedAtIsNotNullAndDeletedFalse(anyString()))
                .thenAnswer(invocation -> savedSegments.stream()
                        .filter(segment -> segment.getAttemptId().equals(invocation.getArgument(0))
                                && segment.getCompletedAt() != null)
                        .count());
    }

    @Test
    void dictation_HidesTranscriptUntilTheLearnerChecksTheSegment() {
        LanguagePracticeAttemptResponse started = service.startOrResume(
                "user-1", "resource-1", new StartLanguagePracticeAttemptRequest(LanguagePracticeMode.DICTATION, false));

        assertThat(started.segments()).singleElement().satisfies(segment -> {
            assertThat(segment.transcript()).isNull();
            assertThat(segment.translationVi()).isNull();
            assertThat(segment.ipa()).isNull();
        });
        assertThat(started.youtubeVideoId()).isEqualTo("dQw4w9WgXcQ");

        LanguagePracticeAttemptResponse checked = service.checkDictationAnswer(
                "user-1", "attempt-1", 1, new SaveDictationAnswerRequest("Hello market friend"));

        assertThat(checked.status()).isEqualTo(LanguagePracticeAttemptStatus.COMPLETED);
        assertThat(checked.completedSegmentCount()).isEqualTo(1);
        assertThat(checked.correctDictationSegmentCount()).isEqualTo(1);
        assertThat(checked.segments()).singleElement().satisfies(segment -> {
            assertThat(segment.transcript()).isEqualTo("Hello, market friend!");
            assertThat(segment.translationVi()).isEqualTo("Xin chào người bạn ở chợ!");
            assertThat(segment.dictationCorrect()).isTrue();
        });

        LanguagePracticeAttemptResponse repeatedCheck = service.checkDictationAnswer(
                "user-1", "attempt-1", 1, new SaveDictationAnswerRequest("A different answer"));
        assertThat(repeatedCheck.status()).isEqualTo(LanguagePracticeAttemptStatus.COMPLETED);
        assertThat(repeatedCheck.segments()).singleElement().satisfies(segment -> {
            assertThat(segment.dictationAnswer()).isEqualTo("Hello market friend");
            assertThat(segment.dictationCorrect()).isTrue();
        });
    }

    @Test
    void shadowing_ExposesTranscriptAndPersistsRecordingMetadata() {
        LanguagePracticeAttemptResponse started = service.startOrResume(
                "user-1", "resource-1", new StartLanguagePracticeAttemptRequest(LanguagePracticeMode.SHADOWING, false));

        assertThat(started.segments()).singleElement().extracting(segment -> segment.transcript())
                .isEqualTo("Hello, market friend!");

        LanguagePracticeAttemptResponse saved = service.saveShadowingRecording(
                "user-1", "attempt-1", 1, new SaveShadowingRecordingRequest("recording-file-1", 2_500L));

        assertThat(saved.status()).isEqualTo(LanguagePracticeAttemptStatus.COMPLETED);
        assertThat(saved.segments()).singleElement().satisfies(segment -> {
            assertThat(segment.recordingFileId()).isEqualTo("recording-file-1");
            assertThat(segment.recordingDurationMillis()).isEqualTo(2_500L);
        });
    }

    @Test
    void dictation_DoesNotAllowAnswerChangesAfterTheSegmentWasChecked() {
        service.startOrResume(
                "user-1", "resource-1", new StartLanguagePracticeAttemptRequest(LanguagePracticeMode.DICTATION, false));
        // Keep the attempt open so this test reaches the per-segment immutability guard.
        when(segmentAttemptRepository.countByAttemptIdAndCompletedAtIsNotNullAndDeletedFalse(anyString())).thenReturn(0L);

        service.checkDictationAnswer(
                "user-1", "attempt-1", 1, new SaveDictationAnswerRequest("Hello market friend"));

        assertThatThrownBy(() -> service.saveDictationAnswer(
                "user-1", "attempt-1", 1, new SaveDictationAnswerRequest("A changed answer")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("đã được kiểm tra");
    }

    @Test
    void attempt_RemainsReadableAfterTheResourceWasSoftDeleted() {
        service.startOrResume(
                "user-1", "resource-1", new StartLanguagePracticeAttemptRequest(LanguagePracticeMode.DICTATION, false));
        service.saveDictationAnswer(
                "user-1", "attempt-1", 1, new SaveDictationAnswerRequest("Hello market friend"));
        resource.setDeleted(true);

        LanguagePracticeAttemptResponse restored = service.checkDictationAnswer(
                "user-1", "attempt-1", 1, new SaveDictationAnswerRequest("Hello market friend"));

        assertThat(restored.attemptId()).isEqualTo("attempt-1");
        assertThat(restored.status()).isEqualTo(LanguagePracticeAttemptStatus.COMPLETED);
        assertThat(restored.segments()).singleElement().satisfies(segment ->
                assertThat(segment.transcript()).isEqualTo("Hello, market friend!"));
    }
}
