package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.dto.response.SyllabusSessionResourcesResponse;
import pl.co.lms.service.SyllabusPackageService;

// Nội dung học tập theo buổi cho học sinh (Slide/Tài liệu/Ngữ pháp/Từ vựng/Quick Test) - khác
// SyllabusPackageController (ROLE_ADMIN, quản lý học phần theo giáo trình): controller này mở cho
// mọi user đã đăng nhập, KHÔNG chứa dữ liệu cá nhân (giống getMyClassSessions) nên FE có thể
// dùng chung syllabusId cho mọi học sinh học cùng syllabus, không cần đi qua /me.
@RestController
@RequestMapping("/content-packages/syllabus/{syllabusId}/session-resources")
@RequiredArgsConstructor
public class ContentPackageStudentContentController {

    private final SyllabusPackageService mappingService;

    @GetMapping
    public ResponseEntity<ApiResponse<SyllabusSessionResourcesResponse>> getSessionResources(
            @PathVariable String syllabusId,
            @RequestParam Integer sessionNo) {
        return ResponseEntity.ok(ApiResponse.ok(mappingService.getSessionResources(syllabusId, sessionNo)));
    }
}
