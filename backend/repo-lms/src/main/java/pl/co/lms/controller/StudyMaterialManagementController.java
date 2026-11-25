package pl.co.lms.controller;

import pl.co.lms.dto.request.DetectStudyMaterialVocabularyRequest;
import pl.co.lms.dto.request.PublishStudyMaterialRequest;
import pl.co.lms.dto.request.SaveStudyMaterialRequest;
import pl.co.lms.dto.response.StudyMaterialManagementResponse;
import pl.co.lms.dto.response.StudyMaterialSummaryResponse;
import pl.co.lms.dto.response.StudyMaterialVocabularyCandidateResponse;
import pl.co.lms.dto.response.StudyMaterialVocabularyPackageResponse;
import base.co.common.dto.ApiResponse;
import base.co.common.dto.PageResponse;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import base.co.common.util.AuthUtils;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pl.co.lms.security.LmsSecurityRoles;
import pl.co.lms.service.studymaterials.StudyMaterialService;
import pl.co.lms.service.studymaterials.StudyMaterialVocabularyService;
import java.util.List;

@RestController @RequestMapping("/management/study-materials")
@PreAuthorize(LmsSecurityRoles.CONTENT_MANAGE)
public class StudyMaterialManagementController {
    private final StudyMaterialService service;
    private final StudyMaterialVocabularyService vocabulary;
    public StudyMaterialManagementController(StudyMaterialService service, StudyMaterialVocabularyService vocabulary) {
        this.service = service; this.vocabulary = vocabulary;
    }
    private static void admin(Authentication auth) {
        AuthUtils.resolveUserId(auth);
        if (!LmsSecurityRoles.canManageContent(auth)) throw new ApiException(ErrorCode.FORBIDDEN);
    }
    @GetMapping public ApiResponse<PageResponse<StudyMaterialSummaryResponse>> catalog(Authentication auth,
            @RequestParam(required = false) String category, @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String topic, @RequestParam(required = false) String band,
            @RequestParam(required = false) List<String> sources, @RequestParam(required = false) String skill,
            @RequestParam(required = false) String part, @RequestParam(required = false) String tier,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        admin(auth); return ApiResponse.ok(service.managementCatalog(StudyMaterialController.filter(category, keyword, topic, band, sources, skill, part, tier, false), page, size));
    }
    @PostMapping("/detect-vocabulary") public ApiResponse<List<StudyMaterialVocabularyCandidateResponse>> detect(Authentication auth, @Valid @RequestBody DetectStudyMaterialVocabularyRequest request) {
        admin(auth); return ApiResponse.ok(vocabulary.detect(request.paragraphs(), request.variants(), request.vocabularyUnit()));
    }
    @GetMapping("/vocabulary-units") public ApiResponse<List<StudyMaterialVocabularyPackageResponse>> vocabularyUnits(Authentication auth) {
        admin(auth); return ApiResponse.ok(vocabulary.unitOptions());
    }
    @GetMapping("/{id}") public ApiResponse<StudyMaterialManagementResponse> detail(Authentication auth, @PathVariable String id) {
        admin(auth); return ApiResponse.ok(service.managementDetail(id));
    }
    @PostMapping public ApiResponse<StudyMaterialManagementResponse> create(Authentication auth, @Valid @RequestBody SaveStudyMaterialRequest request) {
        admin(auth); return ApiResponse.ok(service.create(request));
    }
    @PutMapping("/{id}") public ApiResponse<StudyMaterialManagementResponse> update(Authentication auth, @PathVariable String id, @Valid @RequestBody SaveStudyMaterialRequest request) {
        admin(auth); return ApiResponse.ok(service.update(id, request));
    }
    @PostMapping("/{id}/publish") public ApiResponse<StudyMaterialManagementResponse> publish(Authentication auth, @PathVariable String id, @Valid @RequestBody PublishStudyMaterialRequest request) {
        admin(auth); return ApiResponse.ok(service.publish(id, request.versionId()));
    }
    @DeleteMapping("/{id}") public ApiResponse<Void> delete(Authentication auth, @PathVariable String id) {
        admin(auth); service.delete(id); return ApiResponse.ok(null);
    }
}
