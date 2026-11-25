package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import base.co.common.filter.principal.AuthPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import pl.co.lms.service.MatchGameService;
import pl.co.lms.dto.request.StartMatchGameRequest;
import pl.co.lms.dto.request.SubmitMatchGameRequest;
import pl.co.lms.dto.response.MatchGameLeaderboardResponse;
import pl.co.lms.dto.response.MatchGameResultResponse;
import pl.co.lms.dto.response.MatchGameSessionResponse;

@RestController
@RequestMapping("/games/match/sessions")
@RequiredArgsConstructor
public class MatchGameController {
    private final MatchGameService service;
    private String userId(AuthPrincipal principal) { return principal == null ? null : principal.userId(); }

    @PostMapping
    public ResponseEntity<ApiResponse<MatchGameSessionResponse>> start(@AuthenticationPrincipal AuthPrincipal user, @Valid @RequestBody StartMatchGameRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(service.start(userId(user), request)));
    }
    @PostMapping("/{id}/results")
    public ResponseEntity<ApiResponse<MatchGameResultResponse>> submit(@AuthenticationPrincipal AuthPrincipal user, @PathVariable String id, @Valid @RequestBody SubmitMatchGameRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(service.submit(userId(user), id, request)));
    }
    @GetMapping("/{id}/result")
    public ResponseEntity<ApiResponse<MatchGameResultResponse>> result(@AuthenticationPrincipal AuthPrincipal user, @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(service.result(userId(user), id)));
    }
    @GetMapping("/{id}/leaderboard")
    public ResponseEntity<ApiResponse<List<MatchGameLeaderboardResponse>>> leaderboard(@AuthenticationPrincipal AuthPrincipal user, @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(service.leaderboard(userId(user), id)));
    }
}
