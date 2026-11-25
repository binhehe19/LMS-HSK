package pl.co.lms.dto.response;

import java.util.List;

// Chi tiết trọn gói 1 lớp học của tôi (GET /me/classes/{classId}) - dùng cho trang
// classes?id=<classId>. Ghép từ 3 nguồn ở MeService: CmsMyClass (thông tin lớp, không cache
// vì GET /me/classes trả cả danh sách theo user), CmsMySessionShared[] (sessions, cache theo
// classId) và CmsMyAttendanceRecord[] (điểm danh cá nhân, không cache).
public record MyClassDetailResponse(
        String id,
        String code,
        String courseId,
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
        List<ClassSchedulePatternResponse> schedulePatterns,
        Integer totalSessions,
        Integer completedSessions,
        MyAttendanceSummaryResponse myAttendanceSummary,
        List<MySessionResponse> sessions,
        StudentLearningPlanResponse learningPlan
) {
}
