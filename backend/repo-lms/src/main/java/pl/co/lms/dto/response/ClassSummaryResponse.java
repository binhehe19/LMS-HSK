package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsClassSummary;

import java.util.List;

// Xem ghi chú ở SyllabusSummaryResponse - tách khỏi CmsClassSummary (client DTO,
// @JsonNaming(SnakeCaseStrategy) để đọc từ CMS) để trả camelCase đúng hợp đồng cho FE.
public record ClassSummaryResponse(
        String id,
        String code,
        String name,
        String courseId,
        String courseName,
        String classType,
        String track,
        String startDate,
        String lifecycleStatus,
        Integer expectedSize,
        String teacherId,
        TeacherSummaryResponse teacher,
        List<ClassSchedulePatternResponse> schedulePatterns,
        String educationLevelId,
        String educationLevelCode,
        String educationLevelName
) {
    public static ClassSummaryResponse from(CmsClassSummary c) {
        return new ClassSummaryResponse(
                c.getId(), c.getCode(), c.getName(),
                c.getCourseId(), c.getCourseName(),
                c.getClassType(), c.getTrack(), c.getStartDate(), c.getLifecycleStatus(),
                c.getExpectedSize(), c.getTeacherId(), TeacherSummaryResponse.from(c.getTeacher()),
                c.getSchedulePatterns() == null ? List.of()
                        : c.getSchedulePatterns().stream().map(ClassSchedulePatternResponse::from).toList(),
                c.getEducationLevelId(), c.getEducationLevelCode(), c.getEducationLevelName());
    }
}
