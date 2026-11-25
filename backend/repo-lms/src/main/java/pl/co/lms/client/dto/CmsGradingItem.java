package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// 1 dòng trong tab "Tiêu chí" (grading_structure) của GET /syllabus/{id}
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsGradingItem {
    private String id;
    private String item;
    private String type;
    private Double weight;
    private String timing;
    private String duration;
    private List<String> cloIds;
    private String organizationalForm;
    private String criteria;
    private String contentScope;
}
