package pl.co.lms.dto.response;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.util.List;
@JsonIgnoreProperties(ignoreUnknown=true) @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CourseCatalogResponse(String id,String code,String name,String description,java.math.BigDecimal price,String status,String classType,String track,String educationLevelCode,Integer totalSessions,String bannerUrl,java.time.Instant createdAt,List<PreviewSession> previewSessions){
 @JsonIgnoreProperties(ignoreUnknown=true) public record PreviewSession(Integer sessionNo,String topic){}
}
