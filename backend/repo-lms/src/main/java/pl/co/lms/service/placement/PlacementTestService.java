package pl.co.lms.service.placement;

import base.co.common.exception.*;
import base.co.common.util.UlidGenerator;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.request.*;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.*;
import pl.co.lms.repository.*;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import pl.co.lms.service.LearningResourceService;
import pl.co.lms.service.QuizLayoutIntegrity;
import pl.co.lms.service.ResourceSearchColumns;
import pl.co.lms.service.grading.QuestionAutoGrader;
import java.util.*;

/**
 * Authors versioned placement tests directly; a test never depends on the exercise library.
 * A placement test is a LearningResource (outside the library) whose subType is one of {@link #TYPES};
 * "archived" stops new attempts.
 */
@Service @RequiredArgsConstructor @Transactional
public class PlacementTestService {
    static final Set<String> TYPES = ResourceSubTypes.PLACEMENT;
    private final LearningResourceRepository resources;
    private final LearningResourceVersionRepository versions;
    private final LearningResourceService library;
    private final QuestionAutoGrader autoGrader;
    private final ObjectMapper mapper;

    public static String typeOf(PlacementRequests.Category category, PlacementRequests.Foundation foundation) {
        return switch (category) {
            case IELTS -> ResourceSubTypes.PLACEMENT_IELTS;
            case PACE -> ResourceSubTypes.PLACEMENT_PACE;
            case FOUNDATION -> {
                if (foundation == null) throw PlacementAccess.invalid("Đề nền tảng cần chọn loại: phát âm, từ vựng hoặc ngữ pháp");
                yield switch (foundation.kind()) {
                    case PRONUNCIATION -> ResourceSubTypes.FOUNDATION_PRON;
                    case VOCABULARY -> ResourceSubTypes.FOUNDATION_VOCAB;
                    case GRAMMAR -> ResourceSubTypes.FOUNDATION_GRAMMAR;
                };
            }
        };
    }
    static String categoryOf(String subType) {
        return switch (subType) {
            case ResourceSubTypes.PLACEMENT_IELTS -> "IELTS";
            case ResourceSubTypes.PLACEMENT_PACE -> "PACE";
            default -> "FOUNDATION";
        };
    }

    @Transactional(readOnly=true)
    public List<ObjectNode> catalog(String category) {
        PlacementAccess.user();
        return resources.findBySubTypeInAndDeletedFalseOrderByCreatedAtAsc(TYPES).stream()
                .filter(r -> r.getPublishedVersionId() != null && !r.isArchived())
                .filter(r -> category == null || categoryOf(r.getSubType()).equals(category))
                .map(r -> summary(r, false)).toList();
    }
    @Transactional(readOnly=true)
    public ObjectNode instructions(String id) { PlacementAccess.user(); return summary(available(id), false); }
    /** Admin list, newest first, paged on the server; category/kind narrow the assessment types, keyword matches the normalized title. */
    @Transactional(readOnly=true)
    public ObjectNode managementPage(PlacementRequests.Category category, PlacementRequests.FoundationKind kind, String keyword, int page, int size) {
        PlacementAccess.admin();
        Set<String> types = typesFor(category, kind);
        String needle = keyword == null ? "" : ResourceSearchColumns.normalize(keyword.trim());
        Specification<LearningResource> filter = (r, q, cb) -> {
            List<Predicate> all = new ArrayList<>();
            all.add(cb.isFalse(r.get("deleted")));
            all.add(r.get("subType").in(types));
            if (!needle.isBlank()) all.add(cb.like(r.<String>get("searchTitle"), "%" + needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%", '\\'));
            return cb.and(all.toArray(Predicate[]::new));
        };
        Page<LearningResource> result = resources.findAll(filter, PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size)), Sort.by(Sort.Direction.DESC, "createdAt")));
        ObjectNode out = mapper.createObjectNode().put("totalElements", result.getTotalElements()).put("totalPages", result.getTotalPages());
        ArrayNode items = out.putArray("items");
        result.forEach(r -> items.add(summary(r, true)));
        return out;
    }
    static Set<String> typesFor(PlacementRequests.Category category, PlacementRequests.FoundationKind kind) {
        if (category == null) return TYPES;
        return switch (category) {
            case IELTS -> Set.of(ResourceSubTypes.PLACEMENT_IELTS);
            case PACE -> Set.of(ResourceSubTypes.PLACEMENT_PACE);
            case FOUNDATION -> kind == null ? Set.of(ResourceSubTypes.FOUNDATION_PRON, ResourceSubTypes.FOUNDATION_VOCAB, ResourceSubTypes.FOUNDATION_GRAMMAR)
                    : Set.of(typeOf(PlacementRequests.Category.FOUNDATION, new PlacementRequests.Foundation(kind, null, null)));
        };
    }
    @Transactional(readOnly=true)
    public ObjectNode detail(String id) {
        PlacementAccess.admin();
        LearningResource resource = require(id, false);
        ObjectNode out = summary(resource, true);
        String version = resource.getDraftVersionId() != null ? resource.getDraftVersionId() : resource.getPublishedVersionId();
        out.set("content", mapper.valueToTree(content(version)));
        return out;
    }

    public ObjectNode create(PlacementRequests.Test request) {
        PlacementAccess.admin();
        String type = typeOf(request.category(), request.foundation());
        QuizContent content = compose(request);
        // Not in the library: the test is independent of the exercise bank (the attempt engine accepts placement types).
        LearningResource resource = library.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.ASSESSMENT, content, false, false, null, type, List.of("Placement Test")));
        return summary(require(resource.getId(), false), true);
    }
    public ObjectNode update(String id, PlacementRequests.Test request) {
        PlacementAccess.admin();
        LearningResource resource = require(id, true);
        String type = typeOf(request.category(), request.foundation());
        QuizContent content = compose(request);
        // A new version also invalidates a stale admin's publish token, even if another draft already existed.
        library.createDraftVersion(resource.getId(), content);
        resource.setSubType(type);
        return summary(resource, true);
    }
    public ObjectNode publish(String id, String versionId) {
        PlacementAccess.admin();
        LearningResource resource = require(id, true);
        if (!Objects.equals(resource.getDraftVersionId(), versionId))
            throw new ApiException(ErrorCode.E220, "Bản nháp đã thay đổi; hãy tải lại trước khi xuất bản");
        QuizContent quiz = content(versionId);
        if (quiz.getQuestions() == null || quiz.getQuestions().isEmpty()) throw PlacementAccess.invalid("Đề phải có ít nhất một câu hỏi");
        for (QuizQuestion question : quiz.getQuestions()) {
            if (question.getQuestionType() == null) throw PlacementAccess.invalid("Câu hỏi thiếu loại câu");
            boolean manual = Set.of(ExerciseQuestionType.ESSAY, ExerciseQuestionType.AUDIO_RESPONSE, ExerciseQuestionType.FILE_UPLOAD).contains(question.getQuestionType());
            if (!manual && !autoGrader.canAutoGrade(QuestionContent.from(question)))
                throw PlacementAccess.invalid("Câu trắc nghiệm/điền từ chưa có đáp án chấm hợp lệ: " + question.getQuestionId());
        }
        library.publishVersion(resource.getId(), versionId);
        resource.setArchived(false);
        return summary(resource, true);
    }
    public ObjectNode archive(String id) { PlacementAccess.admin(); LearningResource resource = require(id, true); resource.setArchived(true); return summary(resource, true); }

    LearningResource available(String id) {
        LearningResource resource = require(id, false);
        if (resource.isArchived() || resource.getPublishedVersionId() == null)
            throw new ApiException(ErrorCode.E428, "Đề Test đầu vào đang là bản nháp hoặc đã ngừng nhận bài");
        return resource;
    }
    LearningResource require(String id, boolean lock) {
        return (lock ? resources.lockByIdAndSubTypeIn(id, TYPES) : resources.findByIdAndSubTypeInAndDeletedFalse(id, TYPES))
                .orElseThrow(PlacementAccess::missing);
    }
    QuizContent content(String id) {
        if (id == null) throw PlacementAccess.missing();
        QuizContent quiz = versions.findByIdAndDeletedFalse(id).orElseThrow(PlacementAccess::missing).getContentAs(QuizContent.class, mapper);
        if (quiz == null) throw PlacementAccess.missing();
        return quiz;
    }
    private QuizContent compose(PlacementRequests.Test request) {
        List<QuizQuestion> copied = new ArrayList<>();
        Set<String> selected = new HashSet<>(), sectionKeys = new HashSet<>();
        ObjectNode layout = mapper.createObjectNode();
        layout.putObject("meta").put("key", "placement-" + UlidGenerator.nextUlid())
                .put("category", request.category().name()).put("title", request.title()).put("origin", "PLACEMENT");
        // Nguồn và ảnh bìa chỉ để hiển thị trong danh mục học viên; bỏ trống thì không ghi khoá.
        if (request.source() != null && !request.source().isBlank()) ((ObjectNode) layout.get("meta")).put("source", request.source().trim());
        if (request.cover() != null && !request.cover().isBlank()) ((ObjectNode) layout.get("meta")).put("cover", request.cover().trim());
        if (request.foundation() != null) {
            if (request.category() != PlacementRequests.Category.FOUNDATION)
                throw PlacementAccess.invalid("Chỉ đề nền tảng được có cấu hình nền tảng");
            var bands = request.foundation().bands();
            if (bands != null && !bands.isEmpty()) {
                Set<Integer> thresholds = new HashSet<>();
                for (var band : bands) if (band.minPercent() == null || band.minPercent() < 0 || band.minPercent() > 100 || !thresholds.add(band.minPercent()))
                    throw PlacementAccess.invalid("Ngưỡng xếp mức phải từ 0–100 và không được trùng");
                if (!thresholds.contains(0)) throw PlacementAccess.invalid("Thang xếp mức phải bắt đầu từ 0%");
            }
            ((ObjectNode) layout.get("meta")).set("foundation", mapper.valueToTree(request.foundation()));
        }
        layout.put("version", 2);
        ArrayNode sectionLayouts = layout.putArray("sections");
        for (PlacementRequests.Section section : request.sections()) {
            if (!sectionKeys.add(section.key())) throw PlacementAccess.invalid("Không được trùng mã phần thi");
            if (section.content() == null) throw PlacementAccess.invalid("Mỗi phần cần ít nhất một câu hỏi");
            var questions = section.content().getQuestions();
            if (questions == null || questions.isEmpty()) throw PlacementAccess.invalid("Mỗi phần cần ít nhất một câu hỏi");
            // Mỗi phần thi là đúng một phần của layout v2: tiêu đề/mô tả của phần thi, cùng nội dung chung (content/files/media) lấy từ
            // phần duy nhất mà trình soạn gửi trong layout của section.content.
            ObjectNode target = sectionLayouts.addObject().put("id", section.key()).put("title", section.title()).put("description", section.description());
            JsonNode authored = section.content().getLayout() == null ? null : section.content().getLayout().path("sections");
            if (authored != null && authored.isArray()) {
                if (authored.size() > 1) throw PlacementAccess.invalid("Mỗi phần thi chỉ có một phần nội dung chung: " + section.key());
                for (String field : List.of("content", "files", "media")) {
                    if (authored.get(0).has(field)) target.set(field, authored.get(0).get(field).deepCopy());
                }
            }
            ArrayNode questionIds = target.putArray("questionIds");
            for (QuizQuestion original : questions) {
                if (original == null || original.getQuestionType() == null) throw PlacementAccess.invalid("Câu hỏi thiếu loại câu");
                QuizQuestion copy = mapper.convertValue(original, QuizQuestion.class);
                if (copy.getQuestionId() == null || copy.getQuestionId().isBlank()) copy.setQuestionId(UlidGenerator.nextUlid());
                if (copy.getQuestionId().length() > 100 || !selected.add("inline/" + copy.getQuestionId())) throw PlacementAccess.invalid("Mã câu hỏi không hợp lệ hoặc bị trùng trong đề");
                copied.add(copy); questionIds.add(copy.getQuestionId());
            }
        }
        if (request.foundation() != null) {
            boolean pronunciation = request.foundation().kind() == PlacementRequests.FoundationKind.PRONUNCIATION;
            for (QuizQuestion question : copied) {
                if (pronunciation ? question.getQuestionType() != ExerciseQuestionType.AUDIO_RESPONSE
                        : question.getQuestionType() == ExerciseQuestionType.AUDIO_RESPONSE || question.getQuestionType() == ExerciseQuestionType.ESSAY || question.getQuestionType() == ExerciseQuestionType.FILE_UPLOAD)
                    throw PlacementAccess.invalid(pronunciation ? "Đề phát âm chỉ nhận câu ghi âm" : "Đề từ vựng/ngữ pháp chỉ nhận câu chấm tự động");
            }
        }
        QuizContent content = QuizContent.builder().title(request.title()).description(request.description())
                // Cùng cấu trúc thời gian với Kho và Luyện đề: ba mốc, đề một đồng hồ chỉ điền mốc mặc định.
                .timeLimits(new pl.co.lms.entity.json.TimeLimits(request.durationSeconds(), null, null))
                .questions(copied).layout(layout).build();
        var violations = QuizLayoutIntegrity.violations(content);
        if (!violations.isEmpty()) throw PlacementAccess.invalid("Bố cục đề không khớp câu hỏi: " + QuizLayoutIntegrity.message(violations));
        return content;
    }
    private static Set<String> idsOf(JsonNode questionIds) {
        Set<String> ids = new HashSet<>();
        questionIds.forEach(id -> ids.add(id.asText()));
        return ids;
    }

    private ObjectNode summary(LearningResource resource, boolean admin) {
        String versionId = admin && resource.getDraftVersionId() != null ? resource.getDraftVersionId() : resource.getPublishedVersionId();
        QuizContent content = content(versionId);
        ObjectNode out = mapper.createObjectNode().put("id", resource.getId()).put("title", content.getTitle())
                .put("description", content.getDescription()).put("versionId", versionId)
                .put("category", categoryOf(resource.getSubType()))
                .put("durationSeconds", content.limitSeconds("default"))
                .put("questionCount", content.partCount(null)).put("available", !resource.isArchived() && resource.getPublishedVersionId() != null);
        out.putArray("feedbackMethods").add("MENTOR");
        out.set("foundation", foundation(content));
        JsonNode meta = content.getLayout().path("meta");
        if (meta.path("source").isTextual()) out.put("source", meta.path("source").asText());
        if (meta.path("cover").isTextual()) out.put("cover", meta.path("cover").asText());
        // Instructions expose structure only; passages, audio and questions are supplied by the attempt engine.
        ArrayNode structure = out.putArray("sections");
        content.getLayout().path("sections").forEach(s -> structure.addObject().put("id", s.path("id").asText())
                .put("title", s.path("title").asText()).put("description", s.path("description").asText(""))
                .put("questionCount", content.partCount(idsOf(s.path("questionIds")))));
        if (admin) {
            out.put("draftVersionId", resource.getDraftVersionId()).put("publishedVersionId", resource.getPublishedVersionId())
                    .put("status", resource.getPublishedVersionId() == null ? "DRAFT" : resource.isArchived() ? "ARCHIVED" : "PUBLISHED");
        }
        return out;
    }

    /** Read the immutable snapshot; old single-section foundation tests remain addressable. */
    JsonNode foundation(QuizContent content) {
        JsonNode meta = content.getLayout().path("meta");
        if (!"FOUNDATION".equals(meta.path("category").asText())) return NullNode.instance;
        if (meta.path("foundation").isObject()) return meta.path("foundation");
        JsonNode sections = content.getLayout().path("sections");
        if (sections.size() == 1) {
            String key = sections.get(0).path("id").asText().toUpperCase(Locale.ROOT);
            if (Set.of("PRONUNCIATION", "VOCABULARY", "GRAMMAR").contains(key))
                return mapper.createObjectNode().put("kind", key);
        }
        return NullNode.instance;
    }
}

