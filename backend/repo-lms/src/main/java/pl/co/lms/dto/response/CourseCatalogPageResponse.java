package pl.co.lms.dto.response;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.util.List;
@JsonIgnoreProperties(ignoreUnknown=true) @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CourseCatalogPageResponse(List<CourseCatalogResponse> items,long totalElements,int totalPages,int page,int size){}
