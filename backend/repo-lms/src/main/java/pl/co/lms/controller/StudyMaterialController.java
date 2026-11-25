package pl.co.lms.controller;

import pl.co.lms.dto.request.SubmitStudyMaterialRecallRequest;
import pl.co.lms.dto.request.UpdateStudyMaterialProgressRequest;
import pl.co.lms.dto.request.UpdateStudyMaterialStateRequest;
import pl.co.lms.dto.response.StudyMaterialDetailResponse;
import pl.co.lms.dto.response.StudyMaterialFacetsResponse;
import pl.co.lms.dto.response.StudyMaterialHomeResponse;
import pl.co.lms.dto.response.StudyMaterialPersonalResponse;
import pl.co.lms.dto.response.StudyMaterialProgressResponse;
import pl.co.lms.dto.response.StudyMaterialRecallResponse;
import pl.co.lms.dto.response.StudyMaterialSummaryResponse;
import base.co.common.dto.ApiResponse;
import base.co.common.dto.PageResponse;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import base.co.common.util.AuthUtils;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pl.co.lms.entity.StudyMaterialCategory;
import pl.co.lms.service.studymaterials.StudyMaterialService;
import pl.co.lms.service.studymaterials.StudyMaterialSpecifications.Filter;
import java.util.List;

@RestController @RequestMapping("/study-materials")
public class StudyMaterialController {
    private final StudyMaterialService service;
    public StudyMaterialController(StudyMaterialService service) { this.service = service; }
    @GetMapping
    public ApiResponse<PageResponse<StudyMaterialSummaryResponse>> catalog(Authentication auth,
            @RequestParam(required = false) String category, @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String topic, @RequestParam(required = false) String band,
            @RequestParam(required = false) List<String> sources, @RequestParam(required = false) String skill,
            @RequestParam(required = false) String part, @RequestParam(required = false) String tier,
            @RequestParam(defaultValue = "false") boolean savedOnly, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "9") int size) {
        String user = AuthUtils.resolveUserId(auth);
        return ApiResponse.ok(service.catalog(user, filter(category, keyword, topic, band, sources, skill, part, tier, savedOnly), page, size));
    }
    @GetMapping("/home") public ApiResponse<StudyMaterialHomeResponse> home(Authentication auth) { return ApiResponse.ok(service.home(AuthUtils.resolveUserId(auth))); }
    @GetMapping("/facets") public ApiResponse<StudyMaterialFacetsResponse> facets(Authentication auth, @RequestParam(required = false) String category) {
        AuthUtils.resolveUserId(auth); return ApiResponse.ok(service.facets(category(category)));
    }
    @GetMapping("/{id}") public ApiResponse<StudyMaterialDetailResponse> detail(Authentication auth, @PathVariable String id) { return ApiResponse.ok(service.detail(AuthUtils.resolveUserId(auth), id)); }
    @GetMapping("/{id}/related") public ApiResponse<List<StudyMaterialSummaryResponse>> related(Authentication auth, @PathVariable String id) { return ApiResponse.ok(service.related(AuthUtils.resolveUserId(auth), id)); }
    @PutMapping("/{id}/state") public ApiResponse<StudyMaterialPersonalResponse> state(Authentication auth, @PathVariable String id, @Valid @RequestBody UpdateStudyMaterialStateRequest request) {
        return ApiResponse.ok(service.saveState(AuthUtils.resolveUserId(auth), id, request));
    }
    @PostMapping("/{id}/open") public ApiResponse<StudyMaterialProgressResponse> open(Authentication auth, @PathVariable String id) { return ApiResponse.ok(service.open(AuthUtils.resolveUserId(auth), id)); }
    @PutMapping("/{id}/progress") public ApiResponse<StudyMaterialProgressResponse> progress(Authentication auth, @PathVariable String id, @Valid @RequestBody UpdateStudyMaterialProgressRequest request) {
        return ApiResponse.ok(service.saveProgress(AuthUtils.resolveUserId(auth), id, request));
    }
    @PostMapping("/{id}/recall") public ApiResponse<StudyMaterialRecallResponse> recall(Authentication auth, @PathVariable String id, @Valid @RequestBody SubmitStudyMaterialRecallRequest request) {
        return ApiResponse.ok(service.recall(AuthUtils.resolveUserId(auth), id, request));
    }
    static StudyMaterialCategory category(String value) {
        if (value == null || value.isBlank()) return null;
        try { return StudyMaterialCategory.parse(value); }
        catch (IllegalArgumentException e) { throw new ApiException(ErrorCode.E200, e.getMessage()); }
    }
    static Filter filter(String category, String keyword, String topic, String band, List<String> sources, String skill, String part, String tier, boolean savedOnly) {
        if (sources != null && (sources.size() > 20 || sources.stream().anyMatch(source -> source.length() > 200))) throw new ApiException(ErrorCode.E200, "Bộ lọc nguồn không hợp lệ");
        if (keyword != null && keyword.length() > 500) throw new ApiException(ErrorCode.E200, "Từ khóa quá dài");
        return new Filter(category(category), keyword, topic, band, sources, skill, part, tier, savedOnly);
    }
}
