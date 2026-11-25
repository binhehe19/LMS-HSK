package pl.co.lms.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import base.co.common.dto.ApiResponse;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import base.co.common.filter.principal.AuthPrincipal;
import base.co.common.security.SecurityConstants;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.util.UriComponentsBuilder;
import pl.co.lms.client.dto.CmsClassDetail;
import pl.co.lms.client.dto.CmsClassFeedback;
import pl.co.lms.client.dto.CmsClassSession;
import pl.co.lms.client.dto.CmsClassSessionPage;
import pl.co.lms.client.dto.CmsClassSummaryPage;
import pl.co.lms.client.dto.CmsEnrollmentPage;
import pl.co.lms.client.dto.CmsMyClass;
import pl.co.lms.client.dto.CmsMySessionShared;
import pl.co.lms.client.dto.CmsMyStudentRecord;
import pl.co.lms.client.dto.CmsScheduleItem;
import pl.co.lms.client.dto.CmsSyllabusDetail;
import pl.co.lms.client.dto.CmsSyllabusFilterOptions;
import pl.co.lms.client.dto.CmsSyllabusPage;
import pl.co.lms.client.dto.CmsSyllabusSummary;
import pl.co.lms.client.dto.CmsSyllabusVersionDetail;
import pl.co.lms.client.dto.CmsSyllabusVersionSummary;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// "Cms" = hệ thống ERP thật (ERP/ERP_Backend/repo-ems), đặt tên theo vai trò với LMS (quản
// lý giáo trình/lớp học) để dễ tìm trong codebase repo-lms - không đổi tên dự án ERP.
@Slf4j
@Component
public class CmsClient {

    private final RestTemplate restTemplate;
    private final String cmsBaseUrl;

    // @Lazy để break circular proxy: @Cacheable hoạt động qua Spring AOP proxy,
    // self-injection là pattern chuẩn để internal call cũng đi qua proxy.
    @Lazy
    @Autowired
    private CmsClient self;

    public CmsClient(@Qualifier("directRestTemplate") RestTemplate restTemplate,
                     @Value("${cms.base-url}") String cmsBaseUrl) {
        this.restTemplate = restTemplate;
        this.cmsBaseUrl = cmsBaseUrl;
    }

    @Cacheable(value = "cms-class-detail", key = "#classId")
    public CmsClassDetail getClassDetail(String classId) {
        String url = cmsBaseUrl + "/management/classes/" + classId;
        return callCms(url, new ParameterizedTypeReference<ApiResponse<CmsClassDetail>>() {});
    }

    @Cacheable(value = "cms-class-sessions", key = "#classId")
    public List<CmsClassSession> getClassSessions(String classId) {
        // size=500: endpoint phân trang (default size=20) — 1 khoá dài (VD 40+ buổi) sẽ bị
        // cắt bớt nếu dùng default, khiến resolveScheduleItemId tìm không ra session ở
        // trang sau. Chấp nhận lấy 1 trang lớn thay vì tự lặp phân trang (YAGNI).
        String url = cmsBaseUrl + "/management/classes/" + classId + "/sessions?size=500";
        CmsClassSessionPage page = callCms(url, new ParameterizedTypeReference<ApiResponse<CmsClassSessionPage>>() {});
        return page.getItems() == null ? List.of() : page.getItems();
    }

    @Cacheable(value = "cms-syllabus-version", key = "#syllabusVersionId")
    public CmsSyllabusVersionDetail getSyllabusVersionSchedule(String syllabusVersionId) {
        String url = cmsBaseUrl + "/syllabus/versions/" + syllabusVersionId;
        return callCms(url, new ParameterizedTypeReference<ApiResponse<CmsSyllabusVersionDetail>>() {});
    }

    // Dùng cho màn "Giáo trình" — cho admin chọn giáo trình thật từ dropdown thay vì gõ tay ID.
    @Cacheable("cms-syllabus-list")
    public List<CmsSyllabusSummary> listSyllabuses() {
        String url = cmsBaseUrl + "/syllabus";
        return callCmsList(url, new ParameterizedTypeReference<ApiResponse<List<CmsSyllabusSummary>>>() {});
    }

    // Trang giáo trình lọc/phân trang ở ERP. Redis chỉ cache, không giữ danh sách để lọc: khoá gồm cả
    // page và size (đổi kích thước trang là trang khác). Chỉ cache truy vấn KHÔNG có từ khoá vì từ khoá
    // gõ tự do sẽ sinh vô số khoá; số khoá còn lại giới hạn bởi cấp độ × loại × trang × cỡ trang.
    @Cacheable(value = "cms-syllabus-page", condition = "#keyword == null || #keyword.isBlank()",
            key = "{#educationLevelId, #type, #page, #size}")
    public CmsSyllabusPage searchSyllabuses(String keyword, String educationLevelId, String type, int page, int size) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(cmsBaseUrl + "/syllabus/search")
                .queryParam("page", page)
                .queryParam("size", size);
        if (keyword != null && !keyword.isBlank()) builder.queryParam("keyword", keyword.trim());
        if (educationLevelId != null && !educationLevelId.isBlank()) builder.queryParam("education_level_id", educationLevelId);
        if (type != null && !type.isBlank()) builder.queryParam("type", type);
        return callCms(builder.encode().toUriString(), new ParameterizedTypeReference<ApiResponse<CmsSyllabusPage>>() {});
    }

    @Cacheable("cms-syllabus-filter-options")
    public CmsSyllabusFilterOptions syllabusFilterOptions() {
        return callCms(cmsBaseUrl + "/syllabus/filter-options", new ParameterizedTypeReference<ApiResponse<CmsSyllabusFilterOptions>>() {});
    }

    @Cacheable(value = "cms-syllabus-versions-list", key = "#syllabusId")
    public List<CmsSyllabusVersionSummary> listSyllabusVersions(String syllabusId) {
        String url = cmsBaseUrl + "/syllabus/" + syllabusId + "/versions";
        return callCmsList(url, new ParameterizedTypeReference<ApiResponse<List<CmsSyllabusVersionSummary>>>() {});
    }

    // Dùng cho màn "Giáo trình" - trả toàn bộ nội dung soạn thảo (CLO, tài liệu, lịch
    // trình, tiêu chí, bài kiểm tra mẫu) của version đang PUBLISHED.
    @Cacheable(value = "cms-syllabus-detail", key = "#syllabusId")
    public CmsSyllabusDetail getSyllabusDetail(String syllabusId) {
        String url = cmsBaseUrl + "/syllabus/" + syllabusId;
        return callCms(url, new ParameterizedTypeReference<ApiResponse<CmsSyllabusDetail>>() {});
    }

    // Dùng cho màn "Danh sách lớp" (tham khảo) - filter theo đúng các trường CMS hỗ trợ ở
    // GET /management/classes (xem CourseClassController.list bên repo-ems).
    @Cacheable(value = "cms-class-list", key = "{#keyword, #lifecycleStatus, #excludeLifecycleStatuses, "
            + "#educationLevelId, #daysOfWeek, #timeSlot, #assigned, #teacherId, #page, #size}")
    public CmsClassSummaryPage listClasses(String keyword, String lifecycleStatus,
            List<String> excludeLifecycleStatuses, String educationLevelId, List<String> daysOfWeek,
            String timeSlot, Boolean assigned, String teacherId, int page, int size) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(cmsBaseUrl + "/management/classes")
                .queryParam("page", page)
                .queryParam("size", size);
        if (keyword != null && !keyword.isBlank()) builder.queryParam("keyword", keyword);
        if (lifecycleStatus != null && !lifecycleStatus.isBlank()) builder.queryParam("lifecycle_status", lifecycleStatus);
        if (excludeLifecycleStatuses != null && !excludeLifecycleStatuses.isEmpty()) {
            builder.queryParam("exclude_lifecycle_statuses", excludeLifecycleStatuses.toArray());
        }
        if (educationLevelId != null && !educationLevelId.isBlank()) builder.queryParam("education_level_id", educationLevelId);
        if (daysOfWeek != null && !daysOfWeek.isEmpty()) builder.queryParam("days_of_week", daysOfWeek.toArray());
        if (timeSlot != null && !timeSlot.isBlank()) builder.queryParam("time_slot", timeSlot);
        if (assigned != null) builder.queryParam("assigned", assigned);
        if (teacherId != null && !teacherId.isBlank()) builder.queryParam("teacher_id", teacherId);
        String url = builder.encode().toUriString();
        return callCms(url, new ParameterizedTypeReference<ApiResponse<CmsClassSummaryPage>>() {});
    }

    // Dùng cho tab "Học viên" ở màn chi tiết lớp (tham khảo).
    @Cacheable(value = "cms-class-enrollments", key = "{#classId, #page, #size}")
    public CmsEnrollmentPage listEnrollments(String classId, int page, int size) {
        String url = UriComponentsBuilder.fromHttpUrl(cmsBaseUrl + "/management/enrollments")
                .queryParam("class_id", classId)
                .queryParam("status", "ENROLLED")
                .queryParam("page", page)
                .queryParam("size", size)
                .encode().toUriString();
        return callCms(url, new ParameterizedTypeReference<ApiResponse<CmsEnrollmentPage>>() {});
    }

    // Dùng cho tab "Feedback" ở màn chi tiết lớp (tham khảo) - feedback học viên đánh giá
    // giáo viên, chỉ ROLE_ADMIN được xem (xem ghi chú ở CmsClassFeedback).
    @Cacheable(value = "cms-class-feedback", key = "#classId")
    public CmsClassFeedback getClassFeedback(String classId) {
        String url = cmsBaseUrl + "/management/student-feedback/classes/" + classId;
        return callCms(url, new ParameterizedTypeReference<ApiResponse<CmsClassFeedback>>() {});
    }

    // Dùng cho màn "Lớp học" (học viên/giáo viên tự xem lớp của mình) - GET /me/classes tự
    // scope theo JWT người gọi ở CMS (không cần ROLE_ADMIN). Dữ liệu khác nhau tuỳ người gọi nên
    // cache theo KHOÁ RIÊNG TỪNG NGƯỜI DÙNG (userId lấy từ SecurityContext, không nhận qua tham số)
    // chứ không dùng khoá chung - cache chung sẽ lộ dữ liệu giữa các user. TTL ngắn (45 giây, xem
    // CacheConfig) vì hàm này bị gọi lặp nhiều lần trong cùng một lượt xem trang (chi tiết lớp,
    // tiến độ, kiểm tra quyền khi bắt đầu làm bài) và chủ yếu để kiểm tra "người dùng có thuộc lớp".
    @Cacheable(value = "cms-my-classes", key = "#root.target.cacheUserKey() + ':' + #lifecycleStatus")
    public List<CmsMyClass> getMyClasses(String lifecycleStatus) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(cmsBaseUrl + "/me/classes");
        if (lifecycleStatus != null && !lifecycleStatus.isBlank()) builder.queryParam("status", lifecycleStatus);
        return callCmsList(builder.encode().toUriString(), new ParameterizedTypeReference<ApiResponse<List<CmsMyClass>>>() {});
    }

    // Khoá cache riêng từng người dùng cho getMyClasses. Public vì SpEL gọi qua #root.target; không có
    // người dùng đăng nhập thì ném lỗi (không bao giờ cache dưới khoá chung).
    public String cacheUserKey() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthPrincipal principal) {
            return principal.userId();
        }
        throw new ApiException(ErrorCode.UNAUTHORIZED, "Yêu cầu đăng nhập");
    }

    // Danh sách buổi học của 1 lớp - CMS đảm bảo response KHÔNG chứa dữ liệu cá nhân (điểm
    // danh riêng tách sang getMyRecords), nên an toàn để cache dùng CHUNG cho mọi học viên/
    // giáo viên trong lớp (khác getMyClasses/getMyRecords - không cache vì có dữ liệu cá nhân).
    // Cache bỏ qua kiểm tra của CMS, nên nơi gọi PHẢI xác nhận người dùng thuộc lớp trước (getMyClasses / requireMyClass).
    @Cacheable(value = "cms-me-class-sessions", key = "#classId")
    public List<CmsMySessionShared> getMyClassSessions(String classId) {
        String url = cmsBaseUrl + "/me/classes/" + classId + "/sessions";
        return callCmsList(url, new ParameterizedTypeReference<ApiResponse<List<CmsMySessionShared>>>() {});
    }

    // Điểm danh + bảng điểm cá nhân của người gọi trong 1 lớp - không cache (dữ liệu riêng
    // từng user, không đọc hộ userId khác vì controller không nhận studentId qua param, tránh IDOR).
    public CmsMyStudentRecord getMyRecords(String classId) {
        String url = cmsBaseUrl + "/me/classes/" + classId + "/my-records";
        return callCms(url, new ParameterizedTypeReference<ApiResponse<CmsMyStudentRecord>>() {});
    }

    @CacheEvict(value = {
            "cms-class-detail",
            "cms-class-sessions",
            "cms-class-list",
            "cms-class-enrollments",
            "cms-class-feedback",
            "cms-syllabus-version",
            "cms-syllabus-list",
            "cms-syllabus-page",
            "cms-syllabus-filter-options",
            "cms-syllabus-versions-list",
            "cms-syllabus-detail",
            "cms-me-class-sessions",
            "cms-my-classes"
    }, allEntries = true)
    public void evictAllCmsCache() {
        log.info("Cleared all CMS external Redis caches");
    }

    // Kết hợp 3 method trên: classId + sessionId → scheduleItemId
    public String resolveScheduleItemId(String classId, String sessionId) {
        CmsClassDetail classDetail = self.getClassDetail(classId);
        String syllabusVersionId = classDetail.getSyllabusVersionId();
        if (syllabusVersionId == null || syllabusVersionId.isBlank()) {
            throw new ApiException(ErrorCode.E281, "Class " + classId + " không có syllabusVersionId");
        }

        List<CmsClassSession> sessions = self.getClassSessions(classId);
        Integer sessionNo = sessions.stream()
                .filter(s -> sessionId.equals(s.getId()))
                .map(CmsClassSession::getSessionNo)
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.E227,
                        "Session " + sessionId + " không thuộc class " + classId));

        return resolveScheduleItemBySessionNo(syllabusVersionId, sessionNo);
    }

    private String resolveScheduleItemBySessionNo(String syllabusVersionId, int sessionNo) {
        CmsSyllabusVersionDetail version = self.getSyllabusVersionSchedule(syllabusVersionId);
        if (version.getSchedule() == null) {
            throw new ApiException(ErrorCode.E281, "SyllabusVersion " + syllabusVersionId + " không có schedule");
        }
        return version.getSchedule().stream()
                .filter(item -> item.getSessionNo() != null && item.getSessionNo() == sessionNo)
                .map(CmsScheduleItem::getId)
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.E227,
                        "Không tìm thấy ScheduleItem cho sessionNo=" + sessionNo + " trong syllabusVersion=" + syllabusVersionId));
    }

    private <T> T callCms(String url, ParameterizedTypeReference<ApiResponse<T>> type) {
        try {
            ResponseEntity<ApiResponse<T>> response = restTemplate.exchange(
                    url, HttpMethod.GET, buildRequest(), type);
            ApiResponse<T> body = response.getBody();
            if (body == null || !body.success() || body.data() == null) {
                throw new ApiException(ErrorCode.E281, "CMS trả response không hợp lệ: " + url);
            }
            return body.data();
        } catch (RestClientResponseException ex) {
            log.error("CMS API lỗi {} tại {}", ex.getStatusCode(), url);
            throw new ApiException(ErrorCode.E281, "CMS service error: " + ex.getStatusCode(), ex);
        } catch (ResourceAccessException ex) {
            log.error("CMS service không phản hồi: {}", url);
            throw new ApiException(ErrorCode.E235, "CMS service unavailable", ex);
        }
    }

    private <T> List<T> callCmsList(String url, ParameterizedTypeReference<ApiResponse<List<T>>> type) {
        try {
            ResponseEntity<ApiResponse<List<T>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, buildRequest(), type);
            ApiResponse<List<T>> body = response.getBody();
            if (body == null || !body.success()) {
                throw new ApiException(ErrorCode.E281, "CMS trả response không hợp lệ: " + url);
            }
            return body.data() == null ? List.of() : body.data();
        } catch (RestClientResponseException ex) {
            log.error("CMS API lỗi {} tại {}", ex.getStatusCode(), url);
            throw new ApiException(ErrorCode.E281, "CMS service error: " + ex.getStatusCode(), ex);
        } catch (ResourceAccessException ex) {
            log.error("CMS service không phản hồi: {}", url);
            throw new ApiException(ErrorCode.E235, "CMS service unavailable", ex);
        }
    }

    public com.fasterxml.jackson.databind.JsonNode getCourseCatalog(String query) {
        return callCms(cmsBaseUrl + "/course-catalog" + query, new ParameterizedTypeReference<ApiResponse<com.fasterxml.jackson.databind.JsonNode>>() {});
    }
    public com.fasterxml.jackson.databind.JsonNode getStudentLearningPlan(String classId) {
        return callCms(cmsBaseUrl + "/me/classes/" + classId + "/learning-plan", new ParameterizedTypeReference<ApiResponse<com.fasterxml.jackson.databind.JsonNode>>() {});
    }
    private HttpEntity<Void> buildRequest() {
        HttpHeaders headers = new HttpHeaders();
        String jwt = resolveUserJwt();
        if (jwt != null) {
            headers.set(SecurityConstants.HEADER_AUTHORIZATION, jwt);
        }
        return new HttpEntity<>(headers);
    }

    private String resolveUserJwt() {
        var attrs = RequestContextHolder.getRequestAttributes();
        if (!(attrs instanceof ServletRequestAttributes sa)) return null;
        return bearerOf(sa.getRequest());
    }

    /**
     * Token người dùng để chuyển tiếp sang CMS: header Authorization nếu có; không có thì lấy từ cookie HttpOnly
     * {@code access_token} (chế độ đăng nhập bằng cookie: trình duyệt không gửi header). Thiếu cả hai thì null.
     */
    static String bearerOf(HttpServletRequest request) {
        String header = request.getHeader(SecurityConstants.HEADER_AUTHORIZATION);
        if (header != null && !header.isBlank()) return header;
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (SecurityConstants.COOKIE_ACCESS_TOKEN.equals(cookie.getName())
                    && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return SecurityConstants.HEADER_BEARER_PREFIX + cookie.getValue();
            }
        }
        return null;
    }
}
