package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsEnrollment;

public record EnrollmentResponse(
        String id,
        String studentId,
        String studentFullName,
        String studentEmail,
        String studentAvatarUrl,
        String studentUserCode,
        String studentPhone,
        String status,
        String enrolledAt,
        String withdrawnAt,
        ScoreSummaryResponse scoreSummary,
        AttendanceSummaryResponse attendanceSummary,
        String note
) {
    public static EnrollmentResponse from(CmsEnrollment e) {
        return new EnrollmentResponse(
                e.getId(), e.getStudentId(), e.getStudentFullName(), e.getStudentEmail(),
                e.getStudentAvatarUrl(), e.getStudentUserCode(), e.getStudentPhone(),
                e.getStatus(), e.getEnrolledAt(), e.getWithdrawnAt(),
                ScoreSummaryResponse.from(e.getScoreSummary()),
                AttendanceSummaryResponse.from(e.getAttendanceSummary()),
                e.getNote());
    }
}
