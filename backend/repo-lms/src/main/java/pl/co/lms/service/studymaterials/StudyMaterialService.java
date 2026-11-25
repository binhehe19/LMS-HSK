package pl.co.lms.service.studymaterials;

import pl.co.lms.dto.request.SaveStudyMaterialRequest;
import pl.co.lms.dto.request.SubmitStudyMaterialRecallRequest;
import pl.co.lms.dto.request.UpdateStudyMaterialProgressRequest;
import pl.co.lms.dto.request.UpdateStudyMaterialStateRequest;
import pl.co.lms.dto.response.StudyMaterialDetailResponse;
import pl.co.lms.dto.response.StudyMaterialFacetsResponse;
import pl.co.lms.dto.response.StudyMaterialHomeResponse;
import pl.co.lms.dto.response.StudyMaterialManagementResponse;
import pl.co.lms.dto.response.StudyMaterialPersonalResponse;
import pl.co.lms.dto.response.StudyMaterialProgressResponse;
import pl.co.lms.dto.response.StudyMaterialRecallAnswerResponse;
import pl.co.lms.dto.response.StudyMaterialRecallResponse;
import pl.co.lms.dto.response.StudyMaterialSummaryResponse;
import pl.co.lms.dto.response.StudyMaterialWordResponse;
import base.co.common.dto.PageResponse;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;
import pl.co.lms.dto.request.CreateLearningResourceRequest;
import pl.co.lms.dto.response.LearningResourceVersionResponse;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.StudyMaterialContent;
import pl.co.lms.entity.json.VocabularyEnContent;
import pl.co.lms.repository.*;
import pl.co.lms.service.DictionaryService;
import pl.co.lms.service.LearningResourceService;
import pl.co.lms.service.LearningResourceStateService;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import static pl.co.lms.service.studymaterials.StudyMaterialValidation.*;
import static pl.co.lms.service.studymaterials.StudyMaterialSpecifications.*;

@Service @Transactional(readOnly = true)
public class StudyMaterialService {
    private final LearningResourceService resourceService;
    private final LearningResourceStateService stateService;
    private final LearningResourceRepository resources;
    private final LearningResourceVersionRepository versions;
    private final LearningResourceStateRepository states;
    private final StudyMaterialProgressRepository progress;
    private final StudyMaterialFacetRepository facets;
    private final StudyMaterialVocabularyService vocabulary;
    private final ObjectMapper mapper;

    public StudyMaterialService(LearningResourceService resourceService, LearningResourceStateService stateService,
                                LearningResourceRepository resources, LearningResourceVersionRepository versions,
                                LearningResourceStateRepository states, StudyMaterialProgressRepository progress,
                                StudyMaterialFacetRepository facets, StudyMaterialVocabularyService vocabulary, ObjectMapper mapper) {
        this.resourceService = resourceService; this.stateService = stateService; this.resources = resources;
        this.versions = versions; this.states = states; this.progress = progress; this.facets = facets;
        this.vocabulary = vocabulary; this.mapper = mapper;
    }

    private record Published(LearningResource resource, LearningResourceVersion version, StudyMaterialContent content) {}
    private static void user(String user) { if (user == null || user.isBlank()) throw new ApiException(ErrorCode.UNAUTHORIZED); }
    private LearningResource material(String id) {
        return resources.findByIdAndDeletedFalse(id).filter(resource -> resource.getType() == LearningResourceType.STUDY_MATERIAL && resource.isInLibrary())
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Không tìm thấy học liệu"));
    }
    private LearningResource lock(String id) {
        return resources.findByIdForStart(id).filter(resource -> resource.getType() == LearningResourceType.STUDY_MATERIAL && resource.isInLibrary())
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Không tìm thấy học liệu"));
    }
    private Published published(String id) { return published(material(id)); }
    private Published published(LearningResource resource) {
        if (resource.getPublishedVersionId() == null) throw new ApiException(ErrorCode.E227, "Học liệu chưa được xuất bản");
        var version = versions.findByIdAndDeletedFalse(resource.getPublishedVersionId()).filter(value -> value.getResourceId().equals(resource.getId()) && value.getStatus() == LearningResourceVersionStatus.PUBLISHED)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Học liệu chưa được xuất bản"));
        var content = version.getContentAs(StudyMaterialContent.class, mapper);
        if (content == null) throw new ApiException(ErrorCode.E227, "Học liệu chưa có nội dung");
        return new Published(resource, version, content);
    }
    public PageResponse<StudyMaterialSummaryResponse> catalog(String user, Filter filter, int page, int size) {
        user(user); return catalog(user, filter, page, size, true);
    }
    public PageResponse<StudyMaterialSummaryResponse> managementCatalog(Filter filter, int page, int size) { return catalog(null, filter, page, size, false); }
    private PageResponse<StudyMaterialSummaryResponse> catalog(String user, Filter filter, int page, int size, boolean publishedOnly) {
        int safePage = Math.max(0, page), safeSize = Math.min(100, Math.max(1, size));
        require((long) safePage * safeSize <= Integer.MAX_VALUE, "Số trang vượt giới hạn");
        var result = resources.findAll(StudyMaterialSpecifications.catalog(user, filter, publishedOnly), PageRequest.of(safePage, safeSize, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        return new PageResponse<>(summaries(user, result.getContent(), publishedOnly), result.getTotalElements(), result.getTotalPages(), safePage, safeSize, null);
    }
    public StudyMaterialFacetsResponse facets(StudyMaterialCategory category) {
        var rows = facets.facets(category == null ? null : category.path());
        return new StudyMaterialFacetsResponse(column(rows, 0), column(rows, 1), column(rows, 2), column(rows, 3));
    }
    private static List<String> column(List<Object[]> rows, int column) {
        return rows.stream().map(row -> (String) row[column]).filter(value -> value != null && !value.isBlank()).distinct().sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }
    public StudyMaterialHomeResponse home(String user) {
        user(user);
        var counts = new LinkedHashMap<String, Long>();
        for (var category : StudyMaterialCategory.values()) counts.put(category.path(), resources.count(StudyMaterialSpecifications.catalog(user, new Filter(category, null, null, null, List.of(), null, null, null, false), true)));
        var recent = catalog(user, Filter.all(), 0, 12).getItems();
        var saved = catalog(user, new Filter(null, null, null, null, List.of(), null, null, null, true), 0, 12).getItems();
        var continuing = progress.findRecent(user, PageRequest.of(0, 12));
        var byId = resources.findByIdInAndDeletedFalse(continuing.stream().map(StudyMaterialProgress::getResourceId).toList()).stream().collect(Collectors.toMap(LearningResource::getId, Function.identity()));
        return new StudyMaterialHomeResponse(counts, recent, saved, summaries(user, continuing.stream().map(row -> byId.get(row.getResourceId())).filter(Objects::nonNull).toList(), true));
    }
    public StudyMaterialDetailResponse detail(String user, String id) {
        user(user); var item = published(id);
        var words = vocabulary.forReader(user, item.content());
        return new StudyMaterialDetailResponse(summaries(user, List.of(item.resource()), true).getFirst(), item.content(), words.words(), words.highlights());
    }
    public List<StudyMaterialSummaryResponse> related(String user, String id) {
        user(user); var item = published(id);
        var filter = new Filter(item.content().getCategory(), null, item.content().getTopic(), null, List.of(), null, null, null, false);
        var result = resources.findAll(StudyMaterialSpecifications.catalog(user, filter, true).and((root, query, cb) -> cb.notEqual(root.get("id"), id)), PageRequest.of(0, 3, Sort.by(Sort.Direction.DESC, "createdAt")));
        return summaries(user, result.getContent(), true);
    }
    private List<StudyMaterialSummaryResponse> summaries(String user, List<LearningResource> source, boolean publishedOnly) {
        if (source.isEmpty()) return List.of();
        var ids = source.stream().map(LearningResource::getId).toList();
        var versionIds = source.stream().map(resource -> !publishedOnly && resource.getDraftVersionId() != null ? resource.getDraftVersionId() : resource.getPublishedVersionId()).filter(Objects::nonNull).distinct().toList();
        var byVersion = versions.findByIdInAndDeletedFalse(versionIds).stream().collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));
        var personal = user == null ? Map.<String, LearningResourceState>of() : states.findByUserIdAndLearningResourceIdInAndDeletedFalse(user, ids).stream().collect(Collectors.toMap(LearningResourceState::getLearningResourceId, Function.identity(), StudyMaterialVocabularyService::latestState));
        var positions = user == null ? Map.<String, StudyMaterialProgress>of() : progress.findByUserIdAndResourceIdInAndDeletedFalse(user, ids).stream().collect(Collectors.toMap(StudyMaterialProgress::getResourceId, Function.identity()));
        var result = new ArrayList<StudyMaterialSummaryResponse>();
        for (var resource : source) {
            var version = byVersion.get(!publishedOnly && resource.getDraftVersionId() != null ? resource.getDraftVersionId() : resource.getPublishedVersionId());
            if (version == null || !resource.getId().equals(version.getResourceId()) || publishedOnly && version.getStatus() != LearningResourceVersionStatus.PUBLISHED) continue;
            var content = version.getContentAs(StudyMaterialContent.class, mapper);
            if (content == null) continue;
            var state = personal.get(resource.getId());
            var row = positions.get(resource.getId());
            var position = row != null && version.getId().equals(row.getVersionId()) ? position(row) : null;
            result.add(new StudyMaterialSummaryResponse(resource.getId(), version.getId(), content.getCategory(), content.getTitle(), content.getSubtitle(), content.getDescription(), content.getImageUrl(), content.getTopic(), content.getBand(), content.getSource(), content.getTier(), content.getSkill(), content.getPart(), content.getMinutes(), content.getDurationSeconds(), content.getPageCount(), content.getCefrLevel(), content.getAcademicWordList(), version.getUpdatedAt(), new StudyMaterialPersonalResponse(state != null && state.isSaved(), state == null ? "" : Objects.toString(state.getNote(), ""), position), publishedOnly ? null : resource.getDraftVersionId(), resource.getPublishedVersionId()));
        }
        return result;
    }
    public StudyMaterialManagementResponse managementDetail(String id) {
        var resource = material(id);
        var draft = resource.getDraftVersionId() == null ? null : resourceService.getVersion(resource.getDraftVersionId());
        var published = resource.getPublishedVersionId() == null ? null : resourceService.getVersion(resource.getPublishedVersionId());
        return new StudyMaterialManagementResponse(resourceService.getResourceResponse(id), LearningResourceVersionResponse.from(draft, resource, mapper), LearningResourceVersionResponse.from(published, resource, mapper));
    }
    private StudyMaterialContent prepare(StudyMaterialContent source) {
        var content = mapper.convertValue(source, StudyMaterialContent.class);
        validate(content);
        if (content.getCategory() == StudyMaterialCategory.DIGLOT) vocabulary.precompute(content);
        else {
            content.setVocabularyIndex(null);
            if (content.getVocabularyLinks() == null) content.setVocabularyLinks(list(content.getParagraphs()).isEmpty() ? List.of() : vocabulary.detectLinks(content));
        }
        vocabulary.validateLinks(content);
        return content;
    }
    @Transactional public StudyMaterialManagementResponse create(SaveStudyMaterialRequest request) {
        var content = prepare(request.content());
        var resource = resourceService.createResourceWithContent(new CreateLearningResourceRequest(LearningResourceType.STUDY_MATERIAL, content, false, true, null, null, request.tags()));
        return managementDetail(resource.getId());
    }
    @Transactional public StudyMaterialManagementResponse update(String id, SaveStudyMaterialRequest request) {
        var resource = lock(id); var content = prepare(request.content());
        if (resource.getDraftVersionId() == null) resourceService.createDraftVersion(id, content);
        else resourceService.updateDraftVersion(id, resource.getDraftVersionId(), content);
        if (request.tags() != null) resourceService.updateClassification(id, null, request.tags());
        return managementDetail(id);
    }
    @Transactional public StudyMaterialManagementResponse publish(String id, String versionId) {
        var resource = lock(id);
        require(versionId != null && versionId.equals(resource.getDraftVersionId()), "Chỉ xuất bản bản nháp hiện hành");
        var version = resourceService.getVersion(versionId);
        require(id.equals(version.getResourceId()), "Bản nháp không thuộc học liệu");
        var content = version.getContentAs(StudyMaterialContent.class, mapper); validate(content);
        if (content.getCategory() == StudyMaterialCategory.DIGLOT && content.getVocabularyIndex() == null) {
            vocabulary.precompute(content); resourceService.updateDraftVersion(id, versionId, content);
        }
        vocabulary.validateLinks(content);
        resourceService.publishVersion(id, versionId); return managementDetail(id);
    }
    @Transactional public void delete(String id) { lock(id); resourceService.deleteResource(id); }
    @Transactional public StudyMaterialPersonalResponse saveState(String user, String id, UpdateStudyMaterialStateRequest request) {
        user(user); var item = published(lock(id));
        require(request.note() == null || request.note().length() <= 300, "Ghi chú tối đa 300 ký tự");
        var state = stateService.updateVocabularyState(user, id, request.saved(), request.note(), null);
        var row = progress.findByUserIdAndResourceIdAndDeletedFalse(user, id).filter(value -> value.getVersionId().equals(item.version().getId())).orElse(null);
        return new StudyMaterialPersonalResponse(state.isSaved(), Objects.toString(state.getNote(), ""), row == null ? null : position(row));
    }
    private StudyMaterialProgress progress(String user, Published item) {
        var row = progress.findByUserIdAndResourceIdAndDeletedFalse(user, item.resource().getId()).orElseGet(() -> {
            var value = new StudyMaterialProgress(); value.setUserId(user); value.setResourceId(item.resource().getId()); return value;
        });
        if (!item.version().getId().equals(row.getVersionId())) {
            row.setVersionId(item.version().getId()); row.setPosition(0); row.setPercent(0); row.setCompleted(false);
            row.setLastScore(null); row.setBestScore(null); row.setQuizAttempts(0);
        }
        row.setLastOpenedAt(Instant.now()); return row;
    }
    @Transactional public StudyMaterialProgressResponse open(String user, String id) {
        user(user); var row = progress(user, published(lock(id))); return position(progress.save(row));
    }
    @Transactional public StudyMaterialProgressResponse saveProgress(String user, String id, UpdateStudyMaterialProgressRequest request) {
        user(user); var item = published(lock(id)); requireVersion(item, request.versionId());
        require(request.position() != null && Double.isFinite(request.position()) && request.position() >= 0, "Vị trí học không hợp lệ");
        double total = switch (item.content().getCategory()) {
            case DOCUMENT -> item.content().getPageCount();
            case VIDEO -> item.content().getDurationSeconds();
            default -> list(item.content().getParagraphs()).size();
        };
        require(request.position() <= total, "Vị trí vượt quá nội dung bài học");
        if (item.content().getCategory() != StudyMaterialCategory.VIDEO) require(request.position() == Math.floor(request.position()), "Trang/đoạn phải là số nguyên");
        require(!request.completed() || request.position() >= total, "Chưa tới cuối nội dung để hoàn thành");
        var row = progress(user, item); row.setPosition(request.position());
        row.setPercent(Math.max(row.getPercent(), request.completed() ? 100 : Math.min(99, (int) Math.floor(request.position() / Math.max(1, total) * 100))));
        row.setCompleted(row.isCompleted() || request.completed()); return position(progress.save(row));
    }
    @Transactional public StudyMaterialRecallResponse recall(String user, String id, SubmitStudyMaterialRecallRequest request) {
        user(user); var item = published(lock(id)); requireVersion(item, request.versionId());
        require(item.content().getCategory() == StudyMaterialCategory.BILINGUAL || item.content().getCategory() == StudyMaterialCategory.DIGLOT, "Chỉ bài đọc có kiểm tra từ vựng");
        var words = vocabulary.forReader(user, item.content()).words();
        var expectedIds = words.stream().map(StudyMaterialWordResponse::resourceId).collect(Collectors.toSet());
        require(!expectedIds.isEmpty() && request.answers() != null && request.answers().keySet().equals(expectedIds), "Cần trả lời đúng danh sách từ của bài");
        var answers = new ArrayList<StudyMaterialRecallAnswerResponse>();
        for (var word : words) {
            String answer = request.answers().get(word.resourceId()); require(answer != null && answer.length() <= 2000, "Câu trả lời không hợp lệ");
            var clean = VocabularyEnContent.builder().definitions(list(word.content().getDefinitions()).stream().filter(Objects::nonNull).map(definition -> VocabularyEnContent.VocabularyDefinitionItem.builder().meaningVi(plain(definition.getMeaningVi())).definitionEn(plain(definition.getDefinitionEn())).build()).toList()).build();
            if (clean.getDefinitions().isEmpty() && word.content().getCommonMeaning() != null) clean.setDefinitions(List.of(VocabularyEnContent.VocabularyDefinitionItem.builder().meaningVi(plain(word.content().getCommonMeaning())).build()));
            boolean correct = DictionaryService.matchesMeaning(clean, answer);
            var first = list(clean.getDefinitions()).isEmpty() ? null : clean.getDefinitions().getFirst();
            String expected = first == null ? "" : first.getMeaningVi() == null || first.getMeaningVi().isBlank() ? first.getDefinitionEn() : first.getMeaningVi();
            answers.add(new StudyMaterialRecallAnswerResponse(word.resourceId(), word.content().getWord(), correct, answer, expected));
        }
        int correct = (int) answers.stream().filter(StudyMaterialRecallAnswerResponse::correct).count(); int score = (int) Math.round(correct * 100.0 / words.size());
        var row = progress(user, item); row.setLastScore(score); row.setBestScore(Math.max(score, row.getBestScore() == null ? 0 : row.getBestScore())); row.setQuizAttempts(row.getQuizAttempts() + 1); progress.save(row);
        return new StudyMaterialRecallResponse(score, correct, words.size(), answers, position(row));
    }
    private static void requireVersion(Published item, String version) {
        if (!item.version().getId().equals(version)) throw new ApiException(ErrorCode.CONFLICT, "Học liệu đã cập nhật. Tải lại bài trước khi lưu tiến độ hoặc kiểm tra.");
    }
    private static StudyMaterialProgressResponse position(StudyMaterialProgress value) {
        return new StudyMaterialProgressResponse(value.getVersionId(), value.getPosition(), value.getPercent(), value.isCompleted(), value.getLastOpenedAt(), value.getLastScore(), value.getBestScore(), value.getQuizAttempts());
    }
    private static String plain(String value) { return value == null ? null : HtmlUtils.htmlUnescape(value.replaceAll("<[^>]*>", " ")).replaceAll("\\s+", " ").strip(); }
}
