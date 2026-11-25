package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import pl.co.lms.dto.request.*;
import pl.co.lms.dto.response.*;
import pl.co.lms.service.placement.*;
import java.util.List;

@RestController @RequestMapping("/placement-tests") @RequiredArgsConstructor
public class PlacementTestController {
    private final PlacementTestService tests;
    private final PlacementAttemptService attempts;
    private final PlacementConsultationService consultations;
    @GetMapping public ResponseEntity<ApiResponse<List<ObjectNode>>> catalog(@RequestParam(required=false) String category) { return ok(tests.catalog(category)); }
    @GetMapping("/{id}") public ResponseEntity<ApiResponse<ObjectNode>> instructions(@PathVariable String id) { return ok(tests.instructions(id)); }
    @PostMapping("/{id}/attempts") public ResponseEntity<ApiResponse<AssessmentAttemptResponse>> start(@PathVariable String id) { return ok(attempts.start(id)); }
    @GetMapping("/attempts") public ResponseEntity<ApiResponse<ObjectNode>> history(@RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) { return ok(attempts.history(page, size)); }
    @GetMapping("/attempts/{id}") public ResponseEntity<ApiResponse<AssessmentAttemptResponse>> get(@PathVariable String id) { return ok(attempts.get(id)); }
    @PutMapping("/attempts/{id}/draft") public ResponseEntity<ApiResponse<AssessmentAttemptResponse>> save(@PathVariable String id, @Valid @RequestBody SaveAttemptDraftRequest request) { return ok(attempts.save(id, request)); }
    @PostMapping("/attempts/{id}/submit") public ResponseEntity<ApiResponse<ObjectNode>> submit(@PathVariable String id, @Valid @RequestBody PlacementRequests.Submit request) { return ok(attempts.submit(id, request)); }
    @GetMapping("/attempts/{id}/receipt") public ResponseEntity<ApiResponse<ObjectNode>> receipt(@PathVariable String id) { return ok(attempts.receipt(id)); }
    @GetMapping("/attempts/{id}/feedback-options") public ResponseEntity<ApiResponse<ObjectNode>> feedbackOptions(@PathVariable String id) { return ok(attempts.feedbackOptions(id)); }
    @GetMapping("/attempts/{id}/result") public ResponseEntity<ApiResponse<ObjectNode>> result(@PathVariable String id) { return ok(attempts.resultView(id)); }
    @PostMapping("/consultations") public ResponseEntity<ApiResponse<ObjectNode>> consult(@Valid @RequestBody PlacementRequests.Consult request) { return ok(consultations.request(request)); }
    @GetMapping("/consultations") public ResponseEntity<ApiResponse<ObjectNode>> mine(@RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) { return ok(consultations.mine(page, size)); }
    private static <T> ResponseEntity<ApiResponse<T>> ok(T value) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(value)); }
}
