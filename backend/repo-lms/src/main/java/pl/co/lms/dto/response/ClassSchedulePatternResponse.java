package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsClassSchedulePattern;

public record ClassSchedulePatternResponse(
        String dayOfWeek,
        String startTime,
        String endTime
) {
    public static ClassSchedulePatternResponse from(CmsClassSchedulePattern p) {
        return new ClassSchedulePatternResponse(p.getDayOfWeek(), p.getStartTime(), p.getEndTime());
    }
}
