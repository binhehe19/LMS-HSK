package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsMyAttendanceRecord;

public record MyAttendanceResponse(
        String status,
        String note,
        String recordedAt
) {
    public static MyAttendanceResponse from(CmsMyAttendanceRecord a) {
        if (a == null) return null;
        return new MyAttendanceResponse(a.getAttendanceStatus(), a.getAttendanceNote(), a.getUpdatedAt());
    }
}
