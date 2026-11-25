package pl.co.lms.dto.response;

import java.time.Instant;

/**
 * transcript chỉ có trong response Shadowing, hoặc Dictation sau lần check đầu tiên của chính học viên.
 * acceptedDictationAnswers tuyệt đối không đi qua DTO này.
 */
public record LanguagePracticeSegmentResponse(
        int segmentNo,
        long startMillis,
        long endMillis,
        String transcript,
        String translationVi,
        String ipa,
        String dictationAnswer,
        Boolean dictationCorrect,
        Instant dictationCheckedAt,
        String recordingFileId,
        Long recordingDurationMillis,
        Instant completedAt
) {}
