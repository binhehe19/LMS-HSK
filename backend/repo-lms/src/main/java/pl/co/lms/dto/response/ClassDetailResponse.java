package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsClassDetail;

import java.util.List;

public record ClassDetailResponse(
        String id,
        String courseId,
        String syllabusId,
        String syllabusVersionId,
        Integer syllabusVersionNo,
        String syllabusName,
        String educationLevelId,
        String educationLevelCode,
        String educationLevelName,
        String code,
        String name,
        String classType,
        String track,
        Integer expectedSize,
        String note,
        String startDate,
        String lifecycleStatus,
        String meetingLink,
        Double price,
        Double baseTeacherPay,
        String teacherId,
        TeacherSummaryResponse teacher,
        String mentorId,
        TeacherSummaryResponse mentor,
        String studentManagerId,
        TeacherSummaryResponse studentManager,
        List<ClassSchedulePatternResponse> schedulePatterns,
        String createdAt,
        String updatedAt
) {
    public static ClassDetailResponse from(CmsClassDetail c) {
        return new ClassDetailResponse(
                c.getId(), c.getCourseId(), c.getSyllabusId(), c.getSyllabusVersionId(),
                c.getSyllabusVersionNo(), c.getSyllabusName(),
                c.getEducationLevelId(), c.getEducationLevelCode(), c.getEducationLevelName(),
                c.getCode(), c.getName(), c.getClassType(), c.getTrack(), c.getExpectedSize(),
                c.getNote(), c.getStartDate(), c.getLifecycleStatus(), c.getMeetingLink(),
                c.getPrice(), c.getBaseTeacherPay(),
                c.getTeacherId(), TeacherSummaryResponse.from(c.getTeacher()),
                c.getMentorId(), TeacherSummaryResponse.from(c.getMentor()),
                c.getStudentManagerId(), TeacherSummaryResponse.from(c.getStudentManager()),
                c.getSchedulePatterns() == null ? List.of()
                        : c.getSchedulePatterns().stream().map(ClassSchedulePatternResponse::from).toList(),
                c.getCreatedAt(), c.getUpdatedAt());
    }
}
