package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import base.co.common.filter.principal.AuthPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import pl.co.lms.dto.request.*;
import pl.co.lms.dto.response.QuadWordSessionResponse;
import pl.co.lms.service.QuadWordService;

@RestController
@RequestMapping("/games/quad-word/sessions")
@RequiredArgsConstructor
public class QuadWordController {
    private final QuadWordService service;
    private String userId(AuthPrincipal principal) { return principal == null ? null : principal.userId(); }

    @GetMapping("/collections")
    public ResponseEntity<ApiResponse<java.util.List<pl.co.lms.dto.response.QuadWordCollectionResponse>>> collections(
            @AuthenticationPrincipal AuthPrincipal user) {
        return ResponseEntity.ok(ApiResponse.ok(service.collections(userId(user))));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<QuadWordSessionResponse>> start(@AuthenticationPrincipal AuthPrincipal user,
            @Valid @RequestBody StartQuadWordRequest request) {
        var session = service.start(userId(user), request);
        // Empty library is distinct from an API failure and does not use demo content.
        return session == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(ApiResponse.ok(session));
    }
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<QuadWordSessionResponse>> get(@AuthenticationPrincipal AuthPrincipal user, @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(service.get(userId(user), id)));
    }
    @PostMapping("/{id}/guesses")
    public ResponseEntity<ApiResponse<QuadWordSessionResponse>> guess(@AuthenticationPrincipal AuthPrincipal user,
            @PathVariable String id, @Valid @RequestBody SubmitQuadWordGuessRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(service.guess(userId(user), id, request)));
    }
}
