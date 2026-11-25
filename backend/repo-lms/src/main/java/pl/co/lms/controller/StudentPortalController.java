package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import base.co.common.util.AuthUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import pl.co.lms.dto.request.UpdateStudentProfileRequest;
import pl.co.lms.service.StudentPortalService;

@RestController @RequestMapping("/me") @RequiredArgsConstructor @Validated
public class StudentPortalController {
    private final StudentPortalService service;
    @GetMapping("/profile") public ApiResponse<StudentPortalService.Profile> profile(Authentication auth) {
        return ApiResponse.ok(service.profile(AuthUtils.resolveUserId(auth)));
    }
    @PutMapping("/profile") public ApiResponse<StudentPortalService.Profile> save(Authentication auth, @Valid @RequestBody UpdateStudentProfileRequest request) {
        return ApiResponse.ok(service.saveProfile(AuthUtils.resolveUserId(auth), request));
    }
    @GetMapping("/favorites") public ApiResponse<StudentPortalService.PortalPage<StudentPortalService.Favorite>> favorites(Authentication auth,
            @RequestParam(required = false) String type, @RequestParam(required = false) @Size(max = 200) String keyword,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "12") int size, @RequestParam(defaultValue = "newest") String sort) {
        return ApiResponse.ok(service.favorites(AuthUtils.resolveUserId(auth), type, keyword, page, size, sort));
    }
    @DeleteMapping("/favorites/{id}") public ApiResponse<Void> remove(Authentication auth, @PathVariable String id) {
        service.removeFavorite(AuthUtils.resolveUserId(auth), id); return ApiResponse.ok(null);
    }
    @GetMapping("/history") public ApiResponse<StudentPortalService.HistoryPage> history(Authentication auth,
            @RequestParam(required = false) String type, @RequestParam(required = false) String status,
            @RequestParam(required = false) @Size(max = 200) String keyword,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "12") int size) {
        return ApiResponse.ok(service.history(AuthUtils.resolveUserId(auth), type, status, keyword, page, size));
    }
    @GetMapping("/leaderboard") public ApiResponse<StudentPortalService.Board> board(Authentication auth, @RequestParam(defaultValue = "week") String period) {
        return ApiResponse.ok(service.leaderboard(AuthUtils.resolveUserId(auth), period));
    }
}
