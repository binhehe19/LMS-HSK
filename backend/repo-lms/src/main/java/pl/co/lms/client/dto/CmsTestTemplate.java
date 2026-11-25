package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

// tab "Bài kiểm tra mẫu" (test_template) của GET /syllabus/{id}
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsTestTemplate {
    private String id;
    private String midtermFormat;
    private String finalFormat;
    private String notes;
}
