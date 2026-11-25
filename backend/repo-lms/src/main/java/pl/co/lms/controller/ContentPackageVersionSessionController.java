package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.dto.request.SessionRequests;
import pl.co.lms.entity.ContentPackageVersionSession;
import pl.co.lms.security.LmsSecurityRoles;
import pl.co.lms.service.ContentPackageVersionSessionService;

import java.util.List;

@RestController
@RequestMapping("/content-packages/versions/{versionId}/sessions")
@RequiredArgsConstructor
@PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
public class ContentPackageVersionSessionController {

    private final ContentPackageVersionSessionService sessionService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ContentPackageVersionSession>>> list(@PathVariable String versionId) {
        return ResponseEntity.ok(ApiResponse.ok(sessionService.list(versionId)));
    }

    @PutMapping("/{sessionNo}")
    public ResponseEntity<ApiResponse<ContentPackageVersionSession>> set(
            @PathVariable String versionId, @PathVariable int sessionNo, @Valid @RequestBody SessionRequests.Rename req) {
        return ResponseEntity.ok(ApiResponse.ok(sessionService.set(versionId, sessionNo, req.title())));
    }

    @DeleteMapping("/{sessionNo}")
    public ResponseEntity<ApiResponse<Void>> clear(@PathVariable String versionId, @PathVariable int sessionNo) {
        sessionService.clear(versionId, sessionNo);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
