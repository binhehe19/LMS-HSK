package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.dto.request.AcquireAssessmentLockRequest;
import pl.co.lms.dto.request.SaveAssessmentManualGradingRequest;
import pl.co.lms.dto.response.AssessmentGradingDetailResponse;
import pl.co.lms.dto.response.AssessmentGradingListItemResponse;
import pl.co.lms.dto.response.AssessmentLockResponse;
import pl.co.lms.entity.AssessmentContextType;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.security.LmsSecurityRoles;
import pl.co.lms.service.AssessmentManualGradingService;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/management/assessment-attempts")
@RequiredArgsConstructor
@PreAuthorize(LmsSecurityRoles.GRADING_MANAGE)
public class AssessmentGradingManagementController {

    private final AssessmentManualGradingService manualGradingService;

    // Mặc định lọc gradingStatus=MANUAL_GRADING; allStatuses=true: mọi bài đã nộp, mọi trạng thái chấm (bỏ qua gradingStatus); subType lọc theo loại phụ (bỏ trống = mọi loại);
    // contextType tách bài trong lớp (CLASS_SESSION) khỏi bài tự luyện (SELF_STUDY), bỏ trống = cả hai. provisionalOnly=true: chỉ bài còn điểm AI chưa duyệt (bỏ qua subType).
    // keyword: một từ khoá tìm chung, khớp tên/email/mã học sinh hoặc tên bài; classId: chỉ bài làm trong các buổi của lớp; sessionNo: chỉ bài làm ở buổi số N.
    // startedFrom/startedTo (yyyy-MM-dd, gồm cả hai đầu): khoảng ngày bắt đầu làm bài, giờ Việt Nam.
    // studentSearchTruncated=true: từ khoá học sinh khớp quá nhiều người, kết quả có thể chưa đầy đủ.
    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> list(
            @RequestParam(required = false) AssessmentGradingStatus gradingStatus,
            @RequestParam(defaultValue = "false") boolean allStatuses,
            @RequestParam(required = false) String subType,
            @RequestParam(required = false) AssessmentContextType contextType,
            @RequestParam(defaultValue = "false") boolean provisionalOnly,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String classId,
            @RequestParam(required = false) Integer sessionNo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startedFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startedTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        AssessmentManualGradingService.ListResult listed = manualGradingService.list(new AssessmentManualGradingService.ListQuery(
                gradingStatus, allStatuses, subType, contextType, provisionalOnly, keyword, classId, sessionNo, startedFrom, startedTo, page, size));
        Page<AssessmentGradingListItemResponse> result = listed.page();
        List<AssessmentGradingListItemResponse> items = result.getContent();
        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "items", items,
                "page", result.getNumber(),
                "size", result.getSize(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                "studentSearchTruncated", listed.studentSearchTruncated())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AssessmentGradingDetailResponse>> detail(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(manualGradingService.detail(id)));
    }

    // Chiếm hoặc gia hạn khoá chấm; gọi định kỳ như heartbeat trong lúc admin đang chấm.
    @PostMapping("/{id}/lock")
    public ResponseEntity<ApiResponse<AssessmentLockResponse>> acquireLock(
            @PathVariable String id, @Valid @RequestBody AcquireAssessmentLockRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(manualGradingService.acquireLock(id, req)));
    }

    @DeleteMapping("/{id}/lock")
    public ResponseEntity<ApiResponse<AssessmentLockResponse>> releaseLock(
            @PathVariable String id, @RequestParam String sessionToken) {
        return ResponseEntity.ok(ApiResponse.ok(manualGradingService.releaseLock(id, sessionToken)));
    }

    @PutMapping("/{id}/grading")
    public ResponseEntity<ApiResponse<AssessmentGradingDetailResponse>> save(
            @PathVariable String id, @Valid @RequestBody SaveAssessmentManualGradingRequest req) {
        manualGradingService.save(id, req);
        return ResponseEntity.ok(ApiResponse.ok(manualGradingService.detail(id)));
    }
}
