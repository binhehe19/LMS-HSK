package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// MyClassResponse (repo-ems, GET /me/classes) - danh sách TÓM TẮT lớp học của người dùng
// hiện tại (tự scope theo JWT), khác CmsClassSummary/CmsClassDetail (admin, ROLE_ADMIN).
// KHÔNG có sessions/myRoles/totalSessions/completedSessions (API list tối ưu tốc độ tối đa;
// sessions tách sang GET /me/classes/{classId}/sessions, FE tự map role nếu cần - xem
// me-apis-documentation.md mục 1.3). Không có "name" - lớp chỉ định danh bằng "code".
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsMyClass {
    private String id;
    private String code;
    private String courseId;
    private String courseName;
    private String courseBannerUrl;
    private String syllabusId;
    private String syllabusVersionId;
    private Integer syllabusVersionNo;
    private String syllabusName;
    private String educationLevelId;
    private String educationLevelCode;
    private String educationLevelName;
    private String classType;
    private String track;
    private Integer expectedSize;
    private String note;
    private String startDate;
    private String lifecycleStatus;
    private String meetingLink;
    private String teacherId;
    private CmsTeacherSummary teacher;
    private String mentorId;
    private CmsTeacherSummary mentor;
    private String studentManagerId;
    private CmsTeacherSummary studentManager;
    private List<CmsClassSchedulePattern> schedulePatterns;
}
