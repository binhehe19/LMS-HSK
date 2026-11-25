package pl.co.lms.service.grading;

import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;
import pl.co.lms.entity.AssessmentAnswer;
import pl.co.lms.entity.AssessmentAnswerGradingStatus;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentContextType;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Điều kiện lọc danh sách chấm bài. Mỗi điều kiện null là "không lọc"; tập id rỗng nghĩa là không có bài nào khớp
 * (tránh sinh {@code IN ()} không hợp lệ).
 */
public final class AssessmentGradingSpecifications {

    private AssessmentGradingSpecifications() {}

    /**
     * Các bộ lọc đã được giải quyết (userId, sessionId... đã tra xong ở Auth/CMS).
     * gradingStatuses: các trạng thái chấm được xem; null = không lọc theo trạng thái.
     * keywordUserIds, normalizedKeyword: một từ khoá tìm chung, bài khớp khi học sinh thuộc keywordUserIds (đã tra ở Auth) HOẶC tên bài
     * chứa normalizedKeyword (đã chuẩn hoá bằng ResourceSearchColumns.normalize). keywordUserIds null = không có từ khoá;
     * normalizedKeyword rỗng = chỉ xét học sinh.
     * startedFrom (gồm) và startedBefore (không gồm): khoảng thời điểm bắt đầu làm bài (created_at); null = không giới hạn.
     */
    public record Filter(
            Collection<AssessmentGradingStatus> gradingStatuses,
            String subType,
            Collection<AssessmentContextType> contextTypes,
            boolean provisionalOnly,
            Collection<String> keywordUserIds,
            Collection<String> sessionIds,
            Integer sessionNo,
            String normalizedKeyword,
            Instant startedFrom,
            Instant startedBefore) {}

    public static Specification<AssessmentAttempt> of(Filter f) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));
            predicates.add(root.get("contextType").in(f.contextTypes()));
            if (f.gradingStatuses() != null) predicates.add(root.get("gradingStatus").in(f.gradingStatuses()));
            // provisionalOnly bỏ qua nhãn loại bài (đúng hành vi cũ của API).
            if (f.subType() != null && !f.provisionalOnly()) predicates.add(cb.equal(root.get("subType"), f.subType()));
            if (f.sessionIds() != null) predicates.add(f.sessionIds().isEmpty() ? cb.disjunction() : root.get("sessionId").in(f.sessionIds()));
            if (f.sessionNo() != null) predicates.add(cb.equal(root.get("sessionNo"), f.sessionNo()));
            if (f.startedFrom() != null) predicates.add(cb.greaterThanOrEqualTo(root.<Instant>get("createdAt"), f.startedFrom()));
            if (f.startedBefore() != null) predicates.add(cb.lessThan(root.<Instant>get("createdAt"), f.startedBefore()));
            if (f.keywordUserIds() != null) {
                List<Predicate> matches = new ArrayList<>();
                if (!f.keywordUserIds().isEmpty()) matches.add(root.get("userId").in(f.keywordUserIds()));
                if (f.normalizedKeyword() != null && !f.normalizedKeyword().isEmpty()) {
                    Subquery<String> resources = query.subquery(String.class);
                    Root<LearningResource> r = resources.from(LearningResource.class);
                    resources.select(r.<String>get("id")).where(
                            cb.equal(r.get("type"), LearningResourceType.ASSESSMENT),
                            cb.isFalse(r.get("deleted")),
                            cb.like(r.<String>get("searchTitle"), "%" + escapeLike(f.normalizedKeyword()) + "%", '\\'));
                    matches.add(root.get("learningResourceId").in(resources));
                }
                predicates.add(matches.isEmpty() ? cb.disjunction() : cb.or(matches.toArray(Predicate[]::new)));
            }
            if (f.provisionalOnly()) {
                Subquery<Integer> aiGraded = query.subquery(Integer.class);
                Root<AssessmentAnswer> a = aiGraded.from(AssessmentAnswer.class);
                aiGraded.select(cb.literal(1)).where(
                        cb.equal(a.get("attemptId"), root.get("id")),
                        cb.isFalse(a.get("deleted")),
                        cb.equal(a.get("gradingStatus"), AssessmentAnswerGradingStatus.AI_GRADED));
                predicates.add(cb.exists(aiGraded));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
