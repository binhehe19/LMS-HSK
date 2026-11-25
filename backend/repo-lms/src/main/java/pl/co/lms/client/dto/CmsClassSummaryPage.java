package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// GET /management/classes (repo-ems) trả về phân trang (base.co.common.dto.PageResponse) -
// bọc qua DTO này để đọc đúng camelCase -> snake_case field từ CMS, mirror CmsClassSessionPage.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsClassSummaryPage {
    private List<CmsClassSummary> items;
    private long totalElements;
    private int totalPages;
    private int page;
    private int size;
}
