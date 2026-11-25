package pl.co.lms.dto.response;

// Buổi học đã ghép: phần chung (CmsMySessionShared, cache theo classId) + điểm danh cá nhân
// (CmsMyAttendanceRecord, không cache) - việc ghép thực hiện ở MeService, không còn 1 DTO CMS
// nào trả nguyên hình dạng này nữa (trước đây là CmsMySession, đã bỏ cùng API cũ).
public record MySessionResponse(
        String id,
        String classId,
        Integer sessionNo,
        String scheduleItemId,
        String topic,
        String content,
        String startAt,
        String endAt,
        String status,
        String room,
        String meetingLink,
        String teacherId,
        String teacherName,
        TeacherSummaryResponse teacher,
        Integer percentCompleted,
        String sessionNote,
        String note,
        boolean feedbackCheckpoint,
        Double evaluationStars,
        boolean attendanceCompleted,
        MyAttendanceResponse myAttendance,
        String myAttendanceStatus,
        String myAttendanceNote,
        String myAttendanceRecordedAt,
        String studentTasks,
        java.util.List<MaterialRefResponse> studentMaterials,
        java.util.List<PracticeModuleResponse> moduleOnLuyen
) {
}
