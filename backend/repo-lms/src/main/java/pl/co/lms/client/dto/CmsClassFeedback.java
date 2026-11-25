package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// GET /management/student-feedback/classes/{classId} (repo-ems) - feedback học viên đánh giá
// giáo viên tại các mốc buổi học cố định. LƯU Ý: ERP ghi rõ "Giáo viên KHÔNG được xem dữ liệu
// này" - proxy này chỉ lộ qua endpoint ROLE_ADMIN (ClassController), giữ đúng phạm vi truy
// cập như ERP (chỉ admin xem được, không thêm role nào khác).
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsClassFeedback {
    private String classId;
    private String classCode;
    private String className;
    private String teacherId;
    private String teacherName;
    private Integer totalLessons;
    private List<CmsFeedbackCheckpoint> checkpoints;
    private List<CmsFeedbackStudent> students;
}
