package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsAttendanceSummary;

public record AttendanceSummaryResponse(
        Integer presentCount,
        Integer totalCount,
        Double percentage
) {
    public static AttendanceSummaryResponse from(CmsAttendanceSummary a) {
        if (a == null) return null;
        return new AttendanceSummaryResponse(a.getPresentCount(), a.getTotalCount(), a.getPercentage());
    }
}
