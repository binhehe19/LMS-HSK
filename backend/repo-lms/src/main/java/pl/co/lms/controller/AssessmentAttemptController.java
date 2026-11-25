package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.dto.request.AcquireAssessmentLockRequest;
import pl.co.lms.dto.request.HeartbeatAssessmentAttemptRequest;
import pl.co.lms.dto.request.SaveAnnotationsRequest;
import pl.co.lms.dto.request.SaveAttemptDraftRequest;
import pl.co.lms.dto.request.StartAssessmentAttemptRequest;
import pl.co.lms.dto.request.StartSelfStudyAttemptRequest;
import pl.co.lms.dto.request.SubmitAssessmentAttemptRequest;
import pl.co.lms.dto.response.HeartbeatAssessmentAttemptResponse;
import pl.co.lms.dto.response.AssessmentAttemptHistoryResponse;
import pl.co.lms.dto.response.AssessmentAttemptResponse;
import pl.co.lms.dto.response.AssessmentAttemptResultResponse;
import pl.co.lms.dto.response.AssessmentLockResponse;
import pl.co.lms.dto.response.SubmitAssessmentAttemptResponse;
import pl.co.lms.service.AssessmentAttemptResultService;
import pl.co.lms.service.AssessmentAttemptService;

// Bài làm của học sinh — tách biệt khỏi ContentPackage* (nội dung do giáo viên soạn).
// POST /assessment-attempts: idempotent, trả lại attempt đang làm dở nếu đã có.
// POST /assessment-attempts/self-study: bắt đầu/tiếp tục lượt tự luyện trên bài QUIZ của Kho (không gắn lớp/buổi).
// PATCH /assessment-attempts/{id}/annotations: cập nhật ghi chú của bài tự luyện đã nộp (xem lại kết quả).
// PUT /assessment-attempts/{id}/draft: lưu nháp tự luyện (đáp án + trạng thái giao diện) theo khoá lạc quan revision.
// POST /assessment-attempts/{id}/lock: chiếm Redis lock (ngăn 2 tab ghi đồng thời).
// POST /assessment-attempts/{id}/heartbeat: gia hạn lock + lưu answers.
// POST /assessment-attempts/{id}/submit: nộp bài (chỉ thành công một lần, lần hai 409).
// GET /assessment-attempts/{id}/result: kết quả theo tiến độ chấm (có ETag, nextPollMs).
@RestController
@RequestMapping("/assessment-attempts")
@RequiredArgsConstructor
public class AssessmentAttemptController {

    private final AssessmentAttemptService assessmentAttemptService;
    private final AssessmentAttemptResultService assessmentAttemptResultService;

    @PostMapping
    public ResponseEntity<ApiResponse<AssessmentAttemptResponse>> startOrResume(
            @Valid @RequestBody StartAssessmentAttemptRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(assessmentAttemptService.startOrResume(req)));
    }

    @PostMapping("/self-study")
    public ResponseEntity<ApiResponse<AssessmentAttemptResponse>> startOrResumeSelfStudy(
            @Valid @RequestBody StartSelfStudyAttemptRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(assessmentAttemptService.startOrResumeSelfStudy(req)));
    }

    @PutMapping("/{id}/draft")
    public ResponseEntity<ApiResponse<AssessmentAttemptResponse>> saveDraft(
            @PathVariable String id,
            @Valid @RequestBody SaveAttemptDraftRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(assessmentAttemptService.saveDraft(id, req)));
    }

    @PatchMapping("/{id}/annotations")
    public ResponseEntity<ApiResponse<Void>> saveAnnotations(
            @PathVariable String id,
            @Valid @RequestBody SaveAnnotationsRequest req) {
        assessmentAttemptService.saveAnnotations(id, req);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    // Lịch sử các lần làm một bài trong một buổi (chỉ của người gọi), mới nhất trước.
    @GetMapping
    public ResponseEntity<ApiResponse<AssessmentAttemptHistoryResponse>> listMyAttempts(
            @RequestParam String learningResourceId,
            @RequestParam String sessionId) {
        return ResponseEntity.ok(ApiResponse.ok(assessmentAttemptService.listMyAttempts(learningResourceId, sessionId)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AssessmentAttemptResponse>> getAttempt(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(assessmentAttemptService.getAttempt(id)));
    }

    @PostMapping("/{id}/lock")
    public ResponseEntity<ApiResponse<AssessmentLockResponse>> acquireLock(
            @PathVariable String id,
            @Valid @RequestBody AcquireAssessmentLockRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(assessmentAttemptService.acquireLock(id, req)));
    }

    @DeleteMapping("/{id}/lock")
    public ResponseEntity<ApiResponse<AssessmentLockResponse>> releaseLock(
            @PathVariable String id,
            @RequestParam String sessionToken) {
        return ResponseEntity.ok(ApiResponse.ok(assessmentAttemptService.releaseLock(id, sessionToken)));
    }

    @PostMapping("/{id}/heartbeat")
    public ResponseEntity<ApiResponse<HeartbeatAssessmentAttemptResponse>> heartbeat(
            @PathVariable String id,
            @Valid @RequestBody HeartbeatAssessmentAttemptRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(assessmentAttemptService.heartbeat(id, req)));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<ApiResponse<SubmitAssessmentAttemptResponse>> submit(
            @PathVariable String id,
            @Valid @RequestBody SubmitAssessmentAttemptRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(assessmentAttemptService.submit(id, req)));
    }

    // Kết quả theo tiến độ chấm. ETag + Cache-Control: no-cache: trình duyệt tự gửi If-None-Match và server trả
    // 304 khi dữ liệu không đổi, FE không cần xử lý ETag riêng. Proxy có thể đổi ETag thành weak (W/"...").
    @GetMapping("/{id}/result")
    public ResponseEntity<ApiResponse<AssessmentAttemptResultResponse>> getResult(
            @PathVariable String id,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        String normalized = ifNoneMatch == null ? null : ifNoneMatch.replaceFirst("^W/", "");
        AssessmentAttemptResultService.Outcome outcome = assessmentAttemptResultService.getResult(id, normalized);
        ResponseEntity.BodyBuilder builder = outcome.notModified()
                ? ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                : ResponseEntity.ok();
        builder.eTag(outcome.etag()).cacheControl(CacheControl.noCache());
        return outcome.notModified() ? builder.build() : builder.body(ApiResponse.ok(outcome.body()));
    }
}
