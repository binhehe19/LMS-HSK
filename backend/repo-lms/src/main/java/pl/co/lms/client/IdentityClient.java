package pl.co.lms.client;

import base.co.common.dto.ApiResponse;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import base.co.common.http.InternalApiClient;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Tra thông tin người dùng ở dịch vụ Auth (nguồn duy nhất của tên/email). LMS chỉ giữ userId nên mọi nơi cần hiển thị
 * hoặc tìm theo tên/email đều đi qua đây; không lưu bản sao, nên người dùng đổi tên/email thì lần tra sau luôn đúng.
 * Dùng token nội bộ (ROLE_SERVICE) của {@link InternalApiClient}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class IdentityClient {

    private static final String LOOKUP_PATH = "/internal/users/lookup";
    private static final String SEARCH_PATH = "/internal/users/search";
    /** Auth giới hạn 100 người mỗi trang tìm kiếm. */
    private static final int SEARCH_PAGE_SIZE = 100;
    /** Tối đa số trang đọc cho một từ khoá; quá mức này kết quả được đánh dấu chưa đầy đủ. */
    static final int MAX_SEARCH_PAGES = 3;
    private static final int LOOKUP_BATCH = 200;

    private final InternalApiClient internalApiClient;

    @Value("${internal.service.identity-service}")
    private String identityService;

    /** Thông tin người dùng dùng để hiển thị. */
    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UserSummary {
        private String userId;
        private String userCode;
        private String fullName;
        private String email;
    }

    /** Kết quả tìm theo từ khoá: truncated = còn người dùng khớp chưa được đọc hết (từ khoá quá chung chung). */
    public record UserSearchResult(Set<String> userIds, boolean truncated) {}

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class SearchPage {
        private List<UserSummary> items;
        private long totalElements;
    }

    /**
     * Tra theo danh sách userId; trả map rỗng nếu Auth không phản hồi (màn hình vẫn dùng được, chỉ thiếu tên) hoặc không có id.
     * userId không tìm thấy đơn giản là không có trong map.
     */
    public Map<String, UserSummary> lookupByIds(Collection<String> userIds) {
        List<String> ids = userIds == null ? List.of() : userIds.stream()
                .filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
        Map<String, UserSummary> result = new LinkedHashMap<>();
        for (int from = 0; from < ids.size(); from += LOOKUP_BATCH) {
            List<String> batch = ids.subList(from, Math.min(ids.size(), from + LOOKUP_BATCH));
            try {
                ApiResponse<List<UserSummary>> body = internalApiClient.send(
                        identityService, LOOKUP_PATH, HttpMethod.POST, MediaType.APPLICATION_JSON, null, null,
                        Map.of("userIds", batch),
                        new ParameterizedTypeReference<ApiResponse<List<UserSummary>>>() {}, false).getBody();
                if (body != null && body.data() != null) {
                    for (UserSummary user : body.data()) {
                        if (user != null && user.getUserId() != null) result.putIfAbsent(user.getUserId(), user);
                    }
                }
            } catch (RuntimeException e) {
                log.warn("Tra thông tin người dùng thất bại ({} id): {}", batch.size(), e.getMessage());
            }
        }
        return result;
    }

    /**
     * Tìm người dùng theo từ khoá (Auth khớp không phân biệt hoa thường trên tên, email, mã người dùng, số điện thoại...).
     * Lỗi gọi Auth được ném ra thay vì trả rỗng: trả rỗng sẽ làm danh sách trông như "không có bài nào".
     */
    public UserSearchResult searchUserIds(String keyword) {
        Set<String> ids = new LinkedHashSet<>();
        long total = 0;
        try {
            for (int page = 0; page < MAX_SEARCH_PAGES; page++) {
                Map<String, Object> request = new LinkedHashMap<>();
                request.put("searchValue", keyword);
                request.put("page", page);
                request.put("size", SEARCH_PAGE_SIZE);
                ApiResponse<SearchPage> body = internalApiClient.send(
                        identityService, SEARCH_PATH, HttpMethod.POST, MediaType.APPLICATION_JSON, null, null, request,
                        new ParameterizedTypeReference<ApiResponse<SearchPage>>() {}, false).getBody();
                SearchPage data = body == null ? null : body.data();
                if (data == null || data.getItems() == null) break;
                total = data.getTotalElements();
                List<UserSummary> items = new ArrayList<>(data.getItems());
                items.stream().filter(Objects::nonNull).map(UserSummary::getUserId).filter(Objects::nonNull).forEach(ids::add);
                if (items.size() < SEARCH_PAGE_SIZE || ids.size() >= total) break;
            }
        } catch (RuntimeException e) {
            log.warn("Tìm người dùng theo từ khoá thất bại: {}", e.getMessage());
            throw new ApiException(ErrorCode.E235, "Không tìm được người dùng lúc này, vui lòng thử lại", e);
        }
        return new UserSearchResult(ids, ids.size() < total);
    }
}
