package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// GET /syllabus/search (repo-ems) - trang giáo trình đã lọc ở server, mirror CmsClassSummaryPage.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsSyllabusPage {
    private List<CmsSyllabusSummary> items;
    private long totalElements;
    private int totalPages;
    private int page;
    private int size;
}
