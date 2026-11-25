package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// GET /syllabus/{syllabusId} (repo-ems) - trả toàn bộ nội dung soạn thảo của giáo trình
// (đang PUBLISHED): thông tin cơ bản + CLO + tài liệu + lịch trình + tiêu chí đánh giá +
// bài kiểm tra mẫu, dùng cho màn "Giáo trình" (tham khảo).
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsSyllabusDetail {
    private String id;
    private String name;
    private String code;
    private String status;
    private String educationLevelId;
    private String educationLevelCode;
    private String educationLevelName;
    private Integer latestVersionNo;
    private String createdAt;
    private String updatedAt;
    private String documentType;
    private String trainingProgram;
    private String prerequisite;
    private String type;
    private String distributionHours;
    private String author;
    private String teachingMethods;
    private String learningTools;
    private String minimumPassingScore;
    private String scoreRange;
    private String description;
    private String studentResponsibilities;
    private String notes;
    private List<CmsClo> clo;
    private List<CmsSyllabusMaterial> materials;
    private List<CmsScheduleEntry> schedule;
    private List<CmsGradingItem> gradingStructure;
    private CmsTestTemplate testTemplate;
    private List<CmsSyllabusVersionSummary> versions;
}
