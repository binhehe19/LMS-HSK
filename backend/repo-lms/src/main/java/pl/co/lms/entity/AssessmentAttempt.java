package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;

// 1 lượt một người làm một QUIZ resource (bài tập thường hoặc đề IELTS Reading/Listening/Writing/Speaking).
// contextType = CLASS_SESSION: làm trong buổi học của lớp, contentPackage*/session* bắt buộc có (CHECK ở DatabaseIndexInitializer).
// contextType = SELF_STUDY: tự luyện, contentPackage*/session* để trống.
// learningResourceId/learningResourceVersionId: QUIZ resource cụ thể (khoá "bài" cho tiến độ); version đã publish là bất biến
// nên không cần chụp lại nội dung đề trong lượt làm.
@Entity
@Table(
    name = "assessment_attempts",
    indexes = {
        @Index(name = "idx_assessment_attempts_user_resource", columnList = "user_id, learning_resource_id"),
        @Index(name = "idx_assessment_attempts_user_type_status", columnList = "user_id, sub_type, status"),
        @Index(name = "idx_assessment_attempts_pkg_id", columnList = "content_package_id")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssessmentAttempt extends BaseEntity {

    // Chủ lượt làm (đặt tường minh, không dựa vào created_by của cơ chế audit).
    @Column(name = "user_id", nullable = false, length = 26)
    private String userId;

    // Chụp loại phụ (ResourceSubTypes) của bài tại lúc bắt đầu làm.
    @Builder.Default
    @Column(name = "sub_type", nullable = false, length = 30)
    private String subType = ResourceSubTypes.QUIZ;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "context_type", nullable = false, length = 20)
    private AssessmentContextType contextType = AssessmentContextType.CLASS_SESSION;

    // Khoá phân biệt các "ngăn" làm bài của cùng một người trên cùng một bài: CLASS_SESSION = session_id,
    // SELF_STUDY = "SELF:<mode>[:<variant>]". Partial unique (user_id, learning_resource_id, context_key)
    // WHERE deleted=false AND status='IN_PROGRESS' (xem DatabaseIndexInitializer) chặn 2 bài đang làm dở cùng lúc.
    @Column(name = "context_key", nullable = false, length = 80)
    private String contextKey;

    // timed | untimed (tự luyện); null với bài trong lớp.
    @Column(length = 10)
    private String mode;

    // Khoá lạc quan cho client_state/settings khi lưu từ nhiều phiên.
    @Builder.Default
    @Column(nullable = false)
    private long revision = 0;

    // Tuỳ chọn lúc bắt đầu (VD method của Writing).
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private JsonNode settings;

    // Trạng thái giao diện cần khôi phục (cờ câu, annotation, vị trí câu, bản nháp từng bước...).
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "client_state", columnDefinition = "jsonb")
    private JsonNode clientState;

    // AUTO | AI | MANUAL: cách chấm của lần chấm gần nhất (thông tin hiển thị cho giáo viên).
    @Column(name = "grading_method", length = 10)
    private String gradingMethod;

    @Column(name = "grading_detail", length = 30)
    private String gradingDetail;

    @Column(name = "grading_message", length = 500)
    private String gradingMessage;

    // Lưu cả packageId (khung) lẫn packageVersionId (bản cụ thể đã dùng) để truy vấn theo học phần
    // không cần join qua content_package_versions mỗi lần. Rỗng với SELF_STUDY.
    @Column(name = "content_package_id", length = 26)
    private String contentPackageId;

    @Column(name = "content_package_version_id", length = 26)
    private String contentPackageVersionId;

    // QUIZ resource (khoá "bài" ổn định qua các version để tính tiến độ học viên).
    @Column(name = "learning_resource_id", nullable = false, length = 26)
    private String learningResourceId;

    @Column(name = "learning_resource_version_id", nullable = false, length = 26)
    private String learningResourceVersionId;

    // Buổi học thật (CMS session, gắn với 1 lớp + 1 ngày cụ thể). Rỗng với SELF_STUDY.
    @Column(name = "session_id", length = 26)
    private String sessionId;

    @Column(name = "session_no")
    private Integer sessionNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AssessmentAttemptStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "grading_status", nullable = false, length = 20)
    private AssessmentGradingStatus gradingStatus;

    // ends_at = created_at + giới hạn của chế độ (QuizContent.limitSeconds) (từ QuizContent của learningResourceVersionId).
    // Null nghĩa là không giới hạn giờ.
    @Column(name = "ends_at")
    private Instant endsAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    /**
     * Thời gian nộp muộn sau ends_at: trong khoảng này heartbeat vẫn lưu đáp án và submit vẫn nhận đáp án.
     * Qua mốc này bài được coi là hết giờ (TIME_OUT); job đóng bài chạy sau mốc này.
     */
    public static final Duration SUBMIT_GRACE = Duration.ofMinutes(2);

    /** Trạng thái hiệu lực: IN_PROGRESS nhưng đã qua ends_at + SUBMIT_GRACE thì là TIME_OUT (chưa cần job đóng bài). */
    public AssessmentAttemptStatus effectiveStatus(Instant now) {
        if (status == AssessmentAttemptStatus.IN_PROGRESS && endsAt != null && now.isAfter(endsAt.plus(SUBMIT_GRACE))) {
            return AssessmentAttemptStatus.TIME_OUT;
        }
        return status;
    }

    @Builder.Default
    @Column(name = "total_points", nullable = false, precision = 6, scale = 2)
    private BigDecimal totalPoints = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "earned_points", nullable = false, precision = 6, scale = 2)
    private BigDecimal earnedPoints = BigDecimal.ZERO;
}
