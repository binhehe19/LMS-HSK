package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

// GET /management/classes/{classId}/sessions (repo-ems) - id + session_no dùng nội bộ cho
// CmsClient.resolveScheduleItemId (attempt flow), các field còn lại dùng cho màn "Chi tiết lớp
// học" > tab Buổi học (tham khảo). Field khớp response thật, xác nhận qua Network tab 2026-09-22.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsClassSession {
    private String id;
    private String classId;
    private Integer sessionNo;
    private String startAt;
    private String endAt;
    private String teacherId;
    private CmsTeacherSummary teacher;
    private String room;
    private String meetingLink;
    private String status;
    private Boolean outsideOutline;
    private Double teacherPay;
    private Integer percentCompleted;
    private String note;
    private Double evaluationStars;
    private String evaluationNote;
    private String evaluatedBy;
    private String evaluatedAt;
}
