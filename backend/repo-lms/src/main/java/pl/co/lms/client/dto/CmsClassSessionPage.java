package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// GET /management/classes/{classId}/sessions trả về phân trang (ClassSessionPageResponse),
// không phải mảng thẳng — phải bọc qua DTO này rồi lấy .items.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsClassSessionPage {
    private List<CmsClassSession> items;
}
