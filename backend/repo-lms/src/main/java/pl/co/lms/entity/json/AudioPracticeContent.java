package pl.co.lms.entity.json;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Nội dung bất biến của một LearningResource AUDIO_PRACTICE.
 * Transcript và acceptedDictationAnswers chỉ được service người học dùng để chấm; endpoint
 * người học không trả transcript khi đang làm Dictation cho tới lúc đoạn đó đã được kiểm tra.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AudioPracticeContent {
    private String title;
    private String description;
    private String level;
    private String topic;
    private String audioFileId;
    private String audioFileName;
    private String audioMimeType;
    /** YouTube video ID (11 characters). Used as an alternative source to a stored audio file. */
    private String youtubeVideoId;
    private Long durationMillis;
    private Boolean shadowingEnabled;
    private Boolean dictationEnabled;
    private List<AudioPracticeSegment> segments;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AudioPracticeSegment {
        private Integer segmentNo;
        private Long startMillis;
        private Long endMillis;
        private String transcript;
        private List<String> acceptedDictationAnswers;
        private String translationVi;
        private String ipa;
    }
}
