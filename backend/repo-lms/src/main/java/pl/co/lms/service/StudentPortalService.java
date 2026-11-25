package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.request.UpdateStudentProfileRequest;
import pl.co.lms.entity.*;
import pl.co.lms.repository.*;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class StudentPortalService {
    private final StudentProfileRepository profiles;
    private final LearningResourceStateRepository states;
    private final LearningResourceVersionRepository versions;
    private final AssessmentAttemptRepository attempts;
    private final ObjectMapper mapper;
    private final JdbcTemplate jdbc;
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    public record Profile(String publicName, BigDecimal targetBand, LocalDate targetDate, int weeklyMinutes, boolean leaderboardVisible) {}
    public record Favorite(String id, String title, String description, String type, String href, String imageUrl, Instant savedAt) {}
    public record History(String id, String title, String type, String context, String status, String gradingStatus,
                          BigDecimal earnedPoints, BigDecimal totalPoints, Instant startedAt, Instant submittedAt, String href) {}
    public record Rank(long rank, String displayName, long score, long completedResources, long activeDays, boolean currentUser) {}
    public record Board(String period, LocalDate startsOn, LocalDate endsOn, List<Rank> entries, Rank me) {}
    public record PortalPage<T>(List<T> items, long totalElements, int totalPages, int page, int size) {}
    public record HistoryPage(List<History> items, long totalElements, int totalPages, int page, int size, long inProgressCount, long finishedCount) {}

    public Profile profile(String user) {
        return profileOf(profiles.findByUserIdAndDeletedFalse(user).orElseGet(StudentProfile::new));
    }
    private Profile profileOf(StudentProfile p) {
        return new Profile(p.getPublicName(), p.getTargetBand(), p.getTargetDate(), p.getWeeklyMinutes(), p.isLeaderboardVisible());
    }
    @Transactional
    public Profile saveProfile(String user, UpdateStudentProfileRequest request) {
        if (request.targetBand() != null && request.targetBand().remainder(new BigDecimal("0.5")).signum() != 0)
            throw new ApiException(ErrorCode.E200, "Band mục tiêu phải theo bước 0.5");
        var p = profiles.findByUserIdAndDeletedFalse(user).orElseGet(() -> { var value = new StudentProfile(); value.setUserId(user); return value; });
        p.setPublicName(request.publicName() == null ? null : request.publicName().strip());
        p.setTargetBand(request.targetBand()); p.setTargetDate(request.targetDate());
        p.setWeeklyMinutes(request.weeklyMinutes()); p.setLeaderboardVisible(request.leaderboardVisible());
        return profileOf(profiles.saveAndFlush(p));
    }
    public PortalPage<Favorite> favorites(String user, String type, String keyword, int page, int size) {
        return favorites(user, type, keyword, page, size, "newest");
    }
    public PortalPage<Favorite> favorites(String user, String type, String keyword, int page, int size, String sort) {
        if (type != null && !Set.of("VOCABULARY", "STUDY_MATERIAL").contains(type)) throw invalid("Loại nội dung không hợp lệ");
        if (!Set.of("newest", "oldest", "title").contains(sort)) throw invalid("Cách sắp xếp không hợp lệ");
        paging(page, size);
        var result = states.findPortalFavorites(user, type, keyword == null ? "" : keyword.strip().toLowerCase(Locale.ROOT), sort, PageRequest.of(page, size));
        var byVersion = versions.findByIdInAndDeletedFalse(result.getContent().stream().map(row -> row.getVersionId()).distinct().toList())
                .stream().collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));
        var items = result.getContent().stream().map(row -> {
            var version = byVersion.get(row.getVersionId());
            var content = json(version == null ? null : version.getContent());
            boolean word = "VOCABULARY".equals(row.getType());
            String title = content.path(word ? "word" : "title").asText("Nội dung đã lưu");
            String description = content.path(word ? "commonMeaning" : "description").asText("");
            String href = word ? "/dictionary?view=search&word=" + enc(row.getResourceId())
                    : "/studymaterials/" + enc(content.path("category").asText("tai-lieu")) + "/" + enc(row.getResourceId());
            return new Favorite(row.getResourceId(), title, description, row.getType(), href, content.path("imageUrl").asText(""), Instant.ofEpochMilli(row.getSavedAtEpoch()));
        }).toList();
        return new PortalPage<>(items, result.getTotalElements(), result.getTotalPages(), result.getNumber(), result.getSize());
    }
    @Transactional
    public void removeFavorite(String user, String resourceId) {
        // Only mutate the caller's state. Removal also works after a resource is unpublished.
        states.findByUserIdAndLearningResourceIdAndDeletedFalse(user, resourceId).ifPresent(state -> { state.setSaved(false); states.save(state); });
    }
    public HistoryPage history(String user, String typeRaw, String status, String keyword, int page, int size) {
        // `type` của màn lịch sử là nhóm hiển thị: tên kỹ năng (READING...), QUIZ hoặc PLACEMENT (nhóm theo ngữ cảnh, không phải loại phụ).
        if (typeRaw != null && !Set.of("READING", "LISTENING", "WRITING", "SPEAKING", "QUIZ", "QUICK_QUIZ", "PLACEMENT").contains(typeRaw)) throw invalid("Kỹ năng không hợp lệ");
        String type = typeRaw == null || Set.of("PLACEMENT", "QUIZ", ResourceSubTypes.QUICK_QUIZ).contains(typeRaw) ? typeRaw : ResourceSubTypes.PRACTICE_PREFIX + typeRaw;
        if (status != null && !Set.of("IN_PROGRESS", "SUBMITTED", "TIME_OUT").contains(status)) throw invalid("Trạng thái không hợp lệ");
        Specification<AssessmentAttempt> filter = (r, q, cb) -> cb.and(cb.equal(r.get("userId"), user), cb.isFalse(r.get("deleted")));
        if (type != null) filter = filter.and((r, q, cb) -> "PLACEMENT".equals(type) ? cb.like(r.get("contextKey"), "%placement%")
                : cb.and(cb.equal(r.get("subType"), type), cb.notLike(r.get("contextKey"), "%placement%")));
        var now = Instant.now();
        if (status != null) filter = filter.and((r, q, cb) -> {
            var expired = cb.and(cb.equal(r.get("status"), AssessmentAttemptStatus.IN_PROGRESS), cb.isNotNull(r.get("endsAt")), cb.lessThan(r.get("endsAt"), now.minus(AssessmentAttempt.SUBMIT_GRACE)));
            return "TIME_OUT".equals(status) ? cb.or(cb.equal(r.get("status"), AssessmentAttemptStatus.TIME_OUT), expired)
                    : "IN_PROGRESS".equals(status) ? cb.and(cb.equal(r.get("status"), AssessmentAttemptStatus.IN_PROGRESS), cb.not(expired))
                    : cb.equal(r.get("status"), AssessmentAttemptStatus.SUBMITTED);
        });
        if (keyword != null && !keyword.isBlank()) filter = filter.and((r, q, cb) -> {
            var sub = q.subquery(String.class); var resource = sub.from(LearningResource.class);
            sub.select(resource.get("id")).where(cb.equal(resource.get("id"), r.get("learningResourceId")),
                    cb.like(cb.lower(resource.get("searchTitle")), "%" + ResourceSearchColumns.normalize(keyword).replace("%", "\\%").replace("_", "\\_") + "%", '\\'));
            return cb.exists(sub);
        });
        var result = attempts.findAll(filter, paging(page, size));
        var byVersion = versions.findByIdInAndDeletedFalse(result.getContent().stream().map(AssessmentAttempt::getLearningResourceVersionId).distinct().toList())
                .stream().collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));
        var items = result.getContent().stream().map(a -> historyOf(a, byVersion.get(a.getLearningResourceVersionId()), now)).toList();
        long activeCount = attempts.count(filter.and((r, q, cb) -> cb.and(cb.equal(r.get("status"), AssessmentAttemptStatus.IN_PROGRESS),
                cb.or(cb.isNull(r.get("endsAt")), cb.greaterThanOrEqualTo(r.get("endsAt"), now.minus(AssessmentAttempt.SUBMIT_GRACE))))));
        return new HistoryPage(items, result.getTotalElements(), result.getTotalPages(), result.getNumber(), result.getSize(), activeCount, result.getTotalElements() - activeCount);
    }
    /** Nhóm hiển thị trên màn lịch sử: tên kỹ năng với đề luyện kỹ năng, còn lại giữ loại phụ (QUIZ). */
    private static String skillGroup(String subType) {
        String skill = ResourceSubTypes.practiceSkillOf(subType);
        return skill != null ? skill : subType;
    }
    private History historyOf(AssessmentAttempt a, LearningResourceVersion version, Instant now) {
        var content = json(version == null ? null : version.getContent());
        boolean placement = a.getSettings() != null && "PLACEMENT".equals(a.getSettings().path("origin").asText());
        var status = a.effectiveStatus(now);
        boolean active = status == AssessmentAttemptStatus.IN_PROGRESS;
        String href;
        if (placement) {
            String id = a.getLearningResourceId();
            String kind = content.path("layout").path("meta").path("foundation").path("kind").asText().toLowerCase(Locale.ROOT);
            href = Set.of("pronunciation", "vocabulary", "grammar").contains(kind)
                    ? "/practice/placement-test/foundation/" + kind + "?id=" + enc(id) + "&attemptId=" + enc(a.getId())
                    : "/practice/placement-test/tests/" + enc(id) + "/take?attemptId=" + enc(a.getId());
        } else if (a.getContextType() == AssessmentContextType.CLASS_SESSION || ResourceSubTypes.QUIZ.equals(a.getSubType())) href = "/classes";
        else {
            // Đường dẫn màn luyện đặt theo kỹ năng (reading, listening...), không theo tên loại phụ.
            String skillPath = ResourceSubTypes.practiceSkillOf(a.getSubType());
            String prefix = skillPath == null || "READING".equals(skillPath) ? "/practice/" : "/practice/" + skillPath.toLowerCase(Locale.ROOT) + "/";
            href = prefix + enc(a.getLearningResourceId()) + (active ? "/test" : "/result") + "?attemptId=" + enc(a.getId())
                    + "&time=" + enc(a.getMode() == null ? "default" : a.getMode());
            if (active && ResourceSubTypes.PRACTICE_WRITING.equals(a.getSubType()) && a.getSettings() != null)
                href += "&method=" + enc(a.getSettings().path("method").asText("suggestions"));
        }
        return new History(a.getId(), content.path("title").asText("Bài luyện tập"), placement ? "PLACEMENT" : skillGroup(a.getSubType()), a.getContextType().name(),
                status.name(), a.getGradingStatus().name(), a.getGradingStatus() == AssessmentGradingStatus.GRADED ? a.getEarnedPoints() : null,
                a.getTotalPoints(), a.getCreatedAt(), a.getSubmittedAt(), href);
    }
    public Board leaderboard(String user, String period) {
        var today = LocalDate.now(ZONE);
        var start = switch (period) {
            case "week" -> today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case "month" -> today.withDayOfMonth(1);
            default -> throw invalid("Chỉ hỗ trợ xếp hạng tuần hoặc tháng");
        };
        var end = "week".equals(period) ? start.plusWeeks(1) : start.plusMonths(1);
        // No raw user IDs leave this endpoint. One resource per day; at most five rewarded resources per day.
        var rows = jdbc.query("""
                WITH daily AS (
                  SELECT a.user_id, CAST(a.submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS date) AS activity_day,
                         COUNT(DISTINCT a.learning_resource_id) AS completed
                  FROM assessment_attempts a
                  WHERE a.deleted = false AND a.status = 'SUBMITTED' AND a.submitted_at >= ? AND a.submitted_at < ?
                  GROUP BY a.user_id, CAST(a.submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS date)
                ), totals AS (
                  SELECT d.user_id, SUM(LEAST(d.completed, 5) * 10) AS score, SUM(d.completed) AS completed, COUNT(*) AS days
                  FROM daily d LEFT JOIN student_profiles p ON p.user_id = d.user_id AND p.deleted = false
                  WHERE COALESCE(p.leaderboard_visible, true) = true GROUP BY d.user_id
                ), ranked AS (
                  SELECT t.*, ROW_NUMBER() OVER (ORDER BY score DESC, days DESC, completed DESC, t.user_id ASC) AS position,
                         p.public_name FROM totals t LEFT JOIN student_profiles p ON p.user_id = t.user_id AND p.deleted = false
                ) SELECT * FROM ranked WHERE position <= 100 OR user_id = ? ORDER BY position
                """, (rs, index) -> new Rank(rs.getLong("position"),
                        rs.getString("public_name") == null || rs.getString("public_name").isBlank() ? "Học viên ẩn danh" : rs.getString("public_name"),
                        rs.getLong("score"), rs.getLong("completed"), rs.getLong("days"), user.equals(rs.getString("user_id"))),
                java.sql.Timestamp.from(start.atStartOfDay(ZONE).toInstant()), java.sql.Timestamp.from(end.atStartOfDay(ZONE).toInstant()), user);
        return new Board(period, start, end.minusDays(1), rows.stream().filter(row -> row.rank() <= 100).toList(), rows.stream().filter(Rank::currentUser).findFirst().orElse(null));
    }
    private JsonNode json(String value) {
        try {
            var parsed = value == null ? null : mapper.readTree(value);
            return parsed == null || parsed.isNull() ? mapper.createObjectNode() : parsed;
        }
        catch (Exception e) { return mapper.createObjectNode(); }
    }
    private static PageRequest paging(int page, int size) {
        if (page < 0 || page > 100000 || size < 1 || size > 100) throw invalid("Phân trang không hợp lệ");
        return PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
    }
    private static ApiException invalid(String message) { return new ApiException(ErrorCode.E200, message); }
    private static String enc(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20"); }
}
