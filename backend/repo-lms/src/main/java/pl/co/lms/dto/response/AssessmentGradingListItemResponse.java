package pl.co.lms.dto.response;

import pl.co.lms.client.IdentityClient;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentContextType;
import pl.co.lms.entity.AssessmentGradingStatus;

import java.math.BigDecimal;
import java.time.Instant;

// Một dòng trong danh sách bài cần admin chấm/duyệt. hasProvisionalScore: còn câu AI_GRADED chưa duyệt.
// subType/contextType/title cho phép một màn chấm chung cho bài tập thường, Reading, Listening, Writing và Speaking
// (sessionId/sessionNo rỗng với bài tự luyện).
public record AssessmentGradingListItemResponse(
        String attemptId,
        String studentId,
        String sessionId,
        Integer sessionNo,
        String contentPackageVersionId,
        AssessmentAttemptStatus status,
        AssessmentGradingStatus gradingStatus,
        BigDecimal earnedPoints,
        BigDecimal totalPoints,
        Instant submittedAt,
        boolean hasProvisionalScore,
        String subType,
        AssessmentContextType contextType,
        String title,
        String studentName,
        String studentEmail,
        String studentCode
) {
    // user: thông tin tra ở Auth; null khi tra không được (màn hình khi đó chỉ hiện studentId).
    public static AssessmentGradingListItemResponse from(AssessmentAttempt a, boolean hasProvisionalScore, String title,
                                                         IdentityClient.UserSummary user) {
        return new AssessmentGradingListItemResponse(
                a.getId(), a.getUserId(), a.getSessionId(), a.getSessionNo(), a.getContentPackageVersionId(),
                a.getStatus(), a.getGradingStatus(), a.getEarnedPoints(), a.getTotalPoints(),
                a.getSubmittedAt(), hasProvisionalScore, a.getSubType(), a.getContextType(), title,
                user == null ? null : user.getFullName(), user == null ? null : user.getEmail(),
                user == null ? null : user.getUserCode());
    }
}