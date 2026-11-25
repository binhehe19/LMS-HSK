package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// Mirror CourseClassSummaryResponse (repo-ems, GET /management/classes) - dùng cho màn
// "Danh sách lớp" (tham khảo). LƯU Ý: bản summary này KHÔNG có syllabusVersionId (chỉ có ở
// CmsClassDetail/GET .../{classId}) - "giáo trình đang dùng" hiển thị bằng courseName.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsClassSummary {
    private String id;
    private String code;
    private String name;
    private String courseId;
    private String courseName;
    private String classType;
    private String track;
    private String startDate;
    private String lifecycleStatus;
    private Integer expectedSize;
    private String teacherId;
    private CmsTeacherSummary teacher;
    private List<CmsClassSchedulePattern> schedulePatterns;
    private String educationLevelId;
    private String educationLevelCode;
    private String educationLevelName;
}
