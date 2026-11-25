package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import base.co.common.dto.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.dto.request.BatchDictionaryWordsRequest;
import pl.co.lms.dto.request.BulkCreateLearningResourcesRequest;
import pl.co.lms.dto.request.CreateLearningResourceRequest;
import pl.co.lms.dto.response.BulkCreateLearningResourcesResponse;
import pl.co.lms.dto.response.DictionaryDistractorResponse;
import pl.co.lms.dto.response.DictionarySummaryCountsResponse;
import pl.co.lms.dto.request.SyncResourceToPackagesRequest;
import pl.co.lms.dto.response.ResourcePackageUsageResponse;
import pl.co.lms.service.LearningResourceSyncService;
import pl.co.lms.dto.request.CreateLearningResourceVersionRequest;
import pl.co.lms.dto.request.UpdateLearningResourceVersionRequest;
import org.springframework.web.bind.annotation.PutMapping;
import pl.co.lms.dto.response.LearningResourceResponse;
import pl.co.lms.dto.response.LearningResourceVersionResponse;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.security.LmsSecurityRoles;
import pl.co.lms.service.LearningResourceService;

import java.util.List;

@RestController
@RequestMapping("/learning-resources")
@RequiredArgsConstructor
public class LearningResourceController {

    private final LearningResourceService resourceService;
    private final LearningResourceSyncService syncService;

    @GetMapping
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<PageResponse<LearningResourceResponse>>> listResources(
            @RequestParam(required = false) LearningResourceType type,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String questionType,
            @RequestParam(required = false) String cefrLevel,
            @RequestParam(required = false) String fileKind,
            @RequestParam(defaultValue = "false") boolean inLibrary,
            @RequestParam(defaultValue = "false") boolean publishedOnly,
            @RequestParam(required = false) String subType,
            @RequestParam(required = false) String tag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.ok(
                resourceService.listResourceResponses(type, keyword, questionType, cefrLevel, fileKind, inLibrary, publishedOnly,
                        subType, tag, page, size)));
    }

    @PostMapping
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<LearningResourceResponse>> createResource(
            @Valid @RequestBody CreateLearningResourceRequest req) {
        LearningResource res = resourceService.createResourceWithContent(req);
        return ResponseEntity.ok(ApiResponse.ok(resourceService.getResourceResponse(res.getId())));
    }

    /** Tạo nhiều tài nguyên cùng loại vào Kho (nhập từ Excel); trả kết quả từng mục. */
    @PostMapping("/bulk")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<BulkCreateLearningResourcesResponse>> bulkCreateResources(
            @Valid @RequestBody BulkCreateLearningResourcesRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.bulkCreateLibraryResources(req)));
    }

    /** Trong các từ gửi lên, những từ đã có trong Kho từ vựng (không phân biệt hoa thường) → id tài nguyên; khoá là từ chuẩn hoá (chữ thường). */
    @PostMapping("/existing-words")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<java.util.Map<String, String>>> existingWords(@Valid @RequestBody ExistingWordsRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.existingLibraryWords(req.words())));
    }

    public record ExistingWordsRequest(
            @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Size(max = 500, message = "Tối đa 500 từ mỗi lần") java.util.List<String> words) {}

    /** Tag đang dùng kèm số resource (gợi ý khi nhập, danh sách lọc); type bỏ trống = mọi loại. */
    @GetMapping("/tags")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<List<LearningResourceService.TagCount>>> listTags(
            @RequestParam(required = false) LearningResourceType type,
            @RequestParam(defaultValue = "false") boolean inLibrary) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.listTags(type, inLibrary)));
    }

    /** Đổi tên (hoặc gộp) một tag trên mọi resource. */
    @PutMapping("/tags/rename")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<Integer>> renameTag(@RequestBody RenameTagRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.renameTag(req.from(), req.to())));
    }

    /** Xoá một tag khỏi mọi resource. */
    @DeleteMapping("/tags")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<Integer>> deleteTag(@RequestParam String tag) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.deleteTag(tag)));
    }

    public record RenameTagRequest(String from, String to) {}

    /** Đổi loại phụ (type có tập giá trị riêng) và tag (mọi loại) của resource, không tạo version mới. */
    @PutMapping("/{id}/classification")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<LearningResourceResponse>> updateClassification(
            @PathVariable String id, @RequestBody ClassificationRequest req) {
        resourceService.updateClassification(id, req.subType(), req.tags(), req.skill());
        return ResponseEntity.ok(ApiResponse.ok(resourceService.getResourceResponse(id)));
    }

    /** skill: null = giữ nguyên, chuỗi rỗng = xóa, còn lại phải đúng định dạng token (xem LearningResourceService.normalizeSkill). */
    public record ClassificationRequest(String subType, java.util.List<String> tags, String skill) {}

    @GetMapping("/{id}")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<LearningResourceResponse>> getResource(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.getResourceResponse(id)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<Void>> deleteResource(@PathVariable String id) {
        resourceService.deleteResource(id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // Các học phần đang giữ bản sao của tài nguyên Kho này (để chọn nơi đồng bộ).
    @GetMapping("/{id}/package-usages")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<List<ResourcePackageUsageResponse>>> listPackageUsages(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(syncService.listUsages(id)));
    }

    // Đẩy nội dung mới nhất của tài nguyên Kho xuống các bản sao đã chọn (không tạo phiên bản học phần mới).
    @PostMapping("/{id}/sync-to-packages")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<Integer>> syncToPackages(
            @PathVariable String id, @Valid @RequestBody SyncResourceToPackagesRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(syncService.sync(id, req.linkIds())));
    }

    @GetMapping("/{id}/versions")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<List<LearningResourceVersionResponse>>> listVersions(
            @PathVariable String id) {
        LearningResource res = resourceService.getResource(id);
        List<LearningResourceVersionResponse> versions = resourceService.listVersions(id).stream()
                .map(v -> LearningResourceVersionResponse.from(v, res, resourceService.getObjectMapper()))
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(versions));
    }

    @PostMapping("/{id}/versions")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<LearningResourceVersionResponse>> createVersion(
            @PathVariable String id,
            @Valid @RequestBody CreateLearningResourceVersionRequest req) {
        LearningResource res = resourceService.getResource(id);
        LearningResourceVersion version = resourceService.createDraftVersion(id, req.content());
        if (Boolean.TRUE.equals(req.publishImmediately())) {
            resourceService.publishVersion(id, version.getId());
        }
        return ResponseEntity.ok(ApiResponse.ok(
                LearningResourceVersionResponse.from(version, res, resourceService.getObjectMapper())));
    }

    @PutMapping("/{id}/versions/{versionId}")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<LearningResourceVersionResponse>> updateVersion(
            @PathVariable String id,
            @PathVariable String versionId,
            @Valid @RequestBody UpdateLearningResourceVersionRequest req) {
        LearningResource res = resourceService.getResource(id);
        LearningResourceVersion version = resourceService.updateDraftVersion(id, versionId, req.content());
        return ResponseEntity.ok(ApiResponse.ok(
                LearningResourceVersionResponse.from(version, res, resourceService.getObjectMapper())));
    }

    @PostMapping("/{id}/versions/{versionId}/publish")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<LearningResourceVersionResponse>> publishVersion(
            @PathVariable String id,
            @PathVariable String versionId) {
        LearningResource res = resourceService.getResource(id);
        LearningResourceVersion version = resourceService.publishVersion(id, versionId);
        return ResponseEntity.ok(ApiResponse.ok(
                LearningResourceVersionResponse.from(version, res, resourceService.getObjectMapper())));
    }

    @GetMapping(value = "/dictionary", params = "language!=zh")
    public ResponseEntity<ApiResponse<PageResponse<LearningResourceResponse>>> searchDictionary(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String cefrLevel,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            org.springframework.security.core.Authentication auth) {
        String userId = auth == null ? null : base.co.common.util.AuthUtils.resolveUserId(auth);
        return ResponseEntity.ok(ApiResponse.ok(
                resourceService.searchVocabulary(keyword, topic, cefrLevel, status, userId, page, size)));
    }

    @GetMapping("/dictionary/summary-counts")
    public ResponseEntity<ApiResponse<DictionarySummaryCountsResponse>> dictionarySummaryCounts(
            @RequestParam(required = false) String cefrLevel,
            @RequestParam(required = false) String topic) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.getDictionarySummaryCounts(cefrLevel, topic)));
    }

    @GetMapping("/dictionary/lessons")
    public ResponseEntity<ApiResponse<pl.co.lms.dto.response.DictionaryLessonsPageResponse>> dictionaryLessons(
            @RequestParam(required = false) String cefrLevel,
            @RequestParam(required = false) String topic,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.getDictionaryLessons(cefrLevel, topic, page, size)));
    }

    @GetMapping("/dictionary/lessons/containing/{wordId}")
    public ResponseEntity<ApiResponse<pl.co.lms.dto.response.DictionaryCatalogLessonResponse>> dictionaryLessonContaining(
            @PathVariable String wordId,
            @RequestParam(required = false) String cefrLevel,
            @RequestParam(required = false) String topic) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.getDictionaryLessonContaining(wordId, cefrLevel, topic)));
    }

    @PostMapping("/dictionary/by-ids")
    public ResponseEntity<ApiResponse<List<LearningResourceResponse>>> dictionaryWordsByIds(
            @Valid @RequestBody BatchDictionaryWordsRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.getDictionaryWordsByIds(req.ids())));
    }

    @GetMapping("/dictionary/distractors")
    public ResponseEntity<ApiResponse<List<DictionaryDistractorResponse>>> dictionaryDistractors(
            @RequestParam String excludeWordId,
            @RequestParam(required = false) String topic,
            @RequestParam(defaultValue = "3") int count) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.getDistractors(excludeWordId, topic, count)));
    }

    @GetMapping(value = "/dictionary/{id}", params = "language!=zh")
    public ResponseEntity<ApiResponse<LearningResourceResponse>> dictionaryWord(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.getDictionaryWord(id)));
    }

    @GetMapping(value = "/dictionary", params = "language=zh")
    public ResponseEntity<ApiResponse<PageResponse<pl.co.lms.dto.response.DictionaryWordResponse>>> searchDictionaryHanzi(
            @org.springframework.security.core.annotation.AuthenticationPrincipal base.co.common.filter.principal.AuthPrincipal user,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "false") boolean includeDrafts,
            @RequestParam(required = false) Integer hskLevel,
            @RequestParam(required = false) Boolean isSingleVocab,
            @RequestParam(required = false) String wordType,
            @RequestParam(required = false) String radical,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        boolean canViewDrafts = LmsSecurityRoles.canManageContent(user);
        return ResponseEntity.ok(ApiResponse.ok(canViewDrafts && includeDrafts
                ? resourceService.searchDictionaryHanzi(keyword, hskLevel, isSingleVocab, wordType, radical, page, size)
                : resourceService.searchPublishedDictionaryHanzi(keyword, hskLevel, isSingleVocab, wordType, radical, page, size)));
    }

    /** Chi tiết một từ ĐÃ XUẤT BẢN cho học viên, kèm chữ thành phần (GET /{id} có sẵn chỉ dành cho Admin và trả cả lịch sử phiên bản). */
    @GetMapping(value = "/dictionary/{id}", params = "language=zh")
    public ResponseEntity<ApiResponse<pl.co.lms.dto.response.DictionaryWordResponse>> getPublishedDictionaryHanzi(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(resourceService.getPublishedDictionaryHanzi(id)));
    }


}
