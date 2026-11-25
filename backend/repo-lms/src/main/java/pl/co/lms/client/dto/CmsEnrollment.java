package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

// GET /management/enrollments?class_id={id} (repo-ems) - dùng cho tab "Học viên" ở màn chi
// tiết lớp (tham khảo). Field khớp response thật, xác nhận qua Network tab 2026-09-22.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsEnrollment {
    private String id;
    private String classId;
    private String studentId;
    private String studentFullName;
    private String studentEmail;
    private String studentAvatarUrl;
    private String studentUserCode;
    private String studentPhone;
    private String status;
    private String enrolledAt;
    private String withdrawnAt;
    private CmsScoreSummary scoreSummary;
    private CmsAttendanceSummary attendanceSummary;
    private String note;
}
