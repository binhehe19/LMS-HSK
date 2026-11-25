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
import pl.co.lms.dto.request.SaveDictationAnswerRequest;
import pl.co.lms.dto.request.SaveShadowingRecordingRequest;
import pl.co.lms.dto.request.StartLanguagePracticeAttemptRequest;
import pl.co.lms.dto.response.LanguagePracticeAttemptResponse;
import pl.co.lms.service.LanguagePracticeService;

/** API học viên cho AUDIO_PRACTICE. Mọi route yêu cầu JWT và chỉ truy cập attempt của người gọi. */
@RestController
@RequestMapping("/language-practices")
@RequiredArgsConstructor
public class LanguagePracticeController {

    private final LanguagePracticeService languagePracticeService;

    @GetMapping
    public ResponseEntity<ApiResponse<java.util.List<pl.co.lms.dto.response.LanguagePracticeCatalogItem>>> catalog(
            @org.springframework.web.bind.annotation.RequestParam pl.co.lms.entity.LanguagePracticeMode mode) {
        return ResponseEntity.ok(ApiResponse.ok(languagePracticeService.catalog(mode)));
    }

    @PostMapping("/{resourceId}/attempts")
    public ResponseEntity<ApiResponse<LanguagePracticeAttemptResponse>> startOrResume(
            @PathVariable String resourceId,
            @Valid @RequestBody StartLanguagePracticeAttemptRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok(languagePracticeService.startOrResume(
                AuthUtils.resolveUserId(authentication), resourceId, request)));
    }

    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<ApiResponse<LanguagePracticeAttemptResponse>> getAttempt(
            @PathVariable String attemptId,
            Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok(languagePracticeService.getAttempt(
                AuthUtils.resolveUserId(authentication), attemptId)));
    }

    @PutMapping("/attempts/{attemptId}/segments/{segmentNo}/dictation")
    public ResponseEntity<ApiResponse<LanguagePracticeAttemptResponse>> saveDictationAnswer(
            @PathVariable String attemptId,
            @PathVariable int segmentNo,
            @Valid @RequestBody SaveDictationAnswerRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok(languagePracticeService.saveDictationAnswer(
                AuthUtils.resolveUserId(authentication), attemptId, segmentNo, request)));
    }

    @PostMapping("/attempts/{attemptId}/segments/{segmentNo}/dictation/check")
    public ResponseEntity<ApiResponse<LanguagePracticeAttemptResponse>> checkDictationAnswer(
            @PathVariable String attemptId,
            @PathVariable int segmentNo,
            @Valid @RequestBody SaveDictationAnswerRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok(languagePracticeService.checkDictationAnswer(
                AuthUtils.resolveUserId(authentication), attemptId, segmentNo, request)));
    }

    @PutMapping("/attempts/{attemptId}/segments/{segmentNo}/shadowing")
    public ResponseEntity<ApiResponse<LanguagePracticeAttemptResponse>> saveShadowingRecording(
            @PathVariable String attemptId,
            @PathVariable int segmentNo,
            @Valid @RequestBody SaveShadowingRecordingRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok(languagePracticeService.saveShadowingRecording(
                AuthUtils.resolveUserId(authentication), attemptId, segmentNo, request)));
    }
}
