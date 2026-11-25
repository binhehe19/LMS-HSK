package pl.co.lms.dto.response;

import pl.co.lms.entity.LanguagePracticeAttemptStatus;
import pl.co.lms.entity.LanguagePracticeMode;

import java.time.Instant;
import java.util.List;

public record LanguagePracticeAttemptResponse(
        String attemptId,
        String resourceId,
        String resourceVersionId,
        LanguagePracticeMode mode,
        LanguagePracticeAttemptStatus status,
        String title,
        String description,
        String level,
        String topic,
        String audioFileId,
        String audioFileName,
        String audioMimeType,
        String youtubeVideoId,
        Long durationMillis,
        int completedSegmentCount,
        int correctDictationSegmentCount,
        int totalSegmentCount,
        Instant startedAt,
        Instant completedAt,
        List<LanguagePracticeSegmentResponse> segments
) {}
