package pl.co.lms.service;

import base.co.common.dto.PageResponse;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.repository.DictionaryRoadmapWord;
import pl.co.lms.dto.request.BulkCreateLearningResourcesRequest;
import pl.co.lms.dto.request.CreateLearningResourceRequest;
import pl.co.lms.dto.response.BulkCreateLearningResourcesResponse;
import pl.co.lms.dto.response.DictionaryDistractorResponse;
import pl.co.lms.dto.response.DictionaryCatalogLessonResponse;
import pl.co.lms.dto.response.DictionaryLessonsPageResponse;
import pl.co.lms.dto.response.DictionarySummaryCountsResponse;
import pl.co.lms.dto.response.LearningResourceResponse;
import pl.co.lms.entity.GrammarExampleType;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.entity.LearningResourceVersionStatus;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.json.GrammarEnContent;
import pl.co.lms.entity.json.GrammarZhContent;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;
import pl.co.lms.entity.json.SlideMaterialContent;
import pl.co.lms.entity.json.VocabularyEnContent;
import pl.co.lms.entity.json.VocabularyZhContent;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.entity.json.AudioPracticeContent;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceVersionRepository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class LearningResourceService {

    private final LearningResourceRepository resourceRepository;
    private final LearningResourceVersionRepository versionRepository;
    private final ContentPackageVersionResourceRepository packageLinkRepository;
    @Getter
    private final ObjectMapper objectMapper;

    public LearningResource createResource(LearningResourceType type) {
        if (type == null) {
            throw new ApiException(ErrorCode.E200, "LearningResource type is required");
        }
        LearningResource resource = LearningResource.builder()
                .type(type)
                .build();
        applySearchColumns(resource); // cột tìm kiếm có giá trị ngay từ lần INSERT đầu tiên
        return resourceRepository.save(resource);
    }


    public LearningResource createResourceWithContent(CreateLearningResourceRequest req) {
        LearningResource resource = createResource(req.type());
        // Tag dùng chung cho mọi loại resource; loại phụ (subType) chỉ có ở type có tập giá trị riêng (ResourceSubTypes.ALLOWED).
        String subType = ResourceSubTypes.validate(req.type(), req.subType());
        if (req.type() == LearningResourceType.ASSESSMENT && subType == null) subType = ResourceSubTypes.QUIZ;
        if ((req.type() == LearningResourceType.VOCABULARY || req.type() == LearningResourceType.GRAMMAR) && subType == null && req.content() != null) {
            subType = ResourceSubTypes.infer(req.type(), objectMapper.valueToTree(req.content()));
        }
        resource.setSubType(subType);
        resource.setSkill(normalizeSkill(req.skill()));
        applyTags(resource, req.tags());
        // Bản sao riêng của học phần thừa hưởng nhãn và tag của bài gốc trong Kho khi người tạo không chỉ định.
        if (!Boolean.TRUE.equals(req.inLibrary()) && req.sourceResourceId() != null && !req.sourceResourceId().isBlank()) {
            LearningResource source = resourceRepository.findByIdAndDeletedFalse(req.sourceResourceId()).orElse(null);
            if (source != null) {
                if (req.subType() == null && ResourceSubTypes.ALLOWED.containsKey(req.type())) {
                    resource.setSubType(source.getSubType() != null ? source.getSubType()
                            : req.type() == LearningResourceType.ASSESSMENT ? ResourceSubTypes.QUIZ : null);
                }
                if (req.skill() == null) {
                    resource.setSkill(source.getSkill());
                }
                if (req.tags() == null) {
                    resource.getTags().clear();
                    resource.getTags().addAll(source.getTags());
                }
            }
        }
        resource = refreshSearchColumns(resource);
        if (Boolean.TRUE.equals(req.inLibrary())) {
            resource.setInLibrary(true);
            resource = refreshSearchColumns(resource);
        }
        if (!Boolean.TRUE.equals(req.inLibrary()) && req.sourceResourceId() != null && !req.sourceResourceId().isBlank()) {
            resource.setSourceResourceId(req.sourceResourceId());
            resource = refreshSearchColumns(resource);
        }
        if (req.content() != null) {
            LearningResourceVersion version = createDraftVersion(resource.getId(), req.content());
            if (Boolean.TRUE.equals(req.publishImmediately())) {
                publishVersion(resource.getId(), version.getId());
            }
        } else {
            refreshSearchColumns(resource); // chưa có nội dung nhưng tag đã có
        }
        return resource;
    }

    private static final int MAX_BULK_ITEMS = 500;

    /**
     * Tạo nhiều tài nguyên cùng loại vào Kho (nhập từ Excel). Mỗi mục được kiểm tra hợp lệ TRƯỚC khi ghi nên mục lỗi không để lại
     * tài nguyên dở dang và không ảnh hưởng mục khác; kết quả trả theo từng mục.
     * <p>Từ vựng đã có trong Kho (cùng từ, không phân biệt hoa thường và khoảng trắng thừa): SKIP bỏ qua, OVERWRITE ghi đè bằng một
     * phiên bản mới của tài nguyên đó (giữ lịch sử phiên bản; tag chỉ đổi khi mục có tag), CREATE luôn tạo mới. Từ lặp lại trong chính
     * danh sách luôn bị bỏ qua ở lần xuất hiện sau (trừ CREATE).
     */
    public BulkCreateLearningResourcesResponse bulkCreateLibraryResources(BulkCreateLearningResourcesRequest req) {
        List<BulkCreateLearningResourcesRequest.Item> items = req.items();
        if (items == null || items.isEmpty()) {
            throw new ApiException(ErrorCode.E200, "Danh sách rỗng");
        }
        if (items.size() > MAX_BULK_ITEMS) {
            throw new ApiException(ErrorCode.E200, "Tối đa " + MAX_BULK_ITEMS + " mục mỗi lần");
        }
        boolean publish = !Boolean.FALSE.equals(req.publishImmediately());
        var policy = req.existing() == null ? BulkCreateLearningResourcesRequest.ExistingPolicy.SKIP : req.existing();
        boolean checkWords = policy != BulkCreateLearningResourcesRequest.ExistingPolicy.CREATE && req.type() == LearningResourceType.VOCABULARY;
        Map<String, String> existing = new HashMap<>();
        if (checkWords) {
            Set<String> words = new HashSet<>();
            for (var item : items) {
                if (item == null || item.content() == null) continue;
                try {
                    String key = normalizeWord(vocabularyWordOf(item.content()));
                    if (key != null) words.add(key);
                } catch (IllegalArgumentException ignored) {
                    // Nội dung lỗi được báo theo từng mục trong vòng lặp lưu.
                }
            }
            existing.putAll(existingLibraryWords(words));
        }

        Set<String> seen = new HashSet<>();
        List<BulkCreateLearningResourcesResponse.Result> results = new ArrayList<>();
        int created = 0, overwritten = 0, skipped = 0, failed = 0;
        for (int i = 0; i < items.size(); i++) {
            var item = items.get(i);
            try {
                if (item == null) throw new ApiException(ErrorCode.E200, "Mục rỗng");
                validateContent(req.type(), null, item.content());
                checkTags(item.tags());
                normalizeSkill(item.skill()); // kiểm trước khi ghi: createResourceWithContent lưu học liệu trước khi đọc skill
                String key = checkWords ? normalizeWord(vocabularyWordOf(item.content())) : null;
                if (key != null && !seen.add(key)) {
                    results.add(new BulkCreateLearningResourcesResponse.Result(i, BulkCreateLearningResourcesResponse.Status.SKIPPED, null, "Từ bị lặp trong danh sách"));
                    skipped++;
                    continue;
                }
                String existingId = key == null ? null : existing.get(key);
                if (existingId != null) {
                    if (policy == BulkCreateLearningResourcesRequest.ExistingPolicy.SKIP) {
                        results.add(new BulkCreateLearningResourcesResponse.Result(i, BulkCreateLearningResourcesResponse.Status.SKIPPED, null, "Từ đã có trong Kho"));
                        skipped++;
                        continue;
                    }
                    LearningResourceVersion version = createDraftVersion(existingId, item.content());
                    if (publish) publishVersion(existingId, version.getId());
                    if (item.tags() != null && !item.tags().isEmpty()) updateClassification(existingId, null, item.tags());
                    results.add(new BulkCreateLearningResourcesResponse.Result(i, BulkCreateLearningResourcesResponse.Status.OVERWRITTEN, existingId, null));
                    overwritten++;
                    continue;
                }
                LearningResource resource = createResourceWithContent(new CreateLearningResourceRequest(
                        req.type(), item.content(), publish, true, null, null, item.tags(), item.skill()));
                results.add(new BulkCreateLearningResourcesResponse.Result(i, BulkCreateLearningResourcesResponse.Status.CREATED, resource.getId(), null));
                created++;
            } catch (RuntimeException e) {
                results.add(new BulkCreateLearningResourcesResponse.Result(i, BulkCreateLearningResourcesResponse.Status.FAILED, null,
                        e.getMessage() != null ? e.getMessage() : "Không lưu được mục này"));
                failed++;
            }
        }
        return new BulkCreateLearningResourcesResponse(created, overwritten, skipped, failed, results);
    }

    /**
     * Các từ (đã chuẩn hoá bằng {@link #normalizeWord}) đang có trong Kho từ vựng → id tài nguyên. Dùng để báo trước từ nào sẽ bị ghi đè.
     * Truy vấn dùng cú pháp JSON của PostgreSQL.
     */
    @Transactional(readOnly = true)
    public Map<String, String> existingLibraryWords(java.util.Collection<String> words) {
        Set<String> keys = new HashSet<>();
        for (String word : words) {
            String key = normalizeWord(word);
            if (key != null) keys.add(key);
        }
        if (keys.isEmpty()) return Map.of();
        Map<String, String> found = new java.util.HashMap<>();
        for (Object[] row : resourceRepository.findLibraryResourceIdsByWord(keys)) {
            found.put(String.valueOf(row[0]), String.valueOf(row[1]));
        }
        return found;
    }

    /** Khoá so sánh của một từ: bỏ khoảng trắng đầu/cuối, gộp khoảng trắng giữa, chữ thường; null nếu trống. */
    static String normalizeWord(String word) {
        return ResourceSearchColumns.wordKey(word);
    }

    /** Chữ của một nội dung từ vựng, đọc theo tên trường khi chưa biết loại phụ (EN và ZH tự khai báo riêng, không có lớp chung). */
    private String vocabularyWordOf(Object content) {
        return objectMapper.valueToTree(content).path("word").asText(null);
    }

    /** Loại phụ của từ vựng: giá trị đã lưu, không có (dữ liệu cũ) thì suy từ nội dung. */
    private String vocabularySubTypeOf(LearningResource resource, Object content) {
        if (resource.getSubType() != null) return resource.getSubType();
        return ResourceSubTypes.inferVocabulary(objectMapper.valueToTree(content));
    }

    /** Chuyển nội dung sang class của loại phụ: {@link VocabularyEnContent} hoặc {@link VocabularyZhContent} (đọc khoan dung: trường lạ như language cũ bị bỏ qua). */
    private Object vocabularyContentOf(String subType, Object content) {
        Class<?> cls = LearningResourceType.VOCABULARY.contentClassOf(subType);
        return cls.isInstance(content) ? content : objectMapper.convertValue(content, cls);
    }

    /** Ngữ pháp: chuyển nội dung sang lớp của loại phụ (EN/ZH); dữ liệu cũ chưa có loại phụ thì suy từ nội dung rồi gán cho học liệu. */
    private Object grammarContentForVersion(LearningResource resource, Object content) {
        String subType = resource.getSubType() != null ? resource.getSubType() : ResourceSubTypes.inferGrammar(objectMapper.valueToTree(content));
        if (resource.getSubType() == null) resource.setSubType(subType);
        Class<?> cls = LearningResourceType.GRAMMAR.contentClassOf(subType);
        return cls.isInstance(content) ? content : objectMapper.convertValue(content, cls);
    }

    private Object contentForVersion(LearningResource resource, Object content) {
        if (resource.getType() == LearningResourceType.GRAMMAR) return grammarContentForVersion(resource, content);
        if (resource.getType() != LearningResourceType.VOCABULARY) return content;
        String subType = vocabularySubTypeOf(resource, content);
        if (resource.getSubType() == null) resource.setSubType(subType);
        return vocabularyContentOf(subType, content);
    }

    // Kiểm tra tag như applyTags nhưng không ghi gì, để biết trước khi tạo tài nguyên.
    private void checkTags(java.util.Collection<String> tags) {
        if (tags == null) return;
        Set<String> distinct = new HashSet<>();
        for (String tag : tags) {
            String value = cleanTag(tag);
            if (!value.isEmpty()) distinct.add(value.toLowerCase(java.util.Locale.ROOT));
        }
        if (distinct.size() > MAX_TAGS) throw new ApiException(ErrorCode.E200, "Tối đa " + MAX_TAGS + " tag cho mỗi resource");
    }

    private static final int MAX_TAGS = 20;
    private static final int MAX_TAG_LENGTH = 60;

    private static String cleanTag(String tag) {
        String value = tag == null ? "" : tag.strip().replaceAll("\\s+", " ");
        if (value.length() > MAX_TAG_LENGTH) throw new ApiException(ErrorCode.E200, "Tag tối đa " + MAX_TAG_LENGTH + " ký tự");
        return value;
    }

    // Tag: bỏ khoảng trắng thừa, tối đa 20 tag/resource; nếu tag đã tồn tại (không phân biệt hoa thường) thì dùng lại đúng cách viết đang có.
    private void applyTags(LearningResource resource, java.util.Collection<String> tags) {
        if (tags == null) return;
        java.util.Map<String, String> byLower = new java.util.LinkedHashMap<>();
        for (String tag : tags) {
            String value = cleanTag(tag);
            if (value.isEmpty()) continue;
            byLower.computeIfAbsent(value.toLowerCase(java.util.Locale.ROOT),
                    k -> resourceRepository.findCanonicalTag(value).orElse(value));
        }
        if (byLower.size() > MAX_TAGS) throw new ApiException(ErrorCode.E200, "Tối đa " + MAX_TAGS + " tag cho mỗi resource");
        resource.getTags().clear();
        resource.getTags().addAll(byLower.values());
    }

    private static final java.util.regex.Pattern SKILL_PATTERN = java.util.regex.Pattern.compile("^[A-Z][A-Z0-9_]{0,29}$");

    /** Kỹ năng: null hoặc rỗng = không có; còn lại phải là token IN HOA (chữ, số, gạch dưới), bắt đầu bằng chữ, tối đa 30 ký tự. */
    static String normalizeSkill(String skill) {
        if (skill == null || skill.isBlank()) return null;
        String value = skill.strip();
        if (!SKILL_PATTERN.matcher(value).matches()) {
            throw new ApiException(ErrorCode.E200, "Kỹ năng không hợp lệ: chỉ chữ IN HOA, số và gạch dưới, bắt đầu bằng chữ, tối đa 30 ký tự");
        }
        return value;
    }

    @Transactional
    public LearningResource updateClassification(String id, String subType, java.util.Collection<String> tags) {
        return updateClassification(id, subType, tags, null);
    }

    /**
     * Đổi loại phụ (type có tập giá trị riêng), tag (mọi loại) và kỹ năng của một resource, không tạo version mới.
     * null = giữ nguyên; riêng kỹ năng, chuỗi rỗng = xóa.
     */
    @Transactional
    public LearningResource updateClassification(String id, String subTypeRaw, java.util.Collection<String> tags, String skill) {
        LearningResource resource = getResource(id);
        String subType = ResourceSubTypes.validate(resource.getType(), subTypeRaw);
        if (subType != null) {
            // Loại của Test đầu vào do luồng Test đầu vào quản lý; đổi tay ở Kho sẽ làm đề lọt ra/vào danh mục học viên.
            if (ResourceSubTypes.isPlacement(subType) || ResourceSubTypes.isPlacement(resource.getSubType())) {
                throw new ApiException(ErrorCode.E200, "Loại của Test đầu vào chỉ được đổi trong màn quản lý Test đầu vào");
            }
            // Loại quyết định bài hiện ở danh mục nào và đọc layout theo kiểu nào; đổi sau khi đã tạo làm lệch đề và lượt làm cũ.
            if (resource.getSubType() != null && !resource.getSubType().equals(subType)) {
                throw new ApiException(ErrorCode.E200, "Không đổi được loại của bài đã tạo; hãy tạo bài mới đúng loại");
            }
            resource.setSubType(subType);
        }
        if (skill != null) resource.setSkill(normalizeSkill(skill));
        applyTags(resource, tags);
        return refreshSearchColumns(resource);
    }

    public record TagCount(String tag, long count) {}

    /** Các tag đang dùng (kèm số resource) để gợi ý khi nhập và để lọc; type null = mọi loại. */
    @Transactional(readOnly = true)
    public java.util.List<TagCount> listTags(LearningResourceType type, boolean libraryOnly) {
        return resourceRepository.countTags(type != null ? type.name() : null, libraryOnly).stream()
                .map(row -> new TagCount((String) row[0], ((Number) row[1]).longValue())).toList();
    }

    /** Đổi tên một tag trên mọi resource; nếu tên mới đã có thì hai tag được gộp. Trả số dòng tag đã đổi. */
    @Transactional
    public int renameTag(String from, String to) {
        String source = cleanTag(from);
        String target = cleanTag(to);
        if (source.isEmpty() || target.isEmpty()) throw new ApiException(ErrorCode.E200, "Tag không được để trống");
        // Gộp vào cách viết sẵn có của tag đích (nếu có) để không sinh thêm biến thể hoa/thường.
        String canonical = resourceRepository.findCanonicalTag(target).orElse(target);
        java.util.List<String> affected = resourceRepository.findResourceIdsByTag(source);
        int merged = resourceRepository.deleteTagCollisions(source, canonical);
        int renamed = merged + resourceRepository.renameTag(source, canonical);
        refreshSearchColumnsOf(affected);
        return renamed;
    }

    // Tag đổi bằng SQL hàng loạt nên cột search_tags của các resource bị ảnh hưởng phải dựng lại.
    private void refreshSearchColumnsOf(java.util.Collection<String> resourceIds) {
        for (String id : resourceIds) {
            resourceRepository.findById(id).ifPresent(this::refreshSearchColumns);
        }
    }

    /** Xoá một tag khỏi mọi resource. Trả số dòng tag đã xoá. */
    @Transactional
    public int deleteTag(String tag) {
        String value = cleanTag(tag);
        if (value.isEmpty()) throw new ApiException(ErrorCode.E200, "Tag không được để trống");
        java.util.List<String> affected = resourceRepository.findResourceIdsByTag(value);
        int deleted = resourceRepository.deleteTag(value);
        refreshSearchColumnsOf(affected);
        return deleted;
    }
    @Transactional(readOnly = true)
    public LearningResource getResource(String id) {
        return resourceRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "LearningResource not found: " + id));
    }

    @Transactional(readOnly = true)
    public LearningResourceResponse getResourceResponse(String id) {
        LearningResource r = getResource(id);
        String activeVersionId = r.getPublishedVersionId() != null
                ? r.getPublishedVersionId()
                : r.getDraftVersionId();

        LearningResourceVersion version = null;
        if (activeVersionId != null) {
            version = versionRepository.findByIdAndDeletedFalse(activeVersionId).orElse(null);
        }
        return LearningResourceResponse.from(r, version, objectMapper);
    }

    @Transactional(readOnly = true)
    public PageResponse<LearningResourceResponse> listResourceResponses(LearningResourceType type, int page, int size) {
        return listResourceResponses(type, null, null, null, page, size);
    }

    @Transactional(readOnly = true)
    public PageResponse<LearningResourceResponse> listResourceResponses(
            LearningResourceType type, String keyword, String questionType, String cefrLevel, int page, int size) {
        return listResourceResponses(type, keyword, questionType, cefrLevel, null, page, size);
    }

    private static final Map<String, String> FILE_KIND_REGEX = Map.of(
            "PDF", "\\.(pdf)$",
            "SLIDE", "\\.(pptx?|ppsx?|key|odp)$",
            "DOC", "\\.(docx?|txt|rtf|odt|md)$",
            "SHEET", "\\.(xlsx?|csv|ods)$",
            "IMAGE", "\\.(jpe?g|png|gif|webp|svg|bmp|heic)$",
            "VIDEO", "\\.(mp4|mov|avi|mkv|webm|wmv)$",
            "AUDIO", "\\.(mp3|wav|m4a|ogg|aac|flac)$");

    private static String allKnownFileRegex() {
        return FILE_KIND_REGEX.values().stream().collect(Collectors.joining("|"));
    }

    @Transactional(readOnly = true)
    public PageResponse<LearningResourceResponse> listResourceResponses(
            LearningResourceType type, String keyword, String questionType, String cefrLevel, String fileKind,
            int page, int size) {
        return listResourceResponses(type, keyword, questionType, cefrLevel, fileKind, false, page, size);
    }

    /** libraryOnly = true: chỉ tài nguyên của Kho, bỏ các bản sao riêng của học phần. */
    @Transactional(readOnly = true)
    public PageResponse<LearningResourceResponse> listResourceResponses(
            LearningResourceType type, String keyword, String questionType, String cefrLevel, String fileKind,
            boolean libraryOnly, int page, int size) {
        return listResourceResponses(type, keyword, questionType, cefrLevel, fileKind, libraryOnly, false, page, size);
    }

    /** publishedOnly = true: ẩn tài nguyên chưa có bản publish (dùng ở bước chọn để gắn vào học phần). */
    @Transactional(readOnly = true)
    public PageResponse<LearningResourceResponse> listResourceResponses(
            LearningResourceType type, String keyword, String questionType, String cefrLevel, String fileKind,
            boolean libraryOnly, boolean publishedOnly, int page, int size) {
        return listResourceResponses(type, keyword, questionType, cefrLevel, fileKind, libraryOnly, publishedOnly, null, null, page, size);
    }


    /** Escape ký tự đặc biệt của LIKE (% _ \) trong từ khoá đã chuẩn hoá. */
    static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    /** Từ khoá dưới 3 ký tự không dùng được chỉ mục trigram nên chỉ khớp đầu tiêu đề (btree). */
    static boolean isShortKeyword(String normalizedKeyword) {
        return normalizedKeyword.length() < 3;
    }
    /** subType/tag: lọc theo loại phụ (đã chuẩn hóa, tên cũ READING... được đổi sang PRACTICE_*) và tag (null = không lọc). */
    @Transactional(readOnly = true)
    public PageResponse<LearningResourceResponse> listResourceResponses(
            LearningResourceType type, String keyword, String questionType, String cefrLevel, String fileKind,
            boolean libraryOnly, boolean publishedOnly, String subTypeFilter, String tag,
            int page, int size) {
        String subType = ResourceSubTypes.normalize(subTypeFilter);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        String questionTypeFilter = questionType == null || questionType.isBlank() ? null : questionType.trim();
        // Từ khoá được chuẩn hoá (chữ thường, bỏ dấu) giống giá trị đã lưu ở các cột tìm kiếm.
        String normalizedKeyword = ResourceSearchColumns.normalize(keyword);
        boolean hasKeyword = !normalizedKeyword.isEmpty();
        Page<LearningResource> pageResult;
        String cefrFilter = cefrLevel == null || cefrLevel.isBlank() ? null : cefrLevel.trim().toUpperCase(java.util.Locale.ROOT);
        String kind = fileKind == null || fileKind.isBlank() ? null : fileKind.trim().toUpperCase();
        String fileRegex = null;
        boolean fileMatch = true;
        if ("OTHER".equals(kind)) {
            fileRegex = allKnownFileRegex();
            fileMatch = false;
        } else if (kind != null) {
            fileRegex = FILE_KIND_REGEX.get(kind);
            if (fileRegex == null) {
                throw new ApiException(ErrorCode.E200, "Loại tệp không hợp lệ: " + fileKind);
            }
        }
        String tagFilter = tag == null || tag.isBlank() ? null : tag.strip();
        if (hasKeyword || questionTypeFilter != null || cefrFilter != null || fileRegex != null || publishedOnly
                || subType != null || tagFilter != null) {
            String escaped = escapeLike(normalizedKeyword);
            String typeName = type != null ? type.name() : null;
            String assessmentName = subType;
            if (questionTypeFilter != null || fileRegex != null) {
                // Bộ lọc đọc từ JSON của phiên bản (loại câu hỏi, loại tệp): đường truy vấn riêng, từ khoá vẫn theo cột tìm kiếm.
                pageResult = resourceRepository.searchByKeyword(
                        libraryOnly, publishedOnly, typeName, questionTypeFilter, cefrFilter, fileRegex, fileMatch,
                        "%" + escaped + "%", hasKeyword, assessmentName, tagFilter, pageable);
            } else {
                pageResult = resourceRepository.searchByColumns(
                        libraryOnly, publishedOnly, typeName, assessmentName, cefrFilter, tagFilter,
                        hasKeyword, isShortKeyword(normalizedKeyword), normalizedKeyword, escaped + "%", "%" + escaped + "%", pageable);
            }
        } else if (libraryOnly) {
            pageResult = (type != null)
                    ? resourceRepository.findByTypeAndInLibraryTrueAndDeletedFalseOrderByCreatedAtDesc(type, pageable)
                    : resourceRepository.findByInLibraryTrueAndDeletedFalseOrderByCreatedAtDesc(pageable);
        } else {
            pageResult = (type != null)
                    ? resourceRepository.findByTypeAndDeletedFalseOrderByCreatedAtDesc(type, pageable)
                    : resourceRepository.findByDeletedFalseOrderByCreatedAtDesc(pageable);
        }

        List<String> activeVersionIds = pageResult.getContent().stream()
                .map(r -> r.getPublishedVersionId() != null ? r.getPublishedVersionId() : r.getDraftVersionId())
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<String, LearningResourceVersion> versionsById = activeVersionIds.isEmpty()
                ? Map.of()
                : versionRepository.findByIdInAndDeletedFalse(activeVersionIds).stream()
                        .collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));

        List<LearningResourceResponse> items = pageResult.getContent().stream().map(r -> {
            String activeVersionId = r.getPublishedVersionId() != null
                    ? r.getPublishedVersionId()
                    : r.getDraftVersionId();
            LearningResourceVersion version = activeVersionId != null ? versionsById.get(activeVersionId) : null;
            return LearningResourceResponse.from(r, version, objectMapper);
        }).toList();

        return new PageResponse<>(items, pageResult.getTotalElements(), pageResult.getTotalPages(), page, size, null);
    }

    @Transactional(readOnly = true)
    public List<LearningResourceResponse> listResourceResponses(LearningResourceType type) {
        return listResourceResponses(type, 0, 1000).getItems();
    }

    @Transactional(readOnly = true)
    public List<LearningResource> listResources(LearningResourceType type) {
        if (type != null) {
            return resourceRepository.findByTypeAndDeletedFalseOrderByCreatedAtDesc(type);
        }
        return resourceRepository.findByDeletedFalseOrderByCreatedAtDesc();
    }

    public void deleteResource(String id) {
        evictRoadmapWords();
        LearningResource resource = getResource(id);
        if (packageLinkRepository.existsByLearningResourceIdAndDeletedFalse(id)) {
            throw new ApiException(ErrorCode.E200, "Nội dung này đang nằm trong một học phần nên chưa thể xoá. Hãy gỡ khỏi học phần trước.");
        }
        resource.setDeleted(true);
        resourceRepository.save(resource);
    }

    public LearningResourceVersion createDraftVersion(String resourceId, Object contentPojo) {
        LearningResource resource = getResource(resourceId);
        validateContent(resource.getType(), resource.getSubType(), contentPojo);

        int nextVersion = versionRepository.findByResourceIdAndDeletedFalseOrderByVersionDesc(resourceId).stream()
                .findFirst()
                .map(v -> v.getVersion() + 1)
                .orElse(1);

        LearningResourceVersion version = LearningResourceVersion.builder()
                .resourceId(resourceId)
                .version(nextVersion)
                .status(LearningResourceVersionStatus.DRAFT)
                .build();

        version.setContentFrom(contentForVersion(resource, contentPojo), objectMapper);
        LearningResourceVersion saved = versionRepository.save(version);

        resource.setDraftVersionId(saved.getId());
        refreshSearchColumns(resource);
        return saved;
    }

    public LearningResourceVersion updateDraftVersion(String resourceId, String versionId, Object content) {
        LearningResource resource = getResource(resourceId);
        LearningResourceVersion version = getVersion(versionId);

        if (!version.getResourceId().equals(resourceId)) {
            throw new ApiException(ErrorCode.E200, "Version does not belong to the specified resource");
        }
        if (!versionId.equals(resource.getDraftVersionId())) {
            throw new ApiException(ErrorCode.E220, "Chỉ có thể sửa phiên bản nháp hiện hành");
        }

        validateContent(resource.getType(), resource.getSubType(), content);
        version.setContentFrom(contentForVersion(resource, content), objectMapper);
        LearningResourceVersion saved = versionRepository.save(version);
        // Bản nháp chỉ là phiên bản đang hiển thị khi chưa có bản xuất bản; refresh tự chọn đúng phiên bản.
        refreshSearchColumns(resource);
        return saved;
    }

    public LearningResourceVersion publishVersion(String resourceId, String versionId) {
        evictRoadmapWords();
        LearningResource resource = getResource(resourceId);
        LearningResourceVersion version = getVersion(versionId);

        if (!version.getResourceId().equals(resourceId)) {
            throw new ApiException(ErrorCode.E200, "Version does not belong to the specified resource");
        }

        version.setStatus(LearningResourceVersionStatus.PUBLISHED);
        versionRepository.save(version);

        resource.setPublishedVersionId(version.getId());
        if (version.getId().equals(resource.getDraftVersionId())) {
            resource.setDraftVersionId(null);
        }
        refreshSearchColumns(resource);
        return version;
    }

    /**
     * Dựng lại các cột tìm kiếm của resource từ phiên bản đang hiển thị (đã xuất bản, chưa có thì bản nháp) và tag rồi lưu.
     * Mọi đường làm đổi nội dung hoặc tag phải gọi hàm này (xem ResourceSearchColumns).
     */
    public LearningResource refreshSearchColumns(LearningResource resource) {
        applySearchColumns(resource);
        return resourceRepository.save(resource);
    }

    /**
     * Đặt lại con trỏ bản nháp của resource: dùng khi một luồng tự xuất bản (VD làm mới học liệu theo bộ từ mới) phải trả lại bản nháp
     * tác giả đang soạn sau khi xuất bản.
     */
    public LearningResource restoreDraftVersion(String resourceId, String draftVersionId) {
        LearningResource resource = getResource(resourceId);
        resource.setDraftVersionId(draftVersionId);
        return refreshSearchColumns(resource);
    }

    /**
     * Tính các cột tìm kiếm từ trạng thái hiện tại (phiên bản đang hiển thị + tag) và gán vào entity, chưa lưu. Với resource mới chưa có
     * phiên bản nào thì chỉ có tag. Đây là NƠI DUY NHẤT gán các cột này.
     */
    private void applySearchColumns(LearningResource resource) {
        String activeVersionId = resource.getPublishedVersionId() != null ? resource.getPublishedVersionId() : resource.getDraftVersionId();
        String json = activeVersionId == null ? null
                : versionRepository.findByIdAndDeletedFalse(activeVersionId).map(LearningResourceVersion::getContent).orElse(null);
        ResourceSearchColumns.Values values = ResourceSearchColumns.build(resource.getType(), resource.getSubType(), json, resource.getTags(), objectMapper);
        resource.setSearchTitle(values.title());
        resource.setSearchText(values.text());
        resource.setSearchTags(values.tags());
        resource.setWordKey(values.wordKey());
        resource.setCefrLevel(values.cefrLevel());
        resource.setTopic(values.topic());
        if (resource.getType() == LearningResourceType.GRAMMAR && resource.getSubType() == null && json != null) {
            try {
                resource.setSubType(ResourceSubTypes.inferGrammar(objectMapper.readTree(json)));
            } catch (com.fasterxml.jackson.core.JsonProcessingException ignored) {
                // Nội dung JSON cũ bị lỗi: để trống loại phụ.
            }
        }
        if (resource.getType() == LearningResourceType.VOCABULARY && json != null) {
            try {
                var tree = objectMapper.readTree(json);
                // Loại phụ do người tạo đặt; chỉ khi chưa có (dữ liệu cũ) mới suy từ nội dung.
                if (resource.getSubType() == null) {
                    resource.setSubType(ResourceSubTypes.inferVocabulary(tree));
                }
                var metadata = ResourceSearchColumns.vocabularyMetadata(resource.getSubType(), tree);
                resource.setVocabularyFacets(metadata.facets());
            } catch (com.fasterxml.jackson.core.JsonProcessingException ignored) {
                // Nội dung JSON cũ bị lỗi đã được bỏ qua khi tạo chỉ mục.
            }
        }
        if (resource.getType() == LearningResourceType.STUDY_MATERIAL && json != null) {
            try {
                var content = objectMapper.readValue(json, pl.co.lms.entity.json.StudyMaterialContent.class);
                resource.setStudyCategory(content.getCategory() == null ? null : content.getCategory().path());
                resource.setStudySource(content.getSource());
                resource.setStudyBand(content.getBand());
                resource.setStudyTier(content.getTier());
                resource.setStudySkill(content.getSkill());
                resource.setStudyPart(content.getPart());
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                throw new ApiException(ErrorCode.E200, "Nội dung học liệu không hợp lệ");
            }
        }
    }



    @Transactional(readOnly = true)
    public LearningResourceVersion getVersion(String versionId) {
        return versionRepository.findByIdAndDeletedFalse(versionId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "LearningResourceVersion not found: " + versionId));
    }

    @Transactional(readOnly = true)
    public List<LearningResourceVersion> listVersions(String resourceId) {
        getResource(resourceId);
        return versionRepository.findByResourceIdAndDeletedFalseOrderByVersionDesc(resourceId);
    }

    @Transactional(readOnly = true)
    public LearningResourceResponse getDictionaryWord(String id) {
        LearningResource resource = resourceRepository.findByIdAndDeletedFalse(id)
                .filter(r -> r.getType() == LearningResourceType.VOCABULARY && r.isInLibrary() && r.getPublishedVersionId() != null)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Từ không có trong kho từ điển đã xuất bản"));
        LearningResourceVersion version = versionRepository.findByIdAndDeletedFalse(resource.getPublishedVersionId())
                .filter(v -> resource.getId().equals(v.getResourceId()) && v.getStatus() == LearningResourceVersionStatus.PUBLISHED)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Từ không có trong kho từ điển đã xuất bản"));
        LearningResourceResponse response = LearningResourceResponse.from(resource, version, objectMapper);
        Object content = response.content();
        String word = content instanceof VocabularyEnContent en ? en.getWord() : content instanceof VocabularyZhContent zh ? zh.getWord() : null;
        if (word == null || word.isBlank())
            throw new ApiException(ErrorCode.E227, "Từ chưa có nội dung");
        return response;
    }

    /** Published dictionary words (id, version, topic, level, title) in /dictionary order, for lesson prerequisites. Read from the search columns only. */
    @Transactional(readOnly = true)
    public List<DictionaryRoadmapWord> dictionaryRoadmapWords() {
        // Every lesson step (save, access check, roadmap) calls this, so keep the rows (about 100 bytes a word) for a short time.
        // shortcut: a word published or edited by other means shows up in lessons up to ROADMAP_WORDS_TTL_NANOS later, per instance.
        var cached=roadmapWords;
        if (cached != null && System.nanoTime()-cached.loadedAt() < ROADMAP_WORDS_TTL_NANOS) return cached.words();
        var words=resourceRepository.findDictionaryRoadmapWords();
        roadmapWords=new RoadmapWords(System.nanoTime(),words);
        return words;
    }
    private static final long ROADMAP_WORDS_TTL_NANOS = java.util.concurrent.TimeUnit.SECONDS.toNanos(30);
    private record RoadmapWords(long loadedAt, List<DictionaryRoadmapWord> words) {}
    private volatile RoadmapWords roadmapWords;
    void evictRoadmapWords() { roadmapWords=null; }

    /**
     * Từ điển: tìm từ vựng đã xuất bản của Kho ở DB (cột tìm kiếm chuẩn hoá bỏ dấu: từ, nghĩa, collocation, tag), lọc cấp độ/chủ đề,
     * phân trang; không nạp toàn bộ từ vào bộ nhớ. topic/cefrLevel "Chưa phân loại" khớp các từ chưa có giá trị.
     */
    @Transactional(readOnly = true)
    public PageResponse<LearningResourceResponse> searchVocabulary(
            String keyword, String topic, String cefrLevel, int page, int size) {
        return searchVocabulary(keyword, topic, cefrLevel, null, null, page, size);
    }

    /**
     * Như trên, lọc thêm theo trạng thái học của người dùng: "known" (đã nhớ), "learning" (đang học), "unknown" (chưa biết).
     * Giá trị khác hoặc không có người dùng thì không lọc theo trạng thái.
     */
    @Transactional(readOnly = true)
    public PageResponse<LearningResourceResponse> searchVocabulary(
            String keyword, String topic, String cefrLevel, String status, String userId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(200, Math.max(1, size));
        if ((long) safePage * safeSize > Integer.MAX_VALUE) {
            // Vượt xa mọi trang có thật (Spring Data không nhận offset lớn hơn int): trả trang rỗng.
            return new PageResponse<>(List.of(), 0, 0, safePage, safeSize, null);
        }
        String normalized = ResourceSearchColumns.normalize(keyword);
        boolean hasKeyword = !normalized.isEmpty();
        String escaped = escapeLike(normalized);

        String topicValue = topic == null ? "" : topic.strip();
        String cefrValue = cefrLevel == null ? "" : cefrLevel.strip();
        int topicMode = topicValue.isEmpty() ? 0 : UNCLASSIFIED.equalsIgnoreCase(topicValue) ? 1 : 2;
        int cefrMode = cefrValue.isEmpty() ? 0 : UNCLASSIFIED.equalsIgnoreCase(cefrValue) ? 1 : 2;

        String statusValue = status == null ? "" : status.strip().toLowerCase(java.util.Locale.ROOT);
        boolean hasUser = userId != null && !userId.isBlank();
        int statusMode = !hasUser ? 0 : switch (statusValue) { case "known" -> 1; case "learning" -> 2; case "unknown" -> 3; default -> 0; };
        Page<LearningResource> result = resourceRepository.searchDictionary(
                cefrMode, cefrMode == 2 ? cefrValue.toUpperCase(java.util.Locale.ROOT) : "",
                topicMode, topicMode == 2 ? topicValue.toLowerCase(java.util.Locale.ROOT) : "",
                statusMode, hasUser ? userId : "",
                hasKeyword, isShortKeyword(normalized), normalized, escaped + "%", "%" + escaped + "%",
                PageRequest.of(safePage, safeSize));

        List<String> versionIds = result.getContent().stream().map(LearningResource::getPublishedVersionId).filter(Objects::nonNull).toList();
        Map<String, LearningResourceVersion> versions = versionIds.isEmpty() ? Map.of()
                : versionRepository.findByIdInAndDeletedFalse(versionIds).stream().collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));
        List<LearningResourceResponse> items = new ArrayList<>();
        for (LearningResource r : result.getContent()) {
            LearningResourceVersion v = versions.get(r.getPublishedVersionId());
            if (v == null || v.getContent() == null) continue;
            items.add(LearningResourceResponse.from(r, v, objectMapper));
        }
        return new PageResponse<>(items, result.getTotalElements(), result.getTotalPages(), safePage, safeSize, null);
    }

    /**
     * Thống kê số lượng từ vựng đã xuất bản của Kho trong một phạm vi (cấp độ/chủ đề, bỏ trống = cả Kho): tổng số, theo cấp độ CEFR
     * và theo chủ đề. Nhóm trống gọi là "Chưa phân loại" (cùng chuỗi bộ lọc /dictionary hiểu).
     */
    @Transactional(readOnly = true)
    public DictionarySummaryCountsResponse getDictionarySummaryCounts(String cefrLevel, String topic) {
        DictionaryScope scope = DictionaryScope.of(cefrLevel, topic);
        Map<String, Long> byLevel = new java.util.LinkedHashMap<>();
        long total = 0;
        for (Object[] row : resourceRepository.countPublishedVocabularyByLevel(scope.cefrMode(), scope.cefr(), scope.topicMode(), scope.topicLower())) {
            if (row != null && row.length >= 2 && row[0] != null && row[1] instanceof Number n) {
                byLevel.put(String.valueOf(row[0]), n.longValue());
                total += n.longValue();
            }
        }
        Map<String, Long> byTopic = new java.util.LinkedHashMap<>();
        for (Object[] row : resourceRepository.countPublishedVocabularyByTopic(scope.cefrMode(), scope.cefr(), scope.topicMode(), scope.topicLower())) {
            if (row != null && row.length >= 2 && row[0] != null && row[1] instanceof Number n) {
                byTopic.put(String.valueOf(row[0]), n.longValue());
            }
        }
        return new DictionarySummaryCountsResponse(total, byLevel, byTopic);
    }

    static final int LESSON_SIZE = 5;

    /**
     * Danh sách bài học từ vựng trong một phạm vi, phân trang theo bài. Mỗi chủ đề (theo thứ tự tên) chia riêng thành các bài 5 từ
     * liên tiếp theo chữ cái; id bài = id từ đầu tiên. Chỉ đọc phần từ của trang được hỏi nên chạy ổn khi Kho lớn.
     */
    @Transactional(readOnly = true)
    public DictionaryLessonsPageResponse getDictionaryLessons(String cefrLevel, String topic, int page, int size) {
        DictionaryScope scope = DictionaryScope.of(cefrLevel, topic);
        int safePage = Math.max(0, page);
        int safeSize = Math.min(50, Math.max(1, size));
        List<Object[]> buckets = resourceRepository.countScopeByTopic(scope.cefrMode(), scope.cefr(), scope.topicMode(), scope.topicLower());
        long totalWords = 0, totalLessons = 0;
        for (Object[] bucket : buckets) {
            long n = bucketCount(bucket);
            totalWords += n;
            totalLessons += (n + LESSON_SIZE - 1) / LESSON_SIZE;
        }
        long from = (long) safePage * safeSize, to = from + safeSize;
        List<DictionaryCatalogLessonResponse> lessons = new ArrayList<>();
        long cursor = 0;
        for (Object[] bucket : buckets) {
            long n = bucketCount(bucket);
            long chunks = (n + LESSON_SIZE - 1) / LESSON_SIZE;
            long bucketStart = cursor, bucketEnd = cursor + chunks;
            cursor = bucketEnd;
            if (bucketEnd <= from) continue;
            if (bucketStart >= to) break;
            long first = Math.max(from, bucketStart) - bucketStart;
            long last = Math.min(to, bucketEnd) - bucketStart;
            String bucketTopic = bucketName(bucket);
            DictionaryScope inBucket = scope.withTopicBucket(bucketTopic);
            List<LearningResourceResponse> words = toResponses(resourceRepository.findScopeWords(
                    inBucket.cefrMode(), inBucket.cefr(), inBucket.topicMode(), inBucket.topicLower(),
                    (int) (first * LESSON_SIZE), (int) ((last - first) * LESSON_SIZE)));
            for (int i = 0; i * LESSON_SIZE < words.size(); i++) {
                List<LearningResourceResponse> part = words.subList(i * LESSON_SIZE, Math.min(words.size(), (i + 1) * LESSON_SIZE));
                lessons.add(new DictionaryCatalogLessonResponse(part.get(0).id(), (int) (bucketStart + first + i + 1), bucketTopic, List.copyOf(part)));
            }
        }
        return new DictionaryLessonsPageResponse(lessons, totalLessons, totalWords, safePage, safeSize);
    }

    /**
     * Bài học chứa một từ (cùng cách chia như getDictionaryLessons). Từ phải nằm trong phạm vi cấp độ/chủ đề; id bài trả về là từ đầu
     * của bài, có thể khác id từ được hỏi.
     */
    @Transactional(readOnly = true)
    public DictionaryCatalogLessonResponse getDictionaryLessonContaining(String wordId, String cefrLevel, String topic) {
        LearningResource word = resourceRepository.findPublishedVocabularyByIds(List.of(wordId)).stream().findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Từ không có trong kho từ điển đã xuất bản"));
        DictionaryScope scope = DictionaryScope.of(cefrLevel, topic);
        if (!scope.contains(word.getCefrLevel(), word.getTopic())) {
            throw new ApiException(ErrorCode.E227, "Từ không thuộc bộ từ này");
        }
        String bucketTopic = word.getTopic() == null ? "" : word.getTopic().strip();
        DictionaryScope inBucket = scope.withTopicBucket(bucketTopic);
        long rank = resourceRepository.countScopeWordsBefore(inBucket.cefrMode(), inBucket.cefr(), inBucket.topicMode(), inBucket.topicLower(),
                word.getSearchTitle() == null ? "" : word.getSearchTitle(), word.getId());
        long chunkStart = rank - rank % LESSON_SIZE;
        List<LearningResourceResponse> words = toResponses(resourceRepository.findScopeWords(
                inBucket.cefrMode(), inBucket.cefr(), inBucket.topicMode(), inBucket.topicLower(), (int) chunkStart, LESSON_SIZE));
        if (words.isEmpty()) throw new ApiException(ErrorCode.E227, "Không tìm thấy bài học chứa từ này");
        long before = 0;
        for (Object[] bucket : resourceRepository.countScopeByTopic(scope.cefrMode(), scope.cefr(), scope.topicMode(), scope.topicLower())) {
            if (bucketName(bucket).toLowerCase(java.util.Locale.ROOT).equals(bucketTopic.toLowerCase(java.util.Locale.ROOT))) break;
            before += (bucketCount(bucket) + LESSON_SIZE - 1) / LESSON_SIZE;
        }
        return new DictionaryCatalogLessonResponse(words.get(0).id(), (int) (before + chunkStart / LESSON_SIZE + 1), bucketTopic, words);
    }

    private static long bucketCount(Object[] bucket) {
        return bucket != null && bucket.length >= 2 && bucket[1] instanceof Number n ? n.longValue() : 0L;
    }

    private static String bucketName(Object[] bucket) {
        return bucket != null && bucket.length >= 1 && bucket[0] != null ? String.valueOf(bucket[0]).strip() : "";
    }

    /** Phiên bản đã xuất bản của các từ, giữ nguyên thứ tự đầu vào; từ thiếu nội dung bị bỏ. */
    private List<LearningResourceResponse> toResponses(List<LearningResource> resources) {
        List<String> versionIds = resources.stream().map(LearningResource::getPublishedVersionId).filter(Objects::nonNull).toList();
        Map<String, LearningResourceVersion> versions = versionIds.isEmpty() ? Map.of()
                : versionRepository.findByIdInAndDeletedFalse(versionIds).stream().collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));
        List<LearningResourceResponse> items = new ArrayList<>();
        for (LearningResource r : resources) {
            LearningResourceVersion v = versions.get(r.getPublishedVersionId());
            if (v == null || v.getContent() == null) continue;
            items.add(LearningResourceResponse.from(r, v, objectMapper));
        }
        return items;
    }

    /**
     * Lấy danh sách từ vựng từ điển theo danh sách ID (dùng cho Sổ tay, từ đã lưu, từ gần đây).
     */
    @Transactional(readOnly = true)
    public List<LearningResourceResponse> getDictionaryWordsByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        List<LearningResource> resources = resourceRepository.findPublishedVocabularyByIds(ids);
        List<String> versionIds = resources.stream().map(LearningResource::getPublishedVersionId).filter(Objects::nonNull).toList();
        Map<String, LearningResourceVersion> versions = versionIds.isEmpty() ? Map.of()
                : versionRepository.findByIdInAndDeletedFalse(versionIds).stream().collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));
        List<LearningResourceResponse> items = new ArrayList<>();
        for (LearningResource r : resources) {
            LearningResourceVersion v = versions.get(r.getPublishedVersionId());
            if (v == null || v.getContent() == null) continue;
            items.add(LearningResourceResponse.from(r, v, objectMapper));
        }
        return items;
    }

    /**
     * Từ điển Hán tự (HSK), màn Admin: tìm theo Hán tự/phiên âm/nghĩa, lọc cấp độ/từ đơn-ghép/từ loại/bộ thủ, gồm cả bản nháp
     * (nội dung = phiên bản đang hiển thị: đã xuất bản, không có thì nháp). Tài nguyên độc lập trong Kho (type=VOCABULARY, language=zh, inLibrary=true) —
     * khác hẳn {@link #searchVocabulary} (từ điển tiếng Anh/IELTS, type=VOCABULARY). Lọc + phân trang ở DB trên cột chuẩn hoá.
     */
    @Transactional(readOnly = true)
    public PageResponse<pl.co.lms.dto.response.DictionaryWordResponse> searchDictionaryHanzi(
            String keySearch, Integer hskLevel, Boolean isSingleVocab, String wordType, String radical, int page, int size) {
        return searchHanzi(false, keySearch, hskLevel, isSingleVocab, wordType, radical, page, size);
    }

    /** Từ điển Hán tự, màn học viên (/vocabulary): như {@link #searchDictionaryHanzi} nhưng chỉ từ ĐÃ XUẤT BẢN, nội dung bản đã xuất bản. */
    @Transactional(readOnly = true)
    public PageResponse<pl.co.lms.dto.response.DictionaryWordResponse> searchPublishedDictionaryHanzi(
            String keySearch, Integer hskLevel, Boolean isSingleVocab, String wordType, String radical, int page, int size) {
        return searchHanzi(true, keySearch, hskLevel, isSingleVocab, wordType, radical, page, size);
    }

    private PageResponse<pl.co.lms.dto.response.DictionaryWordResponse> searchHanzi(boolean publishedOnly,
            String keySearch, Integer hskLevel, Boolean isSingleVocab, String wordType, String radical, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(200, Math.max(1, size));
        String key = ResourceSearchColumns.normalize(keySearch);
        String pattern = key.isEmpty() ? "" : "%" + escapeLike(key) + "%";
        String keywordRadical = key.codePointCount(0, key.length()) == 1
                && Character.UnicodeScript.of(key.codePointAt(0)) == Character.UnicodeScript.HAN
                ? facetPattern("radical", key) : "";
        // Cột searchText của các bản ghi cũ có thể còn chứa định nghĩa và ví dụ bằng Hán tự.
        boolean pinyinSearch = key.codePoints().noneMatch(cp -> Character.UnicodeScript.of(cp) == Character.UnicodeScript.HAN);
        Page<LearningResource> result = resourceRepository.searchHanziDictionary(publishedOnly,
                facetPattern("level", Objects.toString(hskLevel, "")), facetPattern("single", Objects.toString(isSingleVocab, "")),
                facetPattern("radical", ResourceSearchColumns.radicalChar(radical)), facetPattern("wordType", wordType),
                pattern, key, pinyinSearch, keywordRadical, PageRequest.of(safePage, safeSize));
        List<pl.co.lms.dto.response.DictionaryWordResponse> items = new ArrayList<>();
        Map<String, LearningResourceVersion> versions = hanziVersions(result.getContent(), publishedOnly);
        for (LearningResource r : result.getContent()) {
            VocabularyZhContent content = hanziContent(versions.get(hanziVersionId(r, publishedOnly)));
            if (content == null) continue; // nội dung hỏng: bỏ khỏi trang thay vì làm hỏng cả trang
            items.add(pl.co.lms.dto.response.DictionaryWordResponse.from(r, content));
        }
        return new PageResponse<>(items, result.getTotalElements(), result.getTotalPages(), safePage, safeSize, null);
    }

    private static String facetPattern(String field, String value) {
        String facet = ResourceSearchColumns.vocabularyFacet(field, value);
        return facet.isEmpty() ? "" : "%" + escapeLike(facet) + "%";
    }

    /**
     * Chi tiết một từ ĐÃ XUẤT BẢN cho học viên, kèm chữ thành phần (thay quan hệ vocabulary_components của dịch vụ cũ): mỗi chữ khác nhau
     * của từ ghép được tra theo word_key trong từ điển đã xuất bản; chữ chưa có trong từ điển vẫn được trả (id null).
     */
    @Transactional(readOnly = true)
    public pl.co.lms.dto.response.DictionaryWordResponse getPublishedDictionaryHanzi(String id) {
        LearningResource resource = resourceRepository.findByIdAndDeletedFalse(id)
                .filter(r -> r.getType() == LearningResourceType.VOCABULARY && ResourceSubTypes.ZH.equals(r.getSubType()) && r.isInLibrary() && r.getPublishedVersionId() != null)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Từ không có trong từ điển đã xuất bản"));
        VocabularyZhContent content = versionRepository.findByIdAndDeletedFalse(resource.getPublishedVersionId())
                .filter(v -> resource.getId().equals(v.getResourceId()))
                .map(this::hanziContent)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Từ chưa có nội dung"));
        return pl.co.lms.dto.response.DictionaryWordResponse.from(resource, content, hanziComponents(content.getWord(), resource.getId()));
    }

    private static final int MAX_COMPONENTS = 12;

    private List<pl.co.lms.dto.response.DictionaryWordResponse.Component> hanziComponents(String hanzi, String selfId) {
        if (hanzi == null) return List.of();
        List<String> chars = hanzi.strip().codePoints()
                .filter(cp -> Character.UnicodeScript.of(cp) == Character.UnicodeScript.HAN)
                .mapToObj(Character::toString).distinct().limit(MAX_COMPONENTS).toList();
        if (chars.size() < 2) return List.of(); // từ đơn: màn hình hiện bộ thủ thay cho thành phần (như bản cũ)
        Map<String, LearningResource> byChar = new HashMap<>();
        for (LearningResource r : resourceRepository.findPublishedHanziDictionaryByWordKeys(chars)) {
            if (!r.getId().equals(selfId)) byChar.putIfAbsent(r.getWordKey(), r); // nhiều từ cùng chữ (đa âm): lấy từ đứng đầu từ điển
        }
        Map<String, LearningResourceVersion> versions = hanziVersions(byChar.values(), true);
        List<pl.co.lms.dto.response.DictionaryWordResponse.Component> components = new ArrayList<>();
        for (String ch : chars) {
            LearningResource r = byChar.get(ch);
            VocabularyZhContent c = r == null ? null : hanziContent(versions.get(r.getPublishedVersionId()));
            components.add(c == null ? new pl.co.lms.dto.response.DictionaryWordResponse.Component(null, ch, null, null)
                    : pl.co.lms.dto.response.DictionaryWordResponse.Component.from(r.getId(), ch, c));
        }
        return components;
    }

    private static String hanziVersionId(LearningResource r, boolean publishedOnly) {
        return publishedOnly || r.getPublishedVersionId() != null ? r.getPublishedVersionId() : r.getDraftVersionId();
    }

    private Map<String, LearningResourceVersion> hanziVersions(java.util.Collection<LearningResource> resources, boolean publishedOnly) {
        List<String> ids = resources.stream().map(r -> hanziVersionId(r, publishedOnly)).filter(Objects::nonNull).distinct().toList();
        return ids.isEmpty() ? Map.of() : versionRepository.findByIdInAndDeletedFalse(ids).stream()
                .collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));
    }

    private VocabularyZhContent hanziContent(LearningResourceVersion version) {
        if (version == null || version.getContent() == null) return null;
        try {
            VocabularyZhContent content = objectMapper.readValue(version.getContent(), VocabularyZhContent.class);
            return isBlank(content.getWord()) ? null : content;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static final String ID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    /**
     * Từ nhiễu (đáp án sai) cho câu hỏi SPACE: lấy một đoạn từ liên tiếp bắt đầu từ mốc id ngẫu nhiên, ưu tiên cùng chủ đề; chủ đề
     * không đủ từ thì lấy từ mọi chủ đề. Không quét cả bảng nên chạy ổn khi Kho lớn.
     */
    @Transactional(readOnly = true)
    public List<DictionaryDistractorResponse> getDistractors(String excludeWordId, String topic, int count) {
        int safeCount = Math.min(10, Math.max(1, count));
        String safeTopic = (topic == null || topic.isBlank() || UNCLASSIFIED.equalsIgnoreCase(topic.strip())) ? null : topic.strip();
        int window = safeCount * 4;
        List<LearningResource> candidates = new ArrayList<>();
        if (safeTopic != null) candidates.addAll(distractorWindow(excludeWordId, safeTopic, window));
        if (candidates.size() < safeCount) {
            candidates.clear();
            candidates.addAll(distractorWindow(excludeWordId, null, window));
        }
        java.util.Collections.shuffle(candidates);

        List<String> versionIds = candidates.stream().map(LearningResource::getPublishedVersionId).filter(Objects::nonNull).toList();
        Map<String, LearningResourceVersion> versions = versionIds.isEmpty() ? Map.of()
                : versionRepository.findByIdInAndDeletedFalse(versionIds).stream().collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));

        List<DictionaryDistractorResponse> items = new ArrayList<>();
        for (LearningResource r : candidates) {
            LearningResourceVersion v = versions.get(r.getPublishedVersionId());
            if (v == null || v.getContent() == null) continue;
            try {
                VocabularyEnContent vocab = objectMapper.readValue(v.getContent(), VocabularyEnContent.class);
                String word = vocab.getWord();
                String meaning = vocab.getCommonMeaning();
                if ((meaning == null || meaning.isBlank()) && vocab.getDefinitions() != null && !vocab.getDefinitions().isEmpty()) {
                    meaning = vocab.getDefinitions().get(0).getMeaningVi();
                    if (meaning == null || meaning.isBlank()) meaning = vocab.getDefinitions().get(0).getDefinitionEn();
                }
                if (word != null && !word.isBlank() && meaning != null && !meaning.isBlank()) {
                    items.add(new DictionaryDistractorResponse(r.getId(), word, meaning));
                    if (items.size() >= safeCount) break;
                }
            } catch (Exception ignored) {
                // Nội dung hỏng thì bỏ qua từ đó, lấy từ khác.
            }
        }
        return items;
    }

    /** Đoạn từ liên tiếp từ một mốc id ngẫu nhiên; chưa đủ thì nối thêm từ đầu bảng. */
    private List<LearningResource> distractorWindow(String excludeWordId, String topic, int window) {
        String pivot = randomIdPivot();
        List<LearningResource> rows = topic == null
                ? resourceRepository.findDistractorCandidates(excludeWordId, pivot, window)
                : resourceRepository.findDistractorCandidatesByTopic(excludeWordId, topic, pivot, window);
        if (rows.size() >= window) return rows;
        List<LearningResource> all = new ArrayList<>(rows);
        List<LearningResource> head = topic == null
                ? resourceRepository.findDistractorCandidates(excludeWordId, "", window)
                : resourceRepository.findDistractorCandidatesByTopic(excludeWordId, topic, "", window);
        Set<String> seen = all.stream().map(LearningResource::getId).collect(Collectors.toSet());
        for (LearningResource r : head) {
            if (all.size() >= window) break;
            if (seen.add(r.getId())) all.add(r);
        }
        return all;
    }

    /** Mốc ngẫu nhiên nằm giữa id nhỏ nhất và lớn nhất của Kho (id là ULID 26 ký tự, so sánh chuỗi cùng thứ tự với số). */
    private String randomIdPivot() {
        List<Object[]> range = resourceRepository.findPublishedVocabularyIdRange();
        if (range.isEmpty() || range.get(0) == null || !(range.get(0)[0] instanceof String lo) || !(range.get(0)[1] instanceof String hi)
                || lo.length() != hi.length() || lo.equals(hi)) {
            return "";
        }
        java.math.BigInteger from = decodeId(lo);
        java.math.BigInteger to = decodeId(hi);
        if (from == null || to == null || to.compareTo(from) <= 0) return "";
        java.math.BigInteger span = to.subtract(from);
        java.math.BigInteger offset = new java.math.BigInteger(span.bitLength() + 8, java.util.concurrent.ThreadLocalRandom.current()).mod(span);
        return encodeId(from.add(offset), lo.length());
    }

    private static java.math.BigInteger decodeId(String id) {
        java.math.BigInteger value = java.math.BigInteger.ZERO;
        for (int i = 0; i < id.length(); i++) {
            int digit = ID_ALPHABET.indexOf(Character.toUpperCase(id.charAt(i)));
            if (digit < 0) return null;
            value = value.shiftLeft(5).add(java.math.BigInteger.valueOf(digit));
        }
        return value;
    }

    private static String encodeId(java.math.BigInteger value, int length) {
        char[] out = new char[length];
        for (int i = length - 1; i >= 0; i--) {
            out[i] = ID_ALPHABET.charAt(value.and(java.math.BigInteger.valueOf(31)).intValue());
            value = value.shiftRight(5);
        }
        return new String(out);
    }

    private static final String UNCLASSIFIED = "Chưa phân loại";
    /** Như {@link #validateContent(LearningResourceType, String, Object)} khi chưa có học liệu (từ vựng suy loại phụ từ nội dung). */
    public void validateContent(LearningResourceType type, Object content) {
        validateContent(type, null, content);
    }

    /** subType: loại phụ của học liệu (từ vựng không có thì suy từ nội dung). */
    public void validateContent(LearningResourceType type, String subType, Object content) {
        if (content == null) {
            throw new ApiException(ErrorCode.E200, "Content cannot be null");
        }
        switch (type) {
            case GRAMMAR -> validateGrammar(subType != null ? subType : ResourceSubTypes.inferGrammar(objectMapper.valueToTree(content)), content);
            case VOCABULARY -> validateVocabulary(subType != null ? subType : ResourceSubTypes.inferVocabulary(objectMapper.valueToTree(content)), content);
            case ASSESSMENT -> {
                QuizContent quiz = (content instanceof QuizContent q)
                        ? q : objectMapper.convertValue(content, QuizContent.class);
                validateQuiz(quiz);
            }
            case SLIDE, MATERIAL -> {
                SlideMaterialContent mat = (content instanceof SlideMaterialContent s)
                        ? s : objectMapper.convertValue(content, SlideMaterialContent.class);
                validateSlideMaterial(mat);
            }
            case AUDIO_PRACTICE -> {
                AudioPracticeContent practice = (content instanceof AudioPracticeContent a)
                        ? a : objectMapper.convertValue(content, AudioPracticeContent.class);
                validateAudioPractice(practice);
            }
            case STUDY_MATERIAL -> {
                var material = content instanceof pl.co.lms.entity.json.StudyMaterialContent value
                        ? value : objectMapper.convertValue(content, pl.co.lms.entity.json.StudyMaterialContent.class);
                pl.co.lms.service.studymaterials.StudyMaterialValidation.validate(material);
            }
        }
    }

    private void validateDictionary(VocabularyZhContent dict) {
        if (dict.getPinyins() == null || dict.getPinyins().isEmpty()) {
            throw new ApiException(ErrorCode.E200, "At least one pinyin is required");
        }
        long primaryCount = dict.getPinyins().stream()
                .filter(p -> p != null && Boolean.TRUE.equals(p.getIsPrimary())).count();
        if (primaryCount != 1) {
            throw new ApiException(ErrorCode.E200, "Exactly one pinyin must be marked as primary");
        }
        for (var p : dict.getPinyins()) {
            if (p == null || isBlank(p.getPinyin())) {
                throw new ApiException(ErrorCode.E200, "Pinyin cannot be blank");
            }
            if (p.getMeanings() == null || p.getMeanings().isEmpty()) {
                throw new ApiException(ErrorCode.E200, "Each pinyin needs at least one meaning");
            }
            for (var m : p.getMeanings()) {
                if (m == null || (isBlank(m.getMeaningVi()) && isBlank(m.getMeaningEn()) && isBlank(m.getMeaningZh()))) {
                    throw new ApiException(ErrorCode.E200, "Meaning cannot be blank");
                }
                checkSize("examples", m.getExamples());
                for (var e : orEmpty(m.getExamples())) {
                    if (e == null || (isBlank(e.getZh()) && isBlank(e.getPinyin()) && isBlank(e.getVi()) && isBlank(e.getEn()))) {
                        throw new ApiException(ErrorCode.E200, "Example cannot be blank");
                    }
                }
            }
        }
    }

    private void validateGrammar(String subType, Object content) {
        checkContentKeys(LearningResourceType.GRAMMAR, subType, content);
        Class<?> cls = LearningResourceType.GRAMMAR.contentClassOf(subType);
        Object typed = cls.isInstance(content) ? content : objectMapper.convertValue(content, cls);
        if (typed instanceof GrammarZhContent zh) validateGrammarZh(zh);
        else validateGrammarEn((GrammarEnContent) typed);
    }

    private void validateGrammarEn(GrammarEnContent grammar) {
        if (isBlank(grammar.getTitle())) {
            throw new ApiException(ErrorCode.E200, "Grammar title cannot be blank");
        }
        Set<Integer> indexes = new HashSet<>();
        for (GrammarEnContent.GrammarEnExampleItem ex : orEmpty(grammar.getExamples())) {
            if (ex.getExampleIndex() != null && !indexes.add(ex.getExampleIndex())) {
                throw new ApiException(ErrorCode.E220, "Example indexes must be unique within a grammar point");
            }
            if (ex.getExampleType() == GrammarExampleType.EXAMPLE && isBlank(ex.getSentenceEn())) {
                throw new ApiException(ErrorCode.E200, "A grammar example requires an English sentence");
            }
            if (ex.getExampleType() == GrammarExampleType.COMMON_MISTAKE
                    && (isBlank(ex.getIncorrectSentence()) || isBlank(ex.getCorrectSentence()))) {
                throw new ApiException(ErrorCode.E200, "A common mistake requires both incorrect and corrected sentences");
            }
        }
    }

    private void validateGrammarZh(GrammarZhContent grammar) {
        if (isBlank(grammar.getTitle())) {
            throw new ApiException(ErrorCode.E200, "Grammar title cannot be blank");
        }
        Set<Integer> indexes = new HashSet<>();
        for (GrammarZhContent.GrammarZhExampleItem ex : orEmpty(grammar.getExamples())) {
            if (ex.getExampleIndex() != null && !indexes.add(ex.getExampleIndex())) {
                throw new ApiException(ErrorCode.E220, "Example indexes must be unique within a grammar point");
            }
            if (isBlank(ex.getSentenceZh())) {
                throw new ApiException(ErrorCode.E200, "A grammar example requires a Chinese sentence");
            }
        }
    }
    private static final int MAX_VOCABULARY_ITEMS = 50;
    private static final int MAX_VOCABULARY_WORDS = 40;

    private volatile ObjectMapper strictVocabularyMapper;

    /** Đọc nghiêm ngặt cho các lớp lồng nhau (nghĩa, định nghĩa, phiên âm...): trường lạ bị từ chối thay vì bỏ qua. */
    private ObjectMapper strictVocabularyMapper() {
        ObjectMapper mapper = strictVocabularyMapper;
        if (mapper == null) {
            mapper = objectMapper.copy().enable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
            strictVocabularyMapper = mapper;
        }
        return mapper;
    }

    /**
     * Khoá trường của từ vựng/ngữ pháp theo loại phụ: trường ngoài class của loại phụ (vd pinyins ở EN, definitions ở ZH, sentenceZh ở ngữ pháp EN)
     * bị từ chối ở cấp trên cùng (lớp EN/ZH bỏ qua trường lạ khi đọc để đọc được JSON cũ) và ở các lớp lồng nhau (đọc nghiêm ngặt).
     */
    private void checkContentKeys(LearningResourceType type, String subType, Object content) {
        String label = type == LearningResourceType.GRAMMAR ? "Ngữ pháp " : "Từ vựng ";
        Class<?> cls = type.contentClassOf(subType);
        Set<String> allowed = new HashSet<>();
        if (type == LearningResourceType.VOCABULARY) allowed.addAll(List.of("language", "sortOrder")); // khóa cũ của từ vựng, bị bỏ qua khi đọc
        for (Class<?> c = cls; c != null && c != Object.class; c = c.getSuperclass()) {
            for (var f : c.getDeclaredFields()) {
                if (!java.lang.reflect.Modifier.isStatic(f.getModifiers())) allowed.add(f.getName());
            }
        }
        var node = objectMapper.valueToTree(content);
        List<String> unknown = new ArrayList<>();
        node.fieldNames().forEachRemaining(name -> { if (!allowed.contains(name)) unknown.add(name); });
        if (!unknown.isEmpty()) {
            throw new ApiException(ErrorCode.E200, label + subType + " không có trường: " + String.join(", ", unknown));
        }
        try {
            strictVocabularyMapper().convertValue(content, cls);
        } catch (IllegalArgumentException e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            String detail = cause instanceof com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException u
                    ? "trường lạ \"" + u.getPropertyName() + "\" trong " + u.getPath().stream().map(r -> r.getFieldName() != null ? r.getFieldName() : "[" + r.getIndex() + "]").collect(Collectors.joining("."))
                    : String.valueOf(cause.getMessage()).lines().findFirst().orElse("nội dung không hợp lệ");
            throw new ApiException(ErrorCode.E200, label + subType + " không hợp lệ: " + detail);
        }
    }

    private void validateVocabulary(String subType, Object content) {
        checkContentKeys(LearningResourceType.VOCABULARY, subType, content);
        Object typed = vocabularyContentOf(subType, content);
        if (typed instanceof VocabularyZhContent zh) {
            checkWord(zh.getWord());
            validateDictionary(zh);
        } else {
            VocabularyEnContent en = (VocabularyEnContent) typed;
            checkWord(en.getWord());
            validateEnglishVocabulary(en);
        }
    }

    private void checkWord(String word) {
        if (isBlank(word)) {
            throw new ApiException(ErrorCode.E200, "Vocabulary word cannot be blank");
        }
    }

    private void validateEnglishVocabulary(VocabularyEnContent vocab) {
        checkSize("collocations", vocab.getCollocations());
        checkSize("thesaurus", vocab.getThesaurus());
        checkSize("commonMistakes", vocab.getCommonMistakes());
        checkSize("examples", vocab.getExamples());
        int n = 0;
        for (var c : orEmpty(vocab.getCollocations())) {
            n++;
            if (c == null || isBlank(c.getPattern()) || noWords(c.getWords())) {
                throw new ApiException(ErrorCode.E200, "Collocation " + n + " needs a pattern and at least one word");
            }
        }
        n = 0;
        for (var t : orEmpty(vocab.getThesaurus())) {
            n++;
            if (t == null || t.getRelation() == null || noWords(t.getWords())) {
                throw new ApiException(ErrorCode.E200, "Thesaurus entry " + n + " needs a relation (SYNONYM/ANTONYM) and at least one word");
            }
        }
        n = 0;
        for (var m : orEmpty(vocab.getCommonMistakes())) {
            n++;
            if (m == null || isBlank(m.getTitle()) || (isBlank(m.getCorrect()) && isBlank(m.getIncorrect()))) {
                throw new ApiException(ErrorCode.E200, "Common mistake " + n + " needs a title and a correct or incorrect usage");
            }
        }
        n = 0;
        for (var e : orEmpty(vocab.getExamples())) {
            n++;
            if (e == null || (isBlank(e.getEn()) && isBlank(e.getZh()))) {
                throw new ApiException(ErrorCode.E200, "Example " + n + " needs an English or Chinese sentence");
            }
        }
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return list == null ? List.of() : list;
    }

    private static boolean noWords(List<String> words) {
        return words == null || words.stream().noneMatch(w -> w != null && !w.isBlank()) || words.size() > MAX_VOCABULARY_WORDS;
    }

    private static void checkSize(String name, List<?> list) {
        if (list != null && list.size() > MAX_VOCABULARY_ITEMS) {
            throw new ApiException(ErrorCode.E200, "Too many " + name + " (max " + MAX_VOCABULARY_ITEMS + ")");
        }
    }

    private void validateQuiz(QuizContent quiz) {
        if (isBlank(quiz.getTitle())) {
            throw new ApiException(ErrorCode.E200, "Quiz title cannot be blank");
        }
        if (quiz.getQuestions() == null || quiz.getQuestions().isEmpty()) {
            throw new ApiException(ErrorCode.E200, "Quiz must have at least one question");
        }
        if (quiz.getEstimatedMinutes() != null && (quiz.getEstimatedMinutes() < 1 || quiz.getEstimatedMinutes() > 600)) {
            throw new ApiException(ErrorCode.E200, "Thời gian dự kiến phải trong khoảng 1–600 phút");
        }
        // Câu hỏi có id duy nhất (bài làm lưu đáp án theo questionId).
        Set<String> questionIds = new HashSet<>();
        for (var q : quiz.getQuestions()) {
            if (q.getQuestionId() == null || q.getQuestionId().isBlank() || !questionIds.add(q.getQuestionId())) {
                throw new ApiException(ErrorCode.E200, "Mã câu hỏi thiếu hoặc trùng: " + q.getQuestionId());
            }
            validateGradingCriteria(q);
        }
        var problems = QuizContentChecks.problems(quiz);
        if (!problems.isEmpty()) throw new ApiException(ErrorCode.E200, "Nội dung đề không hợp lệ: " + QuizLayoutIntegrity.message(problems));
        // layout là JSON mờ do frontend định nghĩa: backend chỉ kiểm cấu trúc tham chiếu câu hỏi (QuizLayoutIntegrity), không giới hạn dung lượng.
        var violations = QuizLayoutIntegrity.violations(quiz);
        if (!violations.isEmpty()) throw new ApiException(ErrorCode.E200, "Bố cục đề không khớp câu hỏi: " + QuizLayoutIntegrity.message(violations));
    }

    // Tiêu chí chấm chỉ để tham khảo: bắt buộc có tên; điểm tối đa và mô tả tuỳ chọn. Điểm (nếu có) phải dương, tổng không vượt điểm của câu (mặc định 1).
    private static final int MAX_GRADING_CRITERIA = 20;
    // Mô tả là HTML của trình soạn văn bản nên giới hạn rộng hơn văn bản thường.
    private static final int MAX_CRITERION_DESCRIPTION = 20_000;

    private void validateGradingCriteria(QuizQuestion q) {
        var criteria = q.getGradingCriteria();
        if (criteria == null || criteria.isEmpty()) return;
        if (criteria.size() > MAX_GRADING_CRITERIA) {
            throw new ApiException(ErrorCode.E200, "Mỗi câu có tối đa " + MAX_GRADING_CRITERIA + " tiêu chí chấm điểm");
        }
        double total = 0;
        for (var c : criteria) {
            if (c == null || isBlank(c.getLabel()) || c.getLabel().length() > 200) {
                throw new ApiException(ErrorCode.E200, "Tiêu chí chấm điểm cần có tên (tối đa 200 ký tự)");
            }
            if (c.getDescription() != null && c.getDescription().length() > MAX_CRITERION_DESCRIPTION) {
                throw new ApiException(ErrorCode.E200, "Mô tả tiêu chí chấm điểm quá dài (tối đa " + MAX_CRITERION_DESCRIPTION + " ký tự HTML)");
            }
            // Điểm tối đa là tuỳ chọn; khi có thì phải dương và được cộng vào tổng.
            if (c.getMaxPoints() != null) {
                if (!(c.getMaxPoints() > 0)) {
                    throw new ApiException(ErrorCode.E200, "Điểm tối đa của tiêu chí “" + c.getLabel() + "” phải lớn hơn 0");
                }
                total += c.getMaxPoints();
            }
        }
        double questionPoints = q.getPoints() == null ? 1 : q.getPoints();
        if (total > questionPoints + 1e-9) {
            throw new ApiException(ErrorCode.E200, "Tổng điểm các tiêu chí (" + total + ") vượt điểm của câu (" + questionPoints + ")");
        }
    }

    private void validateSlideMaterial(SlideMaterialContent mat) {
        if (isBlank(mat.getFileId())) {
            throw new ApiException(ErrorCode.E200, "Slide/material requires a valid fileId");
        }
    }

    private void validateAudioPractice(AudioPracticeContent practice) {
        if (isBlank(practice.getTitle())) {
            throw new ApiException(ErrorCode.E200, "Audio practice title cannot be blank");
        }
        boolean hasAudioFile = !isBlank(practice.getAudioFileId());
        boolean hasYoutubeVideo = !isBlank(practice.getYoutubeVideoId());
        if (!hasAudioFile && !hasYoutubeVideo) {
            throw new ApiException(ErrorCode.E200, "Audio practice requires an audioFileId or youtubeVideoId");
        }
        if (hasAudioFile && hasYoutubeVideo) {
            throw new ApiException(ErrorCode.E200, "Audio practice must have exactly one media source");
        }
        if (hasYoutubeVideo && !practice.getYoutubeVideoId().matches("[A-Za-z0-9_-]{11}")) {
            throw new ApiException(ErrorCode.E200, "Audio practice youtubeVideoId is invalid");
        }
        if (practice.getDurationMillis() == null || practice.getDurationMillis() <= 0) {
            throw new ApiException(ErrorCode.E200, "Audio practice durationMillis must be positive");
        }
        if (!Boolean.TRUE.equals(practice.getShadowingEnabled())
                && !Boolean.TRUE.equals(practice.getDictationEnabled())) {
            throw new ApiException(ErrorCode.E200, "Audio practice must enable Shadowing or Dictation");
        }
        if (practice.getSegments() == null || practice.getSegments().isEmpty()) {
            throw new ApiException(ErrorCode.E200, "Audio practice requires at least one segment");
        }

        Set<Integer> segmentNumbers = new HashSet<>();
        long previousEnd = -1;
        List<AudioPracticeContent.AudioPracticeSegment> ordered = practice.getSegments().stream()
                .sorted(java.util.Comparator.comparing(AudioPracticeContent.AudioPracticeSegment::getSegmentNo))
                .toList();
        for (AudioPracticeContent.AudioPracticeSegment segment : ordered) {
            if (segment.getSegmentNo() == null || segment.getSegmentNo() < 1 || !segmentNumbers.add(segment.getSegmentNo())) {
                throw new ApiException(ErrorCode.E200, "Audio practice segmentNo must be unique and greater than zero");
            }
            if (segment.getStartMillis() == null || segment.getEndMillis() == null
                    || segment.getStartMillis() < 0 || segment.getEndMillis() <= segment.getStartMillis()) {
                throw new ApiException(ErrorCode.E200, "Audio practice segment timestamps are invalid");
            }
            if (segment.getEndMillis() > practice.getDurationMillis()) {
                throw new ApiException(ErrorCode.E200, "Audio practice segment cannot end after the audio duration");
            }
            if (segment.getStartMillis() < previousEnd) {
                throw new ApiException(ErrorCode.E200, "Audio practice segments cannot overlap");
            }
            if (isBlank(segment.getTranscript())) {
                throw new ApiException(ErrorCode.E200, "Audio practice segment transcript cannot be blank");
            }
            previousEnd = segment.getEndMillis();
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
