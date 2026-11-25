package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsClassSession;

public record ClassSessionResponse(
        String id,
        Integer sessionNo,
        String startAt,
        String endAt,
        String teacherId,
        TeacherSummaryResponse teacher,
        String room,
        String meetingLink,
        String status,
        Integer percentCompleted,
        String note,
        Double evaluationStars,
        String evaluationNote
) {
    public static ClassSessionResponse from(CmsClassSession s) {
        return new ClassSessionResponse(
                s.getId(), s.getSessionNo(), s.getStartAt(), s.getEndAt(),
                s.getTeacherId(), TeacherSummaryResponse.from(s.getTeacher()),
                s.getRoom(), s.getMeetingLink(), s.getStatus(), s.getPercentCompleted(),
                s.getNote(), s.getEvaluationStars(), s.getEvaluationNote());
    }
}
