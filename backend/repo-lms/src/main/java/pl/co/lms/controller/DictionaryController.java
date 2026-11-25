package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import base.co.common.util.AuthUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pl.co.lms.dto.request.*;
import pl.co.lms.dto.response.*;
import pl.co.lms.service.DictionaryService;
import java.time.Instant;
import java.util.List;

@RestController @RequestMapping("/dictionary") @RequiredArgsConstructor
public class DictionaryController {
    private final DictionaryService service;
    public record Goal(@Min(1) @Max(1000) int goal) {}
    public record Reminder(@NotNull Instant at) {}

    @GetMapping("/roadmap")
    public ApiResponse<List<DictionaryLessonResponse>> roadmap(Authentication auth, @RequestParam(required=false) String level, @RequestParam(required=false) String topic) {
        return ApiResponse.ok(service.roadmap(AuthUtils.resolveUserId(auth),level,topic));
    }
    @PostMapping("/skip-tests/{lessonId}")
    public ApiResponse<DictionaryService.SkipTestResult> skipTest(Authentication auth, @PathVariable String lessonId,
            @RequestParam(required=false) String level, @RequestParam(required=false) String topic, @Valid @RequestBody DictionarySkipTestRequest request) {
        return ApiResponse.ok(service.submitSkipTest(AuthUtils.resolveUserId(auth),lessonId,level,topic,request));
    }

    @GetMapping("/profile")
    public ApiResponse<DictionaryProfileResponse> profile(Authentication auth) {
        return ApiResponse.ok(service.getProfile(AuthUtils.resolveUserId(auth)));
    }
    @PutMapping("/goal")
    public ApiResponse<DictionaryProfileResponse> goal(Authentication auth, @Valid @RequestBody Goal request) {
        return ApiResponse.ok(service.setGoal(AuthUtils.resolveUserId(auth),request.goal()));
    }
    @PostMapping("/recent/{id}")
    public ApiResponse<DictionaryProfileResponse> recent(Authentication auth, @PathVariable String id) {
        return ApiResponse.ok(service.remember(AuthUtils.resolveUserId(auth),id));
    }
    @PutMapping("/reminders/{id}")
    public ApiResponse<DictionaryProfileResponse> reminder(Authentication auth, @PathVariable String id, @Valid @RequestBody Reminder request) {
        return ApiResponse.ok(service.remind(AuthUtils.resolveUserId(auth),id,request.at()));
    }
    @PutMapping("/words/{id}/state")
    public ApiResponse<LearningResourceStateResponse> state(Authentication auth, @PathVariable String id, @RequestBody UpdateVocabularyStateRequest request) {
        return ApiResponse.ok(service.updateWord(AuthUtils.resolveUserId(auth),id,request));
    }
    @PostMapping("/words/{id}/start")
    public ApiResponse<LearningResourceStateResponse> start(Authentication auth, @PathVariable String id) {
        return ApiResponse.ok(service.startWord(AuthUtils.resolveUserId(auth),id));
    }
    @PostMapping("/progress/sync")
    public ApiResponse<Void> syncProgress(Authentication auth) {
        service.syncLearningProgress(AuthUtils.resolveUserId(auth));
        return ApiResponse.ok(null);
    }
    @GetMapping("/sessions")
    public ApiResponse<List<DictionarySessionResponse>> completed(Authentication auth, @RequestParam(defaultValue="true") boolean completed) {
        String user = AuthUtils.resolveUserId(auth);
        return ApiResponse.ok(completed ? service.completedSessions(user) : service.recentSessions(user));
    }
    @GetMapping("/sessions/{lessonId}")
    public ApiResponse<DictionarySessionResponse> session(Authentication auth, @PathVariable String lessonId, @RequestParam(defaultValue="false") boolean review,
            @RequestParam(required=false) String level, @RequestParam(required=false) String topic) {
        return ApiResponse.ok(service.getSession(AuthUtils.resolveUserId(auth),lessonId,review,level,topic));
    }
    @PutMapping("/sessions/{lessonId}")
    public ApiResponse<DictionarySessionResponse> save(Authentication auth, @PathVariable String lessonId, @RequestParam(defaultValue="false") boolean review,
            @RequestParam(required=false) String level, @RequestParam(required=false) String topic, @Valid @RequestBody SaveDictionarySessionRequest request) {
        return ApiResponse.ok(service.saveSession(AuthUtils.resolveUserId(auth),lessonId,review,request,level,topic));
    }
}
