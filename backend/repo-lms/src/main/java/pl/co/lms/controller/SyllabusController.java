package pl.co.lms.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import base.co.common.dto.ApiResponse;
import base.co.common.dto.PageResponse;
import org.springframework.web.bind.annotation.RequestParam;
import pl.co.lms.client.CmsClient;
import pl.co.lms.client.dto.CmsSyllabusPage;
import pl.co.lms.dto.response.SyllabusFilterOptionsResponse;
import java.util.List;
import pl.co.lms.dto.response.SyllabusDetailResponse;
import pl.co.lms.dto.response.SyllabusSummaryResponse;
import pl.co.lms.dto.response.SyllabusVersionSummaryResponse;
import pl.co.lms.security.LmsSecurityRoles;

// Proxy đọc dữ liệu giáo trình từ CMS (ERP thật) cho màn quản trị "Giáo trình" — admin chọn
// giáo trình + phiên bản thật từ dropdown thay vì gõ tay ID, trước khi áp content-template.
@RestController
@RequestMapping("/syllabuses")
@RequiredArgsConstructor
public class SyllabusController {

    private final CmsClient cmsClient;

    @GetMapping
    public ResponseEntity<ApiResponse<?>> listSyllabuses() {
        var result = cmsClient.listSyllabuses().stream().map(SyllabusSummaryResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // Màn "Giáo trình": lọc và phân trang ở ERP. size bị chặn 1..100 trước khi vào khoá cache.
    @org.springframework.security.access.prepost.PreAuthorize(LmsSecurityRoles.SYLLABUS_MANAGE)
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<PageResponse<SyllabusSummaryResponse>>> searchSyllabuses(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String educationLevelId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        CmsSyllabusPage result = cmsClient.searchSyllabuses(keyword, educationLevelId, type,
                Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        List<SyllabusSummaryResponse> items = result.getItems() == null ? List.of()
                : result.getItems().stream().map(SyllabusSummaryResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(PageResponse.<SyllabusSummaryResponse>builder()
                .items(items)
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .page(result.getPage())
                .size(result.getSize())
                .build()));
    }

    @org.springframework.security.access.prepost.PreAuthorize(LmsSecurityRoles.SYLLABUS_MANAGE)
    @GetMapping("/filter-options")
    public ResponseEntity<ApiResponse<SyllabusFilterOptionsResponse>> filterOptions() {
        return ResponseEntity.ok(ApiResponse.ok(SyllabusFilterOptionsResponse.from(cmsClient.syllabusFilterOptions())));
    }

    // GET /syllabus/{syllabusId} (CMS) - trả toàn bộ nội dung soạn thảo của giáo trình
    // (CLO, tài liệu, lịch trình, tiêu chí đánh giá, bài kiểm tra mẫu) đang PUBLISHED. CMS
    // không cho xem nội dung theo từng version cũ, chỉ có version hiện hành (xem "versions"
    // trong response chỉ là lịch sử publish, không có nội dung riêng).
    @org.springframework.security.access.prepost.PreAuthorize(LmsSecurityRoles.SYLLABUS_MANAGE)
    @GetMapping("/{syllabusId}")
    public ResponseEntity<ApiResponse<SyllabusDetailResponse>> getSyllabusDetail(@PathVariable String syllabusId) {
        return ResponseEntity.ok(ApiResponse.ok(SyllabusDetailResponse.from(cmsClient.getSyllabusDetail(syllabusId))));
    }

    @org.springframework.security.access.prepost.PreAuthorize(LmsSecurityRoles.SYLLABUS_MANAGE)
    @GetMapping("/{syllabusId}/versions")
    public ResponseEntity<ApiResponse<?>> listVersions(@PathVariable String syllabusId) {
        var result = cmsClient.listSyllabusVersions(syllabusId).stream()
                .map(SyllabusVersionSummaryResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @org.springframework.security.access.prepost.PreAuthorize(LmsSecurityRoles.SYLLABUS_MANAGE)
    @PostMapping("/cache/evict")
    public ResponseEntity<ApiResponse<String>> evictCache() {
        cmsClient.evictAllCmsCache();
        return ResponseEntity.ok(ApiResponse.ok("CMS cache cleared successfully"));
    }
}
