package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsScheduleEntry;

import java.util.List;

public record ScheduleEntryResponse(
        String id,
        String topic,
        String content,
        String delivery,
        String sessionLo,
        List<String> coreCloId,
        List<String> supportingCloId,
        String evidence,
        String itu,
        List<MaterialRefResponse> studentMaterials,
        List<MaterialRefResponse> teacherMaterials,
        List<PracticeModuleResponse> moduleOnLuyen,
        String studentTasks,
        String teacherTasks
) {
    public static ScheduleEntryResponse from(CmsScheduleEntry e) {
        return new ScheduleEntryResponse(
                e.getId(), e.getTopic(), e.getContent(), e.getDelivery(), e.getSessionLo(),
                e.getCoreCloId() == null ? List.of() : e.getCoreCloId(),
                e.getSupportingCloId() == null ? List.of() : e.getSupportingCloId(),
                e.getEvidence(), e.getItu(),
                e.getStudentMaterials() == null ? List.of()
                        : e.getStudentMaterials().stream().map(MaterialRefResponse::from).toList(),
                e.getTeacherMaterials() == null ? List.of()
                        : e.getTeacherMaterials().stream().map(MaterialRefResponse::from).toList(),
                e.getModuleOnLuyen() == null ? List.of()
                        : e.getModuleOnLuyen().stream().map(PracticeModuleResponse::from).toList(),
                e.getStudentTasks(), e.getTeacherTasks());
    }
}
