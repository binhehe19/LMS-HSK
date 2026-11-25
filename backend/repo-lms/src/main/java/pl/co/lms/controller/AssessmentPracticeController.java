package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import base.co.common.filter.principal.AuthPrincipal;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.service.practice.PracticeCatalogService;

import java.util.List;
import java.util.Map;

// Danh mục đề tự luyện (Reading/Listening) và tra lượt làm gần nhất; bắt đầu/làm/nộp/xem kết quả đi qua /assessment-attempts.
// GET /assessment-practice/catalog?type=PRACTICE_READING: các đề đã publish kèm trạng thái làm bài của người gọi.
// GET /assessment-practice/history?type=PRACTICE_WRITING: các lượt tự luyện của người gọi (kèm đề, điểm) cho trang lịch sử.
// GET /assessment-practice/latest?test=<resourceId hoặc mã đề>: lượt tự luyện đã kết thúc gần nhất trên đề đó.
@RestController
@RequestMapping("/assessment-practice")
@RequiredArgsConstructor
public class AssessmentPracticeController {

    private final PracticeCatalogService catalogService;

    @GetMapping("/catalog")
    public ResponseEntity<ApiResponse<List<JsonNode>>> catalog(@RequestParam String type) {
        return ResponseEntity.ok(ApiResponse.ok(catalogService.catalog(subType(type), currentUserId())));
    }

    @GetMapping("/history")
    public ResponseEntity<ApiResponse<List<ObjectNode>>> history(@RequestParam String type) {
        return ResponseEntity.ok(ApiResponse.ok(catalogService.history(subType(type), currentUserId())));
    }

    // Tên cũ READING/LISTENING/WRITING/SPEAKING được đổi sang PRACTICE_*; giá trị ngoài tập của bài đánh giá bị từ chối.
    private static String subType(String type) {
        String value = ResourceSubTypes.validate(LearningResourceType.ASSESSMENT, type);
        if (value == null) throw new ApiException(ErrorCode.E200, "Thiếu loại bài");
        return value;
    }

    @GetMapping("/latest")
    public ResponseEntity<ApiResponse<Map<String, String>>> latest(@RequestParam("test") String test) {
        String attemptId = catalogService.latestFinished(currentUserId(), test)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Bạn chưa có kết quả cho đề này"))
                .getId();
        return ResponseEntity.ok(ApiResponse.ok(Map.of("attemptId", attemptId)));
    }

    private static String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof AuthPrincipal principal) {
            return principal.userId();
        }
        throw new ApiException(ErrorCode.UNAUTHORIZED, "Yêu cầu đăng nhập");
    }
}