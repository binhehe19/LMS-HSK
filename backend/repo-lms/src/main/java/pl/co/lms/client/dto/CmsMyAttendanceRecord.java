package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

// 1 bản ghi điểm danh trong CmsMyStudentRecord.attendances[] (GET .../my-records) - khớp
// với đúng 1 session qua sessionId, ghép lại vào CmsMySessionShared tương ứng ở MeService.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsMyAttendanceRecord {
    private String sessionId;
    private String attendanceStatus;
    private String attendanceNote;
    private String updatedAt;
}
