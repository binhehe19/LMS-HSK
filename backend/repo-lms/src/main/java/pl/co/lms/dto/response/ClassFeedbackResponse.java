package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsClassFeedback;

import java.util.List;

public record ClassFeedbackResponse(
        String classId,
        String classCode,
        String className,
        String teacherId,
        String teacherName,
        Integer totalLessons,
        List<FeedbackCheckpointResponse> checkpoints,
        List<FeedbackStudentResponse> students
) {
    public static ClassFeedbackResponse from(CmsClassFeedback f) {
        return new ClassFeedbackResponse(
                f.getClassId(), f.getClassCode(), f.getClassName(), f.getTeacherId(), f.getTeacherName(),
                f.getTotalLessons(),
                f.getCheckpoints() == null ? List.of() : f.getCheckpoints().stream().map(FeedbackCheckpointResponse::from).toList(),
                f.getStudents() == null ? List.of() : f.getStudents().stream().map(FeedbackStudentResponse::from).toList());
    }
}
