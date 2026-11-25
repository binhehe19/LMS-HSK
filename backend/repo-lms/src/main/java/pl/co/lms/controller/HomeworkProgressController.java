package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import base.co.common.util.AuthUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.dto.response.ClassHomeworkProgressResponse;
import pl.co.lms.dto.response.SessionHomeworkProgressResponse;
import pl.co.lms.service.progress.HomeworkProgressService;

// Tiến độ bài tập của học sinh đang đăng nhập (không nhận userId qua param để tránh IDOR). Công thức: docs/homework-progress-metrics.md.
@RestController
@RequestMapping("/me/classes")
@RequiredArgsConstructor
public class HomeworkProgressController {

    private final HomeworkProgressService progressService;

    // Số liệu cho tile ở trang lớp học và tiến độ từng buổi (modal buổi học dùng lại).
    @GetMapping("/{classId}/homework-progress")
    public ResponseEntity<ApiResponse<ClassHomeworkProgressResponse>> getClassProgress(
            @PathVariable String classId, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.ok(progressService.getClassProgress(AuthUtils.resolveUserId(auth), classId)));
    }

    // Tiến độ một buổi (màn buổi học: badge sidebar và header).
    @GetMapping("/{classId}/sessions/{sessionId}/homework-progress")
    public ResponseEntity<ApiResponse<SessionHomeworkProgressResponse>> getSessionProgress(
            @PathVariable String classId, @PathVariable String sessionId, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.ok(
                progressService.getSessionProgress(AuthUtils.resolveUserId(auth), classId, sessionId)));
    }
}
