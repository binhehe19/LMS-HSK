package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pl.co.lms.client.CmsClient;
import pl.co.lms.dto.response.MaterialRefResponse;
import pl.co.lms.dto.response.PracticeModuleResponse;
import pl.co.lms.client.dto.CmsMyAttendanceRecord;
import pl.co.lms.client.dto.CmsMyClass;
import pl.co.lms.client.dto.CmsMySessionShared;
import pl.co.lms.client.dto.CmsMyStudentRecord;
import pl.co.lms.dto.response.ClassSchedulePatternResponse;
import pl.co.lms.dto.response.MyAttendanceResponse;
import pl.co.lms.dto.response.MyAttendanceSummaryResponse;
import pl.co.lms.dto.response.MyClassDetailResponse;
import pl.co.lms.dto.response.MySessionResponse;
import pl.co.lms.dto.response.TeacherSummaryResponse;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

// Ghép chi tiết 1 lớp từ 3 API /me riêng biệt của CMS (xem
// ERP/ERP_Backend/repo-ems/docs/me-apis-documentation.md):
//   1. getMyClasses      - thông tin lớp (không cache, trả theo user)
//   2. getMyClassSessions - buổi học DÙNG CHUNG cả lớp (cache theo classId - không có dữ liệu
//      cá nhân nên cache được, nhưng bản thân endpoint /sessions của CMS vẫn yêu cầu người gọi
//      phải là thành viên lớp; cache ở CmsClient sẽ BỎ QUA việc CMS kiểm tra quyền ở các lần
//      cache hit sau lần đầu -> phải tự verify lại "classId có thuộc getMyClasses() của user
//      này không" trước khi trả dữ liệu đã cache, tránh lộ session/meeting_link cho người
//      không thuộc lớp).
//   3. getMyRecords      - điểm danh + bảng điểm cá nhân (không cache)
@Service
@RequiredArgsConstructor
public class MeService {

    private final CmsClient cmsClient;
    private final StudentCourseReadService studentCourses;

    public MyClassDetailResponse getMyClassDetail(String classId) {
        CmsMyClass myClass = cmsClient.getMyClasses(null).stream()
                .filter(c -> classId.equals(c.getId()))
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN, "Bạn không tham gia lớp học này"));

        List<CmsMySessionShared> sessions = cmsClient.getMyClassSessions(classId);
        CmsMyStudentRecord records = cmsClient.getMyRecords(classId);
        List<CmsMyAttendanceRecord> attendances = records.getAttendances() == null ? List.of() : records.getAttendances();
        Map<String, CmsMyAttendanceRecord> attendanceBySessionId = attendances.stream()
                .collect(Collectors.toMap(CmsMyAttendanceRecord::getSessionId, Function.identity(), (a, b) -> a));

        List<MySessionResponse> sessionResponses = sessions.stream()
                .map(s -> toSessionResponse(s, attendanceBySessionId.get(s.getId())))
                .toList();

        int totalSessions = (int) sessions.stream().filter(s -> !"CANCELLED".equals(s.getStatus())).count();
        int completedSessions = (int) sessions.stream().filter(s -> "DONE".equals(s.getStatus())).count();

        return new MyClassDetailResponse(
                myClass.getId(), myClass.getCode(), myClass.getCourseId(), myClass.getSyllabusId(),
                myClass.getSyllabusVersionId(), myClass.getSyllabusVersionNo(), myClass.getSyllabusName(),
                myClass.getEducationLevelId(), myClass.getEducationLevelCode(), myClass.getEducationLevelName(),
                myClass.getClassType(), myClass.getTrack(), myClass.getExpectedSize(), myClass.getNote(),
                myClass.getStartDate(), myClass.getLifecycleStatus(), myClass.getMeetingLink(),
                myClass.getTeacherId(), TeacherSummaryResponse.from(myClass.getTeacher()),
                myClass.getMentorId(), TeacherSummaryResponse.from(myClass.getMentor()),
                myClass.getStudentManagerId(), TeacherSummaryResponse.from(myClass.getStudentManager()),
                myClass.getSchedulePatterns() == null ? List.of()
                        : myClass.getSchedulePatterns().stream().map(ClassSchedulePatternResponse::from).toList(),
                totalSessions, completedSessions,
                MyAttendanceSummaryResponse.from(attendances),
                sessionResponses, studentCourses.plan(classId));
    }

    private MySessionResponse toSessionResponse(CmsMySessionShared s, CmsMyAttendanceRecord attendance) {
        return new MySessionResponse(
                s.getId(), s.getClassId(), s.getSessionNo(), s.getScheduleItemId(),
                s.getTopic(), s.getContent(), s.getStartAt(), s.getEndAt(), s.getStatus(),
                s.getRoom(), s.getMeetingLink(), s.getTeacherId(), s.getTeacherName(),
                TeacherSummaryResponse.from(s.getTeacher()), s.getPercentCompleted(),
                s.getSessionNote(), s.getNote(), s.isFeedbackCheckpoint(),
                s.getEvaluationStars(), s.isAttendanceCompleted(),
                MyAttendanceResponse.from(attendance),
                attendance == null ? null : attendance.getAttendanceStatus(),
                attendance == null ? null : attendance.getAttendanceNote(),
                attendance == null ? null : attendance.getUpdatedAt(),
                s.getStudentTasks(),
                s.getStudentMaterials() == null ? List.of() : s.getStudentMaterials().stream().map(MaterialRefResponse::from).toList(),
                s.getModuleOnLuyen() == null ? List.of() : s.getModuleOnLuyen().stream().map(PracticeModuleResponse::from).toList());
    }
}
