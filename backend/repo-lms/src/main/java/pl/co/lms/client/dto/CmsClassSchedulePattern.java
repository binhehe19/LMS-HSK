package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

// Mirror ClassSchedulePatternResponse (repo-ems) - dayOfWeek/status là enum bên CMS, đọc
// thẳng thành String vì LMS chỉ hiển thị, không xử lý logic theo enum đó.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsClassSchedulePattern {
    private String id;
    private String classId;
    private String dayOfWeek;
    private String startTime;
    private String endTime;
}
