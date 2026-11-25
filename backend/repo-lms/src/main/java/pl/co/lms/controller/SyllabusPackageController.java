package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.dto.response.ContentPackageResponse;
import pl.co.lms.dto.response.SyllabusGradingSummaryResponse;
import pl.co.lms.dto.response.SyllabusPackageSummaryResponse;
import pl.co.lms.security.LmsSecurityRoles;
import pl.co.lms.service.SyllabusPackageService;

import java.util.List;

// Học phần của từng giáo trình (cột syllabus_id trên content_packages): danh sách, tóm tắt, xác nhận phiên bản mới.
@RestController
@RequestMapping("/content-packages/by-syllabus")
@RequiredArgsConstructor
@PreAuthorize(LmsSecurityRoles.SYLLABUS_MANAGE)
public class SyllabusPackageController {

    private final SyllabusPackageService syllabusPackageService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ContentPackageResponse>>> listBySyllabus(@RequestParam String syllabusId) {
        return ResponseEntity.ok(ApiResponse.ok(syllabusPackageService.listBySyllabusId(syllabusId)));
    }

    // Mọi bài tập của giáo trình kèm điều kiện đặt bài (hạng mục tính điểm, loại bài, ...): nguồn của khối "Tính điểm".
    @GetMapping("/grading-summary")
    public ResponseEntity<ApiResponse<SyllabusGradingSummaryResponse>> getGradingSummary(@RequestParam String syllabusId) {
        return ResponseEntity.ok(ApiResponse.ok(syllabusPackageService.getGradingSummary(syllabusId)));
    }

    @PostMapping("/acknowledge-version")
    public ResponseEntity<ApiResponse<Integer>> acknowledgeVersion(
            @RequestParam String syllabusId, @RequestParam String syllabusVersionId) {
        return ResponseEntity.ok(ApiResponse.ok(syllabusPackageService.acknowledgeSyllabusVersion(syllabusId, syllabusVersionId)));
    }

    // Tóm tắt học phần theo từng syllabus (nhiều ID cùng lúc) cho màn danh sách Giáo trình.
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<List<SyllabusPackageSummaryResponse>>> getSummary(
            @RequestParam List<String> syllabusIds) {
        return ResponseEntity.ok(ApiResponse.ok(syllabusPackageService.getSyllabusPackageSummaries(syllabusIds)));
    }
}
