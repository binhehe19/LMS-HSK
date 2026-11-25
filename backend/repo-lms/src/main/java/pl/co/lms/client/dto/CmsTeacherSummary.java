package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// Subset của TeacherResponse (repo-ems) - dùng chung cho teacher/mentor/student_manager của
// class detail và teacher của từng session (GET /management/classes/{id}[/sessions]).
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsTeacherSummary {
    private String id;
    private String fullName;
    private String email;
    private String avatarUrl;
    private String status;
    private List<String> roles;
    private List<String> tags;
    private String emailStatus;
    private String emailStatusReason;
}
