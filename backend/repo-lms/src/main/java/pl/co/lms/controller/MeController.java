package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.client.CmsClient;
import pl.co.lms.dto.response.MyClassDetailResponse;
import pl.co.lms.dto.response.MyClassResponse;
import pl.co.lms.service.MeService;

import java.util.List;

// Proxy đọc dữ liệu cá nhân từ CMS (GET /me/classes) - khác ClassController (chỉ ROLE_ADMIN,
// dùng cho màn quản trị "Danh sách lớp"): controller này mở cho mọi user đã đăng nhập, CMS tự
// scope kết quả theo JWT người gọi (không nhận studentId/teacherId qua param để tránh IDOR).
@RestController
@RequestMapping("/me")
@RequiredArgsConstructor
public class MeController {

    private final CmsClient cmsClient;
    private final MeService meService;

    @GetMapping("/classes")
    public ResponseEntity<ApiResponse<List<MyClassResponse>>> getMyClasses(
            @RequestParam(required = false) String status) {
        List<MyClassResponse> result = cmsClient.getMyClasses(status).stream()
                .map(MyClassResponse::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // Ghép từ 3 API CMS (sessions cache theo classId + my-records cá nhân, không cache) - xem
    // MeService để biết chi tiết cách ghép và kiểm tra quyền thành viên.
    @GetMapping("/classes/{classId}")
    public ResponseEntity<ApiResponse<MyClassDetailResponse>> getMyClassDetail(@PathVariable String classId) {
        return ResponseEntity.ok(ApiResponse.ok(meService.getMyClassDetail(classId)));
    }
}
