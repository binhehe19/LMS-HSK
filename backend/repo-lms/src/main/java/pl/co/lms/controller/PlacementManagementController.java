package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import pl.co.lms.dto.request.PlacementRequests;
import pl.co.lms.service.placement.*;
import java.util.List;

@RestController @RequestMapping("/management/placement-tests") @RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class PlacementManagementController {
    private final PlacementTestService tests;
    private final PlacementAttemptService attempts;
    private final PlacementConsultationService consultations;
    @GetMapping public ResponseEntity<ApiResponse<ObjectNode>> list(@RequestParam(required=false) PlacementRequests.Category category, @RequestParam(required=false) PlacementRequests.FoundationKind kind,
            @RequestParam(required=false) String keyword, @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return ok(tests.managementPage(category, kind, keyword, page, size));
    }
    @GetMapping("/{id}") public ResponseEntity<ApiResponse<ObjectNode>> detail(@PathVariable String id) { return ok(tests.detail(id)); }
    @PostMapping public ResponseEntity<ApiResponse<ObjectNode>> create(@Valid @RequestBody PlacementRequests.Test request) { return ok(tests.create(request)); }
    @PutMapping("/{id}") public ResponseEntity<ApiResponse<ObjectNode>> update(@PathVariable String id, @Valid @RequestBody PlacementRequests.Test request) { return ok(tests.update(id, request)); }
    @PostMapping("/{id}/publish") public ResponseEntity<ApiResponse<ObjectNode>> publish(@PathVariable String id, @Valid @RequestBody PlacementRequests.Publish request) { return ok(tests.publish(id, request.versionId())); }
    @PostMapping("/{id}/archive") public ResponseEntity<ApiResponse<ObjectNode>> archive(@PathVariable String id) { return ok(tests.archive(id)); }
    @GetMapping("/submissions") public ResponseEntity<ApiResponse<ObjectNode>> queue(@RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size, @RequestParam(required=false) String student) { return ok(attempts.mentorQueue(page, size, student)); }
    @GetMapping("/consultations") public ResponseEntity<ApiResponse<ObjectNode>> consultations(@RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size, @RequestParam(required=false) String student) { return ok(consultations.list(page, size, student)); }
    @PatchMapping("/consultations/{id}") public ResponseEntity<ApiResponse<ObjectNode>> handle(@PathVariable String id, @Valid @RequestBody PlacementRequests.HandleConsult request) { return ok(consultations.handle(id, request)); }
    private static <T> ResponseEntity<ApiResponse<T>> ok(T value) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(value)); }
}
