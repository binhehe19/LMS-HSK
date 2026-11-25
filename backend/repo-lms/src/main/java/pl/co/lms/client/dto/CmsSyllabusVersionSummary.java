package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

// GET /syllabus/{syllabusId}/versions (repo-ems) - dùng cho dropdown chọn phiên bản giáo
// trình sau khi đã chọn giáo trình.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsSyllabusVersionSummary {
    private String id;
    private Integer versionNo;
    private String status;
    private String publishedAt;
    private String publishedBy;
    private String changeNote;
}
