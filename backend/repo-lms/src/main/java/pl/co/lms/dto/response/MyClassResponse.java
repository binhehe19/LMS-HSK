package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsMyClass;

import java.util.List;

// Danh sách TÓM TẮT lớp học của tôi (GET /me/classes) - không có sessions/myRoles/
// totalSessions/completedSessions (dùng MyClassDetailResponse khi cần đầy đủ). Không có
// "name" - lớp chỉ định danh bằng "code".
public record MyClassResponse(
        String id,
        String code,
        String courseId,
        String courseName,
        String courseBannerUrl,
        String syllabusId,
        String syllabusVersionId,
        Integer syllabusVersionNo,
        String syllabusName,
        String educationLevelId,
        String educationLevelCode,
        String educationLevelName,
        String classType,
        String track,
        Integer expectedSize,
        String note,
        String startDate,
        String lifecycleStatus,
        String meetingLink,
        String teacherId,
        TeacherSummaryResponse teacher,
        String mentorId,
        TeacherSummaryResponse mentor,
        String studentManagerId,
        TeacherSummaryResponse studentManager,
        List<ClassSchedulePatternResponse> schedulePatterns
) {
    public static MyClassResponse from(CmsMyClass c) {
        return new MyClassResponse(
                c.getId(), c.getCode(), c.getCourseId(), c.getCourseName(), c.getCourseBannerUrl(), c.getSyllabusId(), c.getSyllabusVersionId(),
                c.getSyllabusVersionNo(), c.getSyllabusName(),
                c.getEducationLevelId(), c.getEducationLevelCode(), c.getEducationLevelName(),
                c.getClassType(), c.getTrack(),
                c.getExpectedSize(), c.getNote(), c.getStartDate(), c.getLifecycleStatus(), c.getMeetingLink(),
                c.getTeacherId(), TeacherSummaryResponse.from(c.getTeacher()),
                c.getMentorId(), TeacherSummaryResponse.from(c.getMentor()),
                c.getStudentManagerId(), TeacherSummaryResponse.from(c.getStudentManager()),
                c.getSchedulePatterns() == null ? List.of()
                        : c.getSchedulePatterns().stream().map(ClassSchedulePatternResponse::from).toList());
    }
}
