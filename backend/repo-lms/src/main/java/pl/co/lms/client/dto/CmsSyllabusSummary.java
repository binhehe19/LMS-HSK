package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

// GET /syllabus (repo-ems) - dùng cho dropdown chọn giáo trình ở màn quản trị.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsSyllabusSummary {
    private String id;
    private String name;
    private String code;
    private String educationLevelId;
    private String educationLevelCode;
    private String educationLevelName;
    private String type;
    private String author;
    private Integer latestVersionNo;
    private String createdAt;
}
