package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import base.co.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.client.CmsClient;
import pl.co.lms.security.LmsSecurityRoles;
import pl.co.lms.client.dto.CmsClassSummaryPage;
import pl.co.lms.client.dto.CmsEnrollmentPage;
import pl.co.lms.dto.response.ClassDetailResponse;
import pl.co.lms.dto.response.ClassFeedbackResponse;
import pl.co.lms.dto.response.ClassSessionResponse;
import pl.co.lms.dto.response.ClassSummaryResponse;
import pl.co.lms.dto.response.EnrollmentResponse;

import java.util.List;

// Proxy đọc dữ liệu lớp học từ CMS (ERP thật) cho màn "Danh sách lớp" (tham khảo) - filter
// theo đúng các trường CourseClassController.list (repo-ems) hỗ trợ, không tự bịa filter.
@RestController
@RequestMapping("/classes")
@RequiredArgsConstructor
@PreAuthorize(LmsSecurityRoles.CLASS_OPS)
public class ClassController {

    private final CmsClient cmsClient;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<ClassSummaryResponse>>> listClasses(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String lifecycleStatus,
            @RequestParam(required = false) List<String> excludeLifecycleStatuses,
            @RequestParam(required = false) String educationLevelId,
            @RequestParam(required = false) List<String> daysOfWeek,
            @RequestParam(required = false) String timeSlot,
            @RequestParam(required = false) Boolean assigned,
            @RequestParam(required = false) String teacherId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        CmsClassSummaryPage result = cmsClient.listClasses(keyword, lifecycleStatus, excludeLifecycleStatuses,
                educationLevelId, daysOfWeek, timeSlot, assigned, teacherId, page, size);
        List<ClassSummaryResponse> items = result.getItems() == null ? List.of()
                : result.getItems().stream().map(ClassSummaryResponse::from).toList();
        PageResponse<ClassSummaryResponse> pageResponse = PageResponse.<ClassSummaryResponse>builder()
                .items(items)
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .page(result.getPage())
                .size(result.getSize())
                .build();
        return ResponseEntity.ok(ApiResponse.ok(pageResponse));
    }

    @GetMapping("/{classId}")
    public ResponseEntity<ApiResponse<ClassDetailResponse>> getClassDetail(@PathVariable String classId) {
        return ResponseEntity.ok(ApiResponse.ok(ClassDetailResponse.from(cmsClient.getClassDetail(classId))));
    }

    @GetMapping("/{classId}/sessions")
    public ResponseEntity<ApiResponse<List<ClassSessionResponse>>> getClassSessions(@PathVariable String classId) {
        List<ClassSessionResponse> sessions = cmsClient.getClassSessions(classId).stream()
                .map(ClassSessionResponse::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(sessions));
    }

    @GetMapping("/{classId}/enrollments")
    public ResponseEntity<ApiResponse<PageResponse<EnrollmentResponse>>> getEnrollments(
            @PathVariable String classId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {
        CmsEnrollmentPage result = cmsClient.listEnrollments(classId, page, size);
        List<EnrollmentResponse> items = result.getItems() == null ? List.of()
                : result.getItems().stream().map(EnrollmentResponse::from).toList();
        PageResponse<EnrollmentResponse> pageResponse = PageResponse.<EnrollmentResponse>builder()
                .items(items)
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .page(result.getPage())
                .size(result.getSize())
                .build();
        return ResponseEntity.ok(ApiResponse.ok(pageResponse));
    }

    @GetMapping("/{classId}/feedback")
    public ResponseEntity<ApiResponse<ClassFeedbackResponse>> getClassFeedback(@PathVariable String classId) {
        return ResponseEntity.ok(ApiResponse.ok(ClassFeedbackResponse.from(cmsClient.getClassFeedback(classId))));
    }
}
