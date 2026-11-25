package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
import pl.co.lms.dto.request.AddResourceToSessionRequest;
import pl.co.lms.dto.request.ReorderSessionResourcesRequest;
import pl.co.lms.dto.request.UpdateResourceContentRequest;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.dto.response.ContentPackageVersionResourceResponse;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.security.LmsSecurityRoles;
import pl.co.lms.service.ContentPackageVersionResourceService;

import java.util.List;

@RestController
@RequestMapping("/content-packages/versions/{versionId}/resources")
@RequiredArgsConstructor
@PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
public class ContentPackageVersionResourceController {

    private final ContentPackageVersionResourceService resourceLinkService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ContentPackageVersionResourceResponse>>> listResources(
            @PathVariable String versionId,
            @RequestParam(required = false) Integer sessionNo) {
        return ResponseEntity.ok(ApiResponse.ok(
                resourceLinkService.listResourceResponses(versionId, sessionNo)));
    }

    @PostMapping
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageVersionResource>> addResource(
            @PathVariable String versionId,
            @Valid @RequestBody AddResourceToSessionRequest req) {
        ContentPackageVersionResource link = resourceLinkService.addResourceToSession(
                versionId,
                req.learningResourceId(),
                req.learningResourceVersionId(),
                req.sessionNo(),
                req.displayOrder(),
                req.topicId()
        );
        return ResponseEntity.ok(ApiResponse.ok(link));
    }

    // Chuyển học liệu sang chủ đề khác của cùng buổi (topicId null = bỏ khỏi chủ đề).
    @PutMapping("/{resourceId}/topic")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageVersionResource>> assignTopic(
            @PathVariable String versionId,
            @PathVariable String resourceId,
            @RequestBody pl.co.lms.dto.request.TopicRequests.Assign req) {
        return ResponseEntity.ok(ApiResponse.ok(resourceLinkService.assignTopic(versionId, resourceId, req.topicId())));
    }

    @DeleteMapping("/{resourceId}")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<Void>> removeResource(
            @PathVariable String versionId,
            @PathVariable String resourceId) {
        resourceLinkService.removeResourceFromSession(versionId, resourceId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PutMapping("/reorder")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<Void>> reorderResources(
            @PathVariable String versionId,
            @Valid @RequestBody ReorderSessionResourcesRequest req) {
        resourceLinkService.reorderSessionResources(versionId, req.sessionNo(), req.learningResourceIdsInOrder());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // Điều kiện của bài trong học phần (body rỗng/null = xoá điều kiện).
    @PutMapping("/{resourceId}/settings")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageVersionResource>> updateSettings(
            @PathVariable String versionId,
            @PathVariable String resourceId,
            @RequestBody(required = false) pl.co.lms.entity.json.PlacementSettings settings) {
        return ResponseEntity.ok(ApiResponse.ok(resourceLinkService.updateSettings(versionId, resourceId, settings)));
    }

    @PutMapping("/{resourceId}/content")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<LearningResourceVersion>> updateResourceContent(
            @PathVariable String versionId,
            @PathVariable String resourceId,
            @Valid @RequestBody UpdateResourceContentRequest req) {
        LearningResourceVersion updated = resourceLinkService.updateResourceContentWithinPackage(
                versionId, resourceId, req.content());
        return ResponseEntity.ok(ApiResponse.ok(updated));
    }
}
