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
import pl.co.lms.dto.request.TopicRequests;
import pl.co.lms.entity.ContentPackageVersionTopic;
import pl.co.lms.security.LmsSecurityRoles;
import pl.co.lms.service.ContentPackageVersionTopicService;

import java.util.List;

@RestController
@RequestMapping("/content-packages/versions/{versionId}/topics")
@RequiredArgsConstructor
@PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
public class ContentPackageVersionTopicController {

    private final ContentPackageVersionTopicService topicService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ContentPackageVersionTopic>>> list(
            @PathVariable String versionId, @RequestParam(required = false) Integer sessionNo) {
        return ResponseEntity.ok(ApiResponse.ok(topicService.list(versionId, sessionNo)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ContentPackageVersionTopic>> create(
            @PathVariable String versionId, @Valid @RequestBody TopicRequests.Create req) {
        return ResponseEntity.ok(ApiResponse.ok(topicService.create(versionId, req.sessionNo(), req.title())));
    }

    @PutMapping("/{topicId}")
    public ResponseEntity<ApiResponse<ContentPackageVersionTopic>> rename(
            @PathVariable String versionId, @PathVariable String topicId, @Valid @RequestBody TopicRequests.Rename req) {
        return ResponseEntity.ok(ApiResponse.ok(topicService.rename(versionId, topicId, req.title())));
    }

    @PutMapping("/reorder")
    public ResponseEntity<ApiResponse<Void>> reorder(
            @PathVariable String versionId, @Valid @RequestBody TopicRequests.Reorder req) {
        topicService.reorder(versionId, req.sessionNo(), req.topicIdsInOrder());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @DeleteMapping("/{topicId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String versionId, @PathVariable String topicId) {
        topicService.delete(versionId, topicId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
