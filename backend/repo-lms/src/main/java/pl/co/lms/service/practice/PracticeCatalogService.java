package pl.co.lms.service.practice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentContextType;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.repository.AssessmentAttemptRepository;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceVersionRepository;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Danh mục đề tự luyện (bài QUIZ của Kho đã publish) theo nhãn phân loại, kèm trạng thái làm bài của người gọi.
 * Một service cho mọi loại; backend không hiểu bố cục: chỉ trả lại {@code layout.meta} (phần công khai, JSON mờ) để
 * frontend dựng thẻ danh mục.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PracticeCatalogService {

    private static final List<AssessmentAttemptStatus> FINISHED =
            List.of(AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIME_OUT);

    private final LearningResourceRepository resourceRepository;
    private final LearningResourceVersionRepository versions;
    private final AssessmentAttemptRepository attemptRepository;
    private final ObjectMapper mapper;

    /** Danh sách đề của một nhãn; mỗi mục là JSON mô tả đề cộng trạng thái làm bài (status, attemptId, điểm thô...). */
    public List<JsonNode> catalog(String type, String userId) {
        Map<String, AssessmentAttempt> latest = latestFinishedByResource(type, userId);
        Set<String> drafts = new HashSet<>();
        attemptRepository.findByUserIdAndSubTypeAndContextTypeAndStatusInAndDeletedFalseOrderByUpdatedAtDesc(
                userId, type, AssessmentContextType.SELF_STUDY, List.of(AssessmentAttemptStatus.IN_PROGRESS))
                .forEach(a -> drafts.add(a.getLearningResourceId()));

        List<JsonNode> items = new ArrayList<>();
        for (Published p : published(type)) {
            ObjectNode item = baseItem(p);
            AssessmentAttempt done = latest.get(p.resource().getId());
            item.put("status", done == null ? "uncompleted" : "completed");
            item.put("hasDraft", drafts.contains(p.resource().getId()));
            if (done != null) {
                item.put("attemptId", done.getId());
                item.put("completedDate", (done.getSubmittedAt() != null ? done.getSubmittedAt() : done.getUpdatedAt()).toString());
                item.put("earnedPoints", done.getEarnedPoints());
                item.put("totalPoints", done.getTotalPoints());
            }
            items.add(item);
        }
        return items;
    }

    /** resourceId của đề đã publish trong Kho; rỗng nếu không có. */
    public Optional<String> resolveResourceId(String resourceId) {
        if (resourceId == null || resourceId.isBlank()) return Optional.empty();
        return resourceRepository.findByIdAndDeletedFalse(resourceId)
                .filter(r -> r.getType() == LearningResourceType.ASSESSMENT && r.isInLibrary() && r.getPublishedVersionId() != null)
                .map(LearningResource::getId);
    }

    /** Lượt tự luyện đã kết thúc gần nhất của người gọi trên một đề. */
    public Optional<AssessmentAttempt> latestFinished(String userId, String resourceId) {
        return resolveResourceId(resourceId).flatMap(id ->
                attemptRepository.findFirstByUserIdAndLearningResourceIdAndContextTypeAndStatusInAndDeletedFalseOrderByUpdatedAtDesc(
                        userId, id, AssessmentContextType.SELF_STUDY, FINISHED));
    }

    /** Lịch sử các lượt tự luyện của một nhãn (mới nhất trước), kèm đề và điểm thô; dùng cho trang lịch sử. */
    public List<ObjectNode> history(String type, String userId) {
        Map<String, Published> byResource = new LinkedHashMap<>();
        published(type).forEach(p -> byResource.put(p.resource().getId(), p));
        List<ObjectNode> out = new ArrayList<>();
        for (AssessmentAttempt a : attemptRepository.findByUserIdAndSubTypeAndContextTypeAndStatusInAndDeletedFalseOrderByUpdatedAtDesc(
                userId, type, AssessmentContextType.SELF_STUDY,
                List.of(AssessmentAttemptStatus.IN_PROGRESS, AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIME_OUT))) {
            Published p = byResource.get(a.getLearningResourceId());
            if (p == null) continue;
            ObjectNode item = mapper.createObjectNode();
            item.put("attemptId", a.getId());
            item.put("resourceId", a.getLearningResourceId());
            item.put("status", a.getStatus().name());
            item.put("gradingStatus", a.getGradingStatus().name());
            item.put("mode", a.getMode());
            item.put("startedAt", a.getCreatedAt().toString());
            item.put("updatedAt", a.getUpdatedAt().toString());
            if (a.getSubmittedAt() != null) item.put("submittedAt", a.getSubmittedAt().toString());
            item.put("earnedPoints", a.getEarnedPoints());
            item.put("totalPoints", a.getTotalPoints());
            if (a.getSettings() != null) item.set("settings", a.getSettings());
            item.set("test", baseItem(p));
            out.add(item);
        }
        return out;
    }

    private Map<String, AssessmentAttempt> latestFinishedByResource(String type, String userId) {
        Map<String, AssessmentAttempt> latest = new LinkedHashMap<>();
        attemptRepository.findByUserIdAndSubTypeAndContextTypeAndStatusInAndDeletedFalseOrderByUpdatedAtDesc(
                userId, type, AssessmentContextType.SELF_STUDY, FINISHED)
                .forEach(a -> latest.putIfAbsent(a.getLearningResourceId(), a));
        return latest;
    }

    private record Published(LearningResource resource, QuizContent content) {}

    private ObjectNode baseItem(Published p) {
        QuizContent c = p.content();
        ObjectNode item = mapper.createObjectNode();
        item.put("id", p.resource().getId());
        item.put("resourceId", p.resource().getId());
        item.put("subType", p.resource().getSubType() == null ? ResourceSubTypes.QUIZ : p.resource().getSubType());
        item.put("title", c.getTitle());
        item.put("description", c.getDescription() == null ? "" : c.getDescription());
        item.put("questionCount", c.partCount(null));
        item.set("tags", mapper.valueToTree(p.resource().getTags()));
        item.set("timeLimits", mapper.valueToTree(c.getTimeLimits() != null ? c.getTimeLimits()
                : new pl.co.lms.entity.json.TimeLimits(null, null, null)));
        // Phần công khai của layout.meta (đã bỏ grading/explanation) để frontend dựng thẻ danh mục (ảnh bìa, nguồn, mode...).
        JsonNode layout = pl.co.lms.service.LayoutFilter.forStudent(c.getLayout(), false);
        if (layout != null && layout.has("meta")) item.set("meta", layout.get("meta"));
        // Số phần của bài: frontend tính "đề đơn" (1 phần) hay "đề đầy đủ" (từ 2 phần) từ đây thay vì cờ lưu sẵn trong meta.
        item.put("sectionCount", layout == null ? 0 : layout.path("sections").size());
        return item;
    }

    private List<Published> published(String type) {
        List<LearningResource> resources = resourceRepository
                .findByTypeAndInLibraryTrueAndSubTypeAndPublishedVersionIdIsNotNullAndDeletedFalseOrderByIdAsc(
                        LearningResourceType.ASSESSMENT, type);
        if (resources.isEmpty()) return List.of();
        Map<String, LearningResourceVersion> byId = versions.findByIdInAndDeletedFalse(
                        resources.stream().map(LearningResource::getPublishedVersionId).toList())
                .stream().collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));
        List<Published> out = new ArrayList<>();
        for (LearningResource r : resources) {
            LearningResourceVersion v = byId.get(r.getPublishedVersionId());
            QuizContent content = v == null ? null : v.getContentAs(QuizContent.class, mapper);
            if (content != null) out.add(new Published(r, content));
        }
        return out;
    }
}