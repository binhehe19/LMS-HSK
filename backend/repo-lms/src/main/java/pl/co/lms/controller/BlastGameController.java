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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.dto.request.StartBlastGameRequest;
import pl.co.lms.dto.request.SubmitBlastGameRequest;
import pl.co.lms.dto.response.BlastGameLeaderboardResponse;
import pl.co.lms.dto.response.BlastGameResultResponse;
import pl.co.lms.dto.response.BlastGameSessionResponse;
import pl.co.lms.entity.BlastGameSource;
import pl.co.lms.entity.json.VocabularyGameCard;
import pl.co.lms.service.BlastGameService;
import java.util.List;

@RestController
@RequestMapping("/games/blast")
@RequiredArgsConstructor
public class BlastGameController {
    private final BlastGameService service;
    private String userId(AuthPrincipal user) { return user == null ? null : user.userId(); }

    @GetMapping("/deck")
    public ResponseEntity<ApiResponse<List<VocabularyGameCard>>> deck(@AuthenticationPrincipal AuthPrincipal user, @RequestParam BlastGameSource source) {
        return ResponseEntity.ok(ApiResponse.ok(service.deck(userId(user), source)));
    }
    @PostMapping("/sessions")
    public ResponseEntity<ApiResponse<BlastGameSessionResponse>> start(@AuthenticationPrincipal AuthPrincipal user, @Valid @RequestBody StartBlastGameRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(service.start(userId(user), request)));
    }
    @PostMapping("/sessions/{id}/results")
    public ResponseEntity<ApiResponse<BlastGameResultResponse>> submit(@AuthenticationPrincipal AuthPrincipal user, @PathVariable String id, @Valid @RequestBody SubmitBlastGameRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(service.submit(userId(user), id, request)));
    }
    @GetMapping("/sessions/{id}/result")
    public ResponseEntity<ApiResponse<BlastGameResultResponse>> result(@AuthenticationPrincipal AuthPrincipal user, @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(service.result(userId(user), id)));
    }
    @GetMapping("/sessions/{id}/leaderboard")
    public ResponseEntity<ApiResponse<List<BlastGameLeaderboardResponse>>> leaderboard(@AuthenticationPrincipal AuthPrincipal user, @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(service.leaderboard(userId(user), id)));
    }
}
