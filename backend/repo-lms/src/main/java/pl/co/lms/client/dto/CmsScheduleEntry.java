package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// 1 dòng trong tab "Lịch trình" (schedule) của GET /syllabus/{id} - khác CmsScheduleItem
// (id + session_no dùng nội bộ cho attempt flow, xem CmsClient.resolveScheduleItemId).
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsScheduleEntry {
    private String id;
    private String topic;
    private String content;
    private String delivery;
    private String sessionLo;
    private List<String> coreCloId;
    private List<String> supportingCloId;
    private String evidence;
    private String itu;
    private List<CmsMaterialRef> studentMaterials;
    private List<CmsMaterialRef> teacherMaterials;
    private List<CmsPracticeModule> moduleOnLuyen;
    private String studentTasks;
    private String teacherTasks;
}
