package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// MyStudentRecordResponse (repo-ems, GET /me/classes/{classId}/my-records) - dữ liệu CÁ NHÂN
// của 1 học viên trong lớp (điểm danh + bảng điểm), đọc thẳng bảng attendance/enrollment,
// không join session. KHÔNG cache - khác người gọi khác dữ liệu.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsMyStudentRecord {
    private String classId;
    private String studentId;
    private List<CmsMyAttendanceRecord> attendances;
    private List<CmsMyGrade> grades;
}
