package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

// MySessionResponse (repo-ems, GET /me/classes/{classId}/sessions) - dữ liệu buổi học DÙNG
// CHUNG cho cả lớp (không chứa điểm danh cá nhân), CMS cho phép cache theo classId. Điểm
// danh cá nhân nằm riêng ở CmsMyAttendanceRecord (GET .../my-records), ghép lại ở MeService.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsMySessionShared {
    private String id;
    private String classId;
    private Integer sessionNo;
    private String scheduleItemId;
    private String topic;
    private String content;
    private String studentTasks;
    private java.util.List<CmsMaterialRef> studentMaterials;
    private java.util.List<CmsPracticeModule> moduleOnLuyen;
    private String startAt;
    private String endAt;
    private String status;
    private String room;
    private String meetingLink;
    private String teacherId;
    private String teacherName;
    private CmsTeacherSummary teacher;
    private Integer percentCompleted;
    private String sessionNote;
    private String note;
    private boolean feedbackCheckpoint;
    private Double evaluationStars;
    private boolean attendanceCompleted;
}
