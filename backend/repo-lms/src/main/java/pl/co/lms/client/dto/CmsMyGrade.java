package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

// 1 đầu điểm trong CmsMyStudentRecord.grades[] (GET .../my-records) - chưa có UI tiêu thụ,
// giữ lại đầy đủ để sẵn sàng cho tính năng bảng điểm sau này (xem plans/260924-...).
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsMyGrade {
    private String gradingItemId;
    private String name;
    private String type;
    private Integer weight;
    private BigDecimal score;
    private BigDecimal maxScore;
    private String note;
}
