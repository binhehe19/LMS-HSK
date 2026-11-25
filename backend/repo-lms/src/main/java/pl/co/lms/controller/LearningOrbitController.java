package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import base.co.common.util.AuthUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pl.co.lms.dto.request.UpdateLearningOrbitSpaceRequest;
import pl.co.lms.dto.response.LearningOrbitResponse;
import pl.co.lms.service.LearningOrbitService;

import java.time.DateTimeException;
import java.time.ZoneId;

@RestController
@RequiredArgsConstructor
public class LearningOrbitController {
    private final LearningOrbitService orbitService;

    @GetMapping("/me/learning-orbit")
    public ApiResponse<LearningOrbitResponse> getSummary(Authentication auth,
            @RequestParam(defaultValue = "Asia/Ho_Chi_Minh") String timezone) {
        String userId = AuthUtils.resolveUserId(auth);
        ZoneId zone;
        try { zone = ZoneId.of(timezone); }
        catch (DateTimeException e) { throw new ApiException(ErrorCode.E200, "Múi giờ không hợp lệ"); }
        return ApiResponse.ok(orbitService.getSummary(userId, zone));
    }

    // Students cannot change educator-assessed autonomy or read another learner's summary.
    @PutMapping("/management/learning-orbit/{userId}/space")
    @PreAuthorize("hasAuthority(T(base.co.common.security.RoleName).ROLE_ADMIN.name())")
    public ApiResponse<LearningOrbitResponse.Space> updateSpace(@PathVariable String userId,
            @Valid @RequestBody UpdateLearningOrbitSpaceRequest request) {
        return ApiResponse.ok(orbitService.updateSpace(userId, request));
    }
}
