package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Dữ liệu người học theo từng đoạn: nháp/chấm Dictation hoặc file ghi âm Shadowing. */
@Entity
@Table(
        name = "language_practice_segment_attempts",
        indexes = {
                @Index(name = "idx_lpsa_attempt_id", columnList = "attempt_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LanguagePracticeSegmentAttempt extends BaseEntity {

    @Column(name = "attempt_id", nullable = false, length = 26)
    private String attemptId;

    @Column(name = "segment_no", nullable = false)
    private int segmentNo;

    @Column(name = "dictation_answer", columnDefinition = "TEXT")
    private String dictationAnswer;

    @Column(name = "dictation_correct")
    private Boolean dictationCorrect;

    @Column(name = "dictation_checked_at")
    private Instant dictationCheckedAt;

    @Column(name = "recording_file_id", length = 26)
    private String recordingFileId;

    @Column(name = "recording_duration_millis")
    private Long recordingDurationMillis;

    // Không phân biệt đúng/sai: người học kiểm tra xong Dictation hoặc lưu một bản ghi Shadowing là hoàn thành đoạn.
    @Column(name = "completed_at")
    private Instant completedAt;
}
