package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pl.co.lms.dto.request.SpeakingBookingRequest;
import pl.co.lms.service.SpeakingBookingService;

import java.util.List;

// Đặt lịch luyện Speaking với giáo viên: POST/GET /speaking-bookings; quản trị xem danh sách ở /speaking-bookings/management.
@RestController
@RequestMapping("/speaking-bookings")
@RequiredArgsConstructor
public class SpeakingBookingController {

    private final SpeakingBookingService service;

    @PostMapping
    public ResponseEntity<ApiResponse<JsonNode>> book(@Valid @RequestBody SpeakingBookingRequest req) {
        return ok(service.book(req));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<JsonNode>>> mine() {
        return ok(service.mine());
    }

    @GetMapping("/management")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<JsonNode>> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ok(service.list(page, size));
    }

    private static <T> ResponseEntity<ApiResponse<T>> ok(T data) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(data));
    }
}