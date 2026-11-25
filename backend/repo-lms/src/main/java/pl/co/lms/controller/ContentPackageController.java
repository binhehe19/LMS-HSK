package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import base.co.common.dto.PageResponse;
import base.co.common.util.AuthUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.dto.request.AcquireEditLockRequest;
import pl.co.lms.dto.request.CreateContentPackageRequest;
import pl.co.lms.dto.request.CreateContentPackageVersionRequest;
import pl.co.lms.dto.request.HeartbeatEditLockRequest;
import pl.co.lms.dto.request.UpdateContentPackageVersionRequest;
import pl.co.lms.dto.response.ContentPackageResponse;
import pl.co.lms.dto.response.ContentPackageVersionResponse;
import pl.co.lms.dto.response.EditLockResponse;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.security.LmsSecurityRoles;
import pl.co.lms.service.ContentPackageService;

import java.util.List;

@RestController
@RequestMapping("/content-packages")
@RequiredArgsConstructor
public class ContentPackageController {

    private final ContentPackageService packageService;

    @GetMapping
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<PageResponse<ContentPackageResponse>>> listPackages(
            @RequestParam(required = false) ContentPackageType type,
            @RequestParam(required = false) String syllabusId,
            @RequestParam(defaultValue = "false") boolean library,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String level,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.ok(packageService.searchPackageResponses(type, syllabusId, library, keyword, status, level, page, size)));
    }

    @PutMapping("/{id}/syllabus")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageResponse>> attachToSyllabus(
            @PathVariable String id, @Valid @RequestBody pl.co.lms.dto.request.AttachPackageToSyllabusRequest req) {
        ContentPackage pkg = packageService.attachToSyllabus(id, req.syllabusId(), req.syllabusVersionId());
        return ResponseEntity.ok(ApiResponse.ok(packageService.getPackageResponse(pkg.getId())));
    }

    @GetMapping("/batch")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<List<ContentPackageResponse>>> listPackagesByIds(
            @RequestParam List<String> ids) {
        return ResponseEntity.ok(ApiResponse.ok(packageService.listPackageResponsesByIds(ids)));
    }

    @PostMapping
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageResponse>> createPackage(
            @Valid @RequestBody CreateContentPackageRequest req) {
        ContentPackage pkg = packageService.createPackageWithInitialDraft(req);
        return ResponseEntity.ok(ApiResponse.ok(packageService.getPackageResponse(pkg.getId())));
    }

    @PostMapping("/{id}/copy")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageResponse>> copyPackage(
            @PathVariable String id, @Valid @RequestBody pl.co.lms.dto.request.CopyContentPackageRequest req) {
        ContentPackage copy = packageService.copyPackage(id, req.syllabusId(), req.syllabusVersionId(), req.title());
        return ResponseEntity.ok(ApiResponse.ok(packageService.getPackageResponse(copy.getId())));
    }

    @GetMapping("/{id}")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageResponse>> getPackage(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(packageService.getPackageResponse(id)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<Void>> deletePackage(@PathVariable String id) {
        packageService.deletePackage(id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/{id}/draft")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageVersionResponse>> ensureDraft(@PathVariable String id) {
        ContentPackageVersion draft = packageService.ensureDraftForEdit(id);
        return ResponseEntity.ok(ApiResponse.ok(ContentPackageVersionResponse.from(draft)));
    }

    @PostMapping("/{id}/discard-draft")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<Void>> discardDraft(
            @PathVariable String id,
            @RequestParam String sessionToken) {
        packageService.discardDraft(id, sessionToken);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/{id}/lock")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<EditLockResponse>> acquireLock(
            @PathVariable String id,
            @Valid @RequestBody AcquireEditLockRequest req,
            Authentication auth) {
        String userId = AuthUtils.resolveUserId(auth);
        EditLockResponse result = packageService.acquireOrRenewLock(id, userId, req.sessionToken());
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping("/{id}/lock/heartbeat")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<EditLockResponse>> heartbeatLock(
            @PathVariable String id,
            @Valid @RequestBody HeartbeatEditLockRequest req,
            Authentication auth) {
        String userId = AuthUtils.resolveUserId(auth);
        EditLockResponse result = packageService.heartbeatAndMaybeSave(
                id, userId, req.sessionToken(), req.versionId(),
                new UpdateContentPackageVersionRequest(
                        req.title(), req.description(), req.level(), req.topic(), req.sessionCount()));
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @DeleteMapping("/{id}/lock")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<Void>> releaseLock(
            @PathVariable String id,
            @RequestParam String sessionToken) {
        packageService.releaseLock(id, sessionToken);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @GetMapping("/{packageId}/versions")
    public ResponseEntity<ApiResponse<List<ContentPackageVersionResponse>>> listVersions(
            @PathVariable String packageId) {
        List<ContentPackageVersionResponse> list = packageService.listVersions(packageId).stream()
                .map(ContentPackageVersionResponse::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PostMapping("/{packageId}/versions")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageVersionResponse>> createVersion(
            @PathVariable String packageId,
            @RequestBody CreateContentPackageVersionRequest req) {
        ContentPackageVersion draft = ContentPackageVersion.builder()
                .title(req.title())
                .description(req.description())
                .level(req.level())
                .topic(req.topic())
                .build();
        ContentPackageVersion created = packageService.createDraftVersion(packageId, draft);
        return ResponseEntity.ok(ApiResponse.ok(ContentPackageVersionResponse.from(created)));
    }

    @PutMapping("/{packageId}/versions/{versionId}")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageVersionResponse>> updateVersion(
            @PathVariable String packageId,
            @PathVariable String versionId,
            @RequestBody UpdateContentPackageVersionRequest req) {
        ContentPackageVersion updated = packageService.updateDraftVersion(packageId, versionId, req);
        return ResponseEntity.ok(ApiResponse.ok(ContentPackageVersionResponse.from(updated)));
    }

    @GetMapping("/versions/{versionId}")
    public ResponseEntity<ApiResponse<ContentPackageVersionResponse>> getVersion(
            @PathVariable String versionId) {
        ContentPackageVersion version = packageService.getVersion(versionId);
        return ResponseEntity.ok(ApiResponse.ok(ContentPackageVersionResponse.from(version)));
    }

    @PostMapping("/{packageId}/versions/{versionId}/publish")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageVersionResponse>> publishVersion(
            @PathVariable String packageId,
            @PathVariable String versionId,
            @RequestParam String sessionToken) {
        ContentPackageVersion published = packageService.publishVersion(packageId, versionId, sessionToken);
        return ResponseEntity.ok(ApiResponse.ok(ContentPackageVersionResponse.from(published)));
    }

    @PostMapping("/{packageId}/versions/{versionId}/archive")
    @PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
    public ResponseEntity<ApiResponse<ContentPackageVersionResponse>> archiveVersion(
            @PathVariable String packageId,
            @PathVariable String versionId) {
        ContentPackageVersion archived = packageService.archiveVersion(packageId, versionId);
        return ResponseEntity.ok(ApiResponse.ok(ContentPackageVersionResponse.from(archived)));
    }
}
