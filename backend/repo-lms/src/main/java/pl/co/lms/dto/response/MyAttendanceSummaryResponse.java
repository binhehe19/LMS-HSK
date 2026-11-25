package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsMyAttendanceRecord;

import java.util.List;

// CMS không còn trả sẵn tổng kết chuyên cần (API cũ /me/classes/{id} đã bỏ) - giờ tự tính từ
// danh sách attendances[] thô của GET /me/classes/{classId}/my-records ở MeService.
public record MyAttendanceSummaryResponse(
        Integer totalRecorded,
        Integer presentCount,
        Integer lateCount,
        Integer absentCount,
        Integer excusedCount,
        Double attendanceRate
) {
    public static MyAttendanceSummaryResponse from(List<CmsMyAttendanceRecord> attendances) {
        if (attendances == null || attendances.isEmpty()) {
            return new MyAttendanceSummaryResponse(0, 0, 0, 0, 0, null);
        }
        int present = countByStatus(attendances, "PRESENT");
        int late = countByStatus(attendances, "LATE");
        int absent = countByStatus(attendances, "ABSENT");
        int excused = countByStatus(attendances, "EXCUSED");
        int total = attendances.size();
        double rate = Math.round(((double) (present + late) / total * 100.0) * 10.0) / 10.0;
        return new MyAttendanceSummaryResponse(total, present, late, absent, excused, rate);
    }

    private static int countByStatus(List<CmsMyAttendanceRecord> attendances, String status) {
        return (int) attendances.stream().filter(a -> status.equals(a.getAttendanceStatus())).count();
    }
}
