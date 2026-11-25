package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import base.co.common.filter.principal.AuthPrincipal;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.request.SpeakingBookingRequest;
import pl.co.lms.entity.SpeakingBooking;
import pl.co.lms.repository.SpeakingBookingRepository;
import pl.co.lms.service.practice.PracticeCatalogService;

import java.util.List;
import java.util.Set;

/** Đặt lịch luyện Speaking với giáo viên. Tách khỏi lượt làm bài: đây chỉ là yêu cầu liên hệ, không có điểm. */
@Service
@RequiredArgsConstructor
@Transactional
public class SpeakingBookingService {

    private static final Set<String> SLOTS = Set.of("Sáng (08:00–12:00)", "Chiều (13:00–17:00)", "Tối (18:00–21:00)");

    private final SpeakingBookingRepository bookings;
    private final PracticeCatalogService catalog;
    private final ObjectMapper mapper;

    public JsonNode book(SpeakingBookingRequest req) {
        String viewer = user();
        if (!SLOTS.contains(req.slot())) throw new ApiException(ErrorCode.E204, "Khung giờ Speaking không hợp lệ");
        if (req.itemId() != null && !req.itemId().isBlank() && catalog.resolveResourceId(req.itemId()).isEmpty()) {
            throw new ApiException(ErrorCode.E227, "Đề Speaking chưa được phát hành");
        }
        SpeakingBooking booking = new SpeakingBooking();
        booking.setUserId(viewer);
        booking.setTestKey(req.itemId());
        booking.setRequest(mapper.valueToTree(req));
        bookings.saveAndFlush(booking);
        return response(booking);
    }

    @Transactional(readOnly = true)
    public List<JsonNode> mine() {
        return bookings.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(user()).stream().map(b -> (JsonNode) response(b)).toList();
    }

    @Transactional(readOnly = true)
    public JsonNode list(int page, int size) {
        admin();
        var data = bookings.findByDeletedFalseOrderByCreatedAtDesc(PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size))));
        ObjectNode out = mapper.createObjectNode().put("totalElements", data.getTotalElements()).put("totalPages", data.getTotalPages());
        var items = out.putArray("items");
        data.forEach(b -> items.add(response(b).put("userId", b.getUserId())));
        return out;
    }

    private ObjectNode response(SpeakingBooking b) {
        ObjectNode out = mapper.createObjectNode().put("id", b.getId()).put("status", b.getStatus()).put("createdAt", b.getCreatedAt().toEpochMilli());
        out.set("request", b.getRequest().deepCopy());
        return out;
    }

    private void admin() {
        user();
        if (SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().noneMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Chỉ quản trị viên được xem yêu cầu đặt lịch Speaking");
        }
    }

    private String user() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof AuthPrincipal p) return p.userId();
        throw new ApiException(ErrorCode.UNAUTHORIZED, "Yêu cầu đăng nhập để đặt lịch Speaking");
    }
}