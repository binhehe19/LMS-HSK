package pl.co.lms.service.studymaterials;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import pl.co.lms.entity.*;
import pl.co.lms.service.ResourceSearchColumns;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Locale;

public final class StudyMaterialSpecifications {
    private StudyMaterialSpecifications() {}
    // Fixed student filters from the learning-materials design; older editorial labels remain searchable.
    private static final Map<String, List<String>> SOURCE_GROUPS = Map.of(
            "ielts space pro", List.of("ielts space pro", "the ielts space pro"),
            "youpass collect de thi", List.of("youpass collect đề thi"),
            "c10-c20", List.of("c10-c20", "c10–c20"),
            "actual tests", List.of("actual tests"));
    private static final String OTHER_SOURCES = "cac nguon khac";
    public record Filter(StudyMaterialCategory category, String keyword, String topic, String band, List<String> sources,
                         String skill, String part, String tier, boolean savedOnly) {
        public static Filter all() { return new Filter(null, null, null, null, List.of(), null, null, null, false); }
    }
    public static Specification<LearningResource> catalog(String user, Filter filter, boolean publishedOnly) {
        return (root, query, cb) -> {
            var conditions = new ArrayList<Predicate>();
            conditions.add(cb.equal(root.get("type"), LearningResourceType.STUDY_MATERIAL));
            conditions.add(cb.isFalse(root.get("deleted"))); conditions.add(cb.isTrue(root.get("inLibrary")));
            if (publishedOnly) {
                var sub = query.subquery(String.class);
                var version = sub.from(LearningResourceVersion.class);
                sub.select(version.get("id")).where(cb.equal(version.get("id"), root.get("publishedVersionId")),
                        cb.equal(version.get("resourceId"), root.get("id")), cb.isFalse(version.get("deleted")),
                        cb.equal(version.get("status"), LearningResourceVersionStatus.PUBLISHED));
                conditions.add(cb.exists(sub));
            }
            if (filter.category() != null) conditions.add(cb.equal(root.get("studyCategory"), filter.category().path()));
            equal(conditions, cb, root, "topic", filter.topic()); equal(conditions, cb, root, "studyBand", filter.band());
            equal(conditions, cb, root, "studySkill", filter.skill()); equal(conditions, cb, root, "studyPart", filter.part());
            equal(conditions, cb, root, "studyTier", filter.tier());
            if (filter.sources() != null && !filter.sources().isEmpty()) {
                var source = cb.lower(cb.trim(cb.coalesce(root.<String>get("studySource"), "")));
                var choices = new ArrayList<Predicate>();
                for (String selected : filter.sources()) {
                    if (selected == null || selected.isBlank()) continue;
                    String normalized = ResourceSearchColumns.normalize(selected).replace('–', '-');
                    if (OTHER_SOURCES.equals(normalized)) {
                        choices.add(cb.not(source.in(SOURCE_GROUPS.values().stream().flatMap(List::stream).toList())));
                    } else {
                        choices.add(source.in(SOURCE_GROUPS.getOrDefault(normalized, List.of(selected.strip().toLowerCase(Locale.ROOT)))));
                    }
                }
                if (!choices.isEmpty()) conditions.add(cb.or(choices.toArray(Predicate[]::new)));
            }
            String keyword = ResourceSearchColumns.normalize(filter.keyword());
            if (!keyword.isEmpty()) {
                String pattern = "%" + keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                conditions.add(cb.or(cb.like(root.get("searchTitle"), pattern, '\\'), cb.like(root.get("searchText"), pattern, '\\'), cb.like(root.get("searchTags"), pattern, '\\')));
            }
            if (filter.savedOnly()) {
                var sub = query.subquery(String.class); var state = sub.from(LearningResourceState.class);
                sub.select(state.get("id")).where(cb.equal(state.get("userId"), user), cb.equal(state.get("learningResourceId"), root.get("id")), cb.isFalse(state.get("deleted")), cb.isTrue(state.get("saved")));
                conditions.add(cb.exists(sub));
            }
            return cb.and(conditions.toArray(Predicate[]::new));
        };
    }
    private static void equal(List<Predicate> values, jakarta.persistence.criteria.CriteriaBuilder cb,
                              jakarta.persistence.criteria.Root<LearningResource> root, String field, String value) {
        if (value != null && !value.isBlank()) values.add(cb.equal(root.get(field), value.strip()));
    }
}
