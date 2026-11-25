package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import base.co.common.util.AuthUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.dto.request.LearningResourceStatesRequest;
import pl.co.lms.dto.request.UpdateFlashcardReviewRequest;
import pl.co.lms.dto.request.UpdateVocabularyStateRequest;
import pl.co.lms.dto.response.LearningResourceStateResponse;
import pl.co.lms.entity.LearningResourceState;
import pl.co.lms.service.LearningResourceStateService;

import java.util.List;

@RestController
@RequestMapping("/user-learning-resources")
@RequiredArgsConstructor
public class LearningResourceStateController {

    private final LearningResourceStateService stateService;

    @GetMapping("/{resourceId}/state")
    public ResponseEntity<ApiResponse<LearningResourceStateResponse>> getState(
            @PathVariable String resourceId,
            Authentication auth) {
        String userId = AuthUtils.resolveUserId(auth);
        LearningResourceState state = stateService.getState(userId, resourceId).orElse(null);
        return ResponseEntity.ok(ApiResponse.ok(LearningResourceStateResponse.from(state)));
    }

    @PostMapping("/{resourceId}/flashcard-review")
    public ResponseEntity<ApiResponse<LearningResourceStateResponse>> updateFlashcardReview(
            @PathVariable String resourceId,
            @Valid @RequestBody UpdateFlashcardReviewRequest req,
            Authentication auth) {
        String userId = AuthUtils.resolveUserId(auth);
        LearningResourceState state = stateService.updateFlashcardStatus(userId, resourceId, req.status());
        return ResponseEntity.ok(ApiResponse.ok(LearningResourceStateResponse.from(state)));
    }

    @PutMapping("/{resourceId}/vocabulary-state")
    public ResponseEntity<ApiResponse<LearningResourceStateResponse>> updateVocabularyState(
            @PathVariable String resourceId,
            @RequestBody UpdateVocabularyStateRequest req,
            Authentication auth) {
        String userId = AuthUtils.resolveUserId(auth);
        LearningResourceState state = stateService.updateVocabularyState(
                userId, resourceId, req.saved(), req.note(), req.comprehensionLevel());
        return ResponseEntity.ok(ApiResponse.ok(LearningResourceStateResponse.from(state)));
    }

    // Đọc hàng loạt trạng thái của người dùng hiện tại (resource chưa có trạng thái thì không có trong kết quả).
    @PostMapping("/states")
    public ResponseEntity<ApiResponse<List<LearningResourceStateResponse>>> getStates(
            @Valid @RequestBody LearningResourceStatesRequest req,
            Authentication auth) {
        String userId = AuthUtils.resolveUserId(auth);
        List<LearningResourceStateResponse> list = stateService.getStatesForResources(userId, req.resourceIds()).stream()
                .map(LearningResourceStateResponse::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @GetMapping("/saved")
    public ResponseEntity<ApiResponse<List<LearningResourceStateResponse>>> listSavedResources(
            Authentication auth) {
        String userId = AuthUtils.resolveUserId(auth);
        List<LearningResourceStateResponse> list = stateService.getSavedResources(userId).stream()
                .map(LearningResourceStateResponse::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @GetMapping("/vocabulary-summary")
    public ResponseEntity<ApiResponse<pl.co.lms.dto.response.VocabularyUserSummaryResponse>> getVocabularySummary(
            @org.springframework.web.bind.annotation.RequestParam(required = false) String cefrLevel,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String topic,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String groupBy,
            Authentication auth) {
        String userId = AuthUtils.resolveUserId(auth);
        return ResponseEntity.ok(ApiResponse.ok(stateService.getVocabularySummary(userId, cefrLevel, topic, groupBy)));
    }

    @GetMapping("/vocabulary-states")
    public ResponseEntity<ApiResponse<List<LearningResourceStateResponse>>> getLearningVocabularyStates(
            @org.springframework.web.bind.annotation.RequestParam(required = false) String cefrLevel,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String topic,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "200") int limit,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "false") boolean due,
            Authentication auth) {
        String userId = AuthUtils.resolveUserId(auth);
        List<LearningResourceStateResponse> list = (due ? stateService.getDueVocabularyStates(userId)
                : stateService.getLearningVocabularyStates(userId, cefrLevel, topic, limit)).stream()
                .map(LearningResourceStateResponse::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(list));
    }
}
