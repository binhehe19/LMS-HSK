package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// GET /management/classes/{classId} (repo-ems) - dùng cho màn "Danh sách lớp" > xem chi tiết
// lớp (tham khảo). Field khớp response thật của CMS, xác nhận qua Network tab ngày 2026-09-22.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsClassDetail {
    private String id;
    private String courseId;
    private String syllabusId;
    private String syllabusVersionId;
    private Integer syllabusVersionNo;
    private String syllabusName;
    private String educationLevelId;
    private String educationLevelCode;
    private String educationLevelName;
    private String code;
    private String name;
    private String classType;
    private String track;
    private Integer expectedSize;
    private String note;
    private String startDate;
    private String lifecycleStatus;
    private String meetingLink;
    private Double price;
    private Double baseTeacherPay;
    private String meetingLinkSource;
    private String teacherId;
    private CmsTeacherSummary teacher;
    private String mentorId;
    private CmsTeacherSummary mentor;
    private String studentManagerId;
    private CmsTeacherSummary studentManager;
    private List<CmsClassSchedulePattern> schedulePatterns;
    private String createdAt;
    private String updatedAt;
}
