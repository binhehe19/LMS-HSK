package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.response.ContentPackageVersionResourceResponse;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.entity.ContentPackageVersionTopic;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.entity.json.PlacementSettings;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.repository.ContentPackageVersionTopicRepository;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceVersionRepository;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ContentPackageVersionResourceService {

    private final ContentPackageVersionResourceRepository linkRepository;
    private final ContentPackageVersionRepository packageVersionRepository;
    private final ContentPackageRepository packageRepository;
    private final LearningResourceRepository resourceRepository;
    private final LearningResourceVersionRepository resourceVersionRepository;
    private final LearningResourceService learningResourceService;
    private final ObjectMapper objectMapper;
    private final ContentPackageVersionTopicRepository topicRepository;

    private ContentPackageVersion getDraftVersionOrThrow(String packageVersionId) {
        ContentPackageVersion version = packageVersionRepository.findByIdAndDeletedFalse(packageVersionId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "ContentPackageVersion not found: " + packageVersionId));
        if (version.getStatus() != ContentPackageVersionStatus.DRAFT) {
            throw new ApiException(ErrorCode.E220, "Chỉ có thể sửa resource của phiên bản đang DRAFT");
        }
        return version;
    }

    // Tất cả package type đều yêu cầu sessionNo >= 1.
    private void validateSessionNoForPackageType(ContentPackageVersion version, int sessionNo) {
        if (sessionNo < 1) {
            ContentPackage pkg = getPackageOf(version);
            throw new ApiException(ErrorCode.E200, "sessionNo must be >= 1 for " + pkg.getType());
        }
    }

    private ContentPackage getPackageOf(ContentPackageVersion version) {
        return packageRepository.findByIdAndDeletedFalse(version.getPackageId())
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "ContentPackage not found: " + version.getPackageId()));
    }

    public ContentPackageVersionResource addResourceToSession(
            String packageVersionId, String resourceId, String resourceVersionId, int sessionNo, Integer displayOrder) {
        return addResourceToSession(packageVersionId, resourceId, resourceVersionId, sessionNo, displayOrder, null);
    }

    /** Chủ đề phải thuộc đúng phiên bản và đúng buổi của học liệu được thêm. */
    private void requireTopicInSession(String packageVersionId, int sessionNo, String topicId) {
        ContentPackageVersionTopic topic = topicRepository.findByIdAndDeletedFalse(topicId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Chủ đề không tồn tại: " + topicId));
        if (!topic.getContentPackageVersionId().equals(packageVersionId) || topic.getSessionNo() != sessionNo) {
            throw new ApiException(ErrorCode.E200, "Chủ đề không thuộc buổi " + sessionNo + " của phiên bản này");
        }
    }

    public ContentPackageVersionResource assignTopic(String packageVersionId, String resourceId, String topicId) {
        getDraftVersionOrThrow(packageVersionId);
        ContentPackageVersionResource link = linkRepository
                .findByContentPackageVersionIdAndLearningResourceIdAndDeletedFalse(packageVersionId, resourceId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Bài không có trong học phần: " + resourceId));
        if (topicId != null && !topicId.isBlank()) {
            requireTopicInSession(packageVersionId, link.getSessionNo(), topicId);
            link.setTopicId(topicId);
        } else {
            link.setTopicId(null);
        }
        return linkRepository.save(link);
    }

    public ContentPackageVersionResource addResourceToSession(
            String packageVersionId,
            String resourceId,
            String resourceVersionId,
            int sessionNo,
            Integer displayOrder,
            String topicId) {

        ContentPackageVersion draft = getDraftVersionOrThrow(packageVersionId);
        validateSessionNoForPackageType(draft, sessionNo);

        LearningResource resource = resourceRepository.findByIdAndDeletedFalse(resourceId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "LearningResource not found: " + resourceId));
        // Đề luyện kỹ năng (Reading/Listening/Writing/Speaking) chỉ phục vụ màn luyện đề của học sinh, không xếp vào buổi học.
        if (resource.getType() == LearningResourceType.ASSESSMENT
                && resource.getSubType() != null
                && !ResourceSubTypes.QUIZ.equals(resource.getSubType())) {
            throw new ApiException(ErrorCode.E200, "Chỉ bài tập thường (QUIZ) mới được thêm vào học phần");
        }

        resourceVersionRepository.findByIdAndDeletedFalse(resourceVersionId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "LearningResourceVersion not found: " + resourceVersionId));

        if (displayOrder == null || displayOrder < 0) {
            throw new ApiException(ErrorCode.E200, "displayOrder must be >= 0");
        }

        if (linkRepository.existsByContentPackageVersionIdAndSessionNoAndDisplayOrderAndDeletedFalse(
                packageVersionId, sessionNo, displayOrder)) {
            throw new ApiException(ErrorCode.E220, "A resource already exists at sessionNo " + sessionNo + " and displayOrder " + displayOrder);
        }

        String topic = topicId == null || topicId.isBlank() ? null : topicId;
        if (topic != null) requireTopicInSession(packageVersionId, sessionNo, topic);

        ContentPackageVersionResource link = ContentPackageVersionResource.builder()
                .contentPackageVersionId(packageVersionId)
                .learningResourceId(resourceId)
                .learningResourceVersionId(resourceVersionId)
                .sessionNo(sessionNo)
                .displayOrder(displayOrder)
                .topicId(topic)
                .build();

        return linkRepository.save(link);
    }

    // Điều kiện của bài trong học phần: chỉ sửa được khi phiên bản đang DRAFT và chỉ cho bài tập (ASSESSMENT); null = xoá.
    public ContentPackageVersionResource updateSettings(String packageVersionId, String resourceId, PlacementSettings settings) {
        getDraftVersionOrThrow(packageVersionId);
        ContentPackageVersionResource link = linkRepository
                .findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc(packageVersionId).stream()
                .filter(l -> l.getLearningResourceId().equals(resourceId))
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Bài không có trong học phần: " + resourceId));
        LearningResource resource = resourceRepository.findByIdAndDeletedFalse(resourceId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "LearningResource not found: " + resourceId));
        if (resource.getType() != LearningResourceType.ASSESSMENT) {
            throw new ApiException(ErrorCode.E200, "Chỉ bài tập mới có điều kiện");
        }
        if (settings != null) settings.validate();
        link.setSettings(settings);
        return linkRepository.save(link);
    }

    public void removeResourceFromSession(String packageVersionId, String resourceId) {
        getDraftVersionOrThrow(packageVersionId);
        linkRepository.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc(packageVersionId)
                .stream()
                .filter(l -> l.getLearningResourceId().equals(resourceId))
                .forEach(l -> {
                    l.setDeleted(true);
                    linkRepository.save(l);
                });
    }

    public void reorderSessionResources(String packageVersionId, int sessionNo, List<String> resourceIdsInOrder) {
        validateSessionNoForPackageType(getDraftVersionOrThrow(packageVersionId), sessionNo);
        List<ContentPackageVersionResource> sessionLinks = linkRepository
                .findByContentPackageVersionIdAndSessionNoAndDeletedFalseOrderByDisplayOrderAsc(packageVersionId, sessionNo);

        int offset = sessionLinks.size();
        for (ContentPackageVersionResource link : sessionLinks) {
            link.setDisplayOrder(link.getDisplayOrder() + offset);
        }
        linkRepository.saveAll(sessionLinks);
        linkRepository.flush();

        for (int i = 0; i < resourceIdsInOrder.size(); i++) {
            String resId = resourceIdsInOrder.get(i);
            int order = i;
            sessionLinks.stream()
                    .filter(l -> l.getLearningResourceId().equals(resId))
                    .findFirst()
                    .ifPresent(l -> l.setDisplayOrder(order));
        }
        linkRepository.saveAll(sessionLinks);
    }

    @Transactional(readOnly = true)
    public List<ContentPackageVersionResource> listSessionResources(String packageVersionId, int sessionNo) {
        return linkRepository.findByContentPackageVersionIdAndSessionNoAndDeletedFalseOrderByDisplayOrderAsc(packageVersionId, sessionNo);
    }

    @Transactional(readOnly = true)
    public List<ContentPackageVersionResource> listAllResources(String packageVersionId) {
        return linkRepository.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc(packageVersionId);
    }

    public LearningResourceVersion updateResourceContentWithinPackage(
            String packageVersionId, String learningResourceId, Object content) {

        getDraftVersionOrThrow(packageVersionId);

        ContentPackageVersionResource link = linkRepository
                .findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc(packageVersionId)
                .stream()
                .filter(l -> l.getLearningResourceId().equals(learningResourceId))
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.E227,
                        "Resource not found in this package version: " + learningResourceId));

        LearningResource resource = resourceRepository.findByIdAndDeletedFalse(learningResourceId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227,
                        "LearningResource not found: " + learningResourceId));

        learningResourceService.validateContent(resource.getType(), resource.getSubType(), content);

        LearningResourceVersion draft = learningResourceService.createDraftVersion(resource.getId(), content);
        LearningResourceVersion saved = learningResourceService.publishVersion(resource.getId(), draft.getId());

        link.setLearningResourceVersionId(saved.getId());
        linkRepository.save(link);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<ContentPackageVersionResourceResponse> listResourceResponses(String packageVersionId, Integer sessionNo) {
        List<ContentPackageVersionResource> links = (sessionNo != null)
                ? listSessionResources(packageVersionId, sessionNo)
                : listAllResources(packageVersionId);

        if (links.isEmpty()) {
            return List.of();
        }

        List<String> resIds = links.stream().map(ContentPackageVersionResource::getLearningResourceId).distinct().toList();
        List<String> verIds = links.stream().map(ContentPackageVersionResource::getLearningResourceVersionId).distinct().toList();

        Map<String, LearningResource> resourceMap = resourceRepository.findAllById(resIds).stream()
                .collect(Collectors.toMap(LearningResource::getId, Function.identity()));
        Map<String, LearningResourceVersion> versionMap = resourceVersionRepository.findByIdInAndDeletedFalse(verIds).stream()
                .collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));

        // Một truy vấn cho cả phiên bản; học liệu không chủ đề (hoặc chủ đề đã xóa) để trống ba trường chủ đề.
        Map<String, ContentPackageVersionTopic> topicMap = links.stream().anyMatch(l -> l.getTopicId() != null)
                ? topicRepository.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscTopicOrderAsc(packageVersionId).stream()
                        .collect(Collectors.toMap(ContentPackageVersionTopic::getId, Function.identity()))
                : Map.of();

        // Chỉ bản sao có gốc nằm trong Kho mới trả sourceResourceId (giao diện dẫn sang Kho để sửa);
        // bản chép từ học phần khác coi như học liệu riêng, sửa ngay trong học phần.
        List<String> sourceIds = resourceMap.values().stream().map(LearningResource::getSourceResourceId)
                .filter(Objects::nonNull).distinct().toList();
        Set<String> librarySourceIds = sourceIds.isEmpty() ? Set.of()
                : resourceRepository.findAllById(sourceIds).stream().filter(LearningResource::isInLibrary)
                        .map(LearningResource::getId).collect(Collectors.toSet());

        return links.stream().map(link -> {
            LearningResource res = resourceMap.get(link.getLearningResourceId());
            LearningResourceVersion ver = versionMap.get(link.getLearningResourceVersionId());
            Object parsedContent = null;
            if (res != null && ver != null && ver.getContent() != null) {
                parsedContent = ver.getContentAs(res.getType().contentClassOf(res.getSubType()), objectMapper);
            }
            Metadata meta = metadataOf(ver != null ? ver.getContent() : null, objectMapper);
            String sourceId = res != null ? res.getSourceResourceId() : null;
            return ContentPackageVersionResourceResponse.from(
                    link,
                    res != null ? res.getType() : null,
                    parsedContent
            ).withMetadata(meta.title(), res != null ? res.getSubType() : null,
                    // shortcut: layout.meta.skill chỉ còn để đọc đề HSK chưa chuyển sang cột skill; bỏ nhánh này sau khi chạy script chuyển dữ liệu.
                    res != null && res.getSkill() != null ? res.getSkill() : meta.skill())
                    .withTopic(link.getTopicId() == null ? null : topicMap.get(link.getTopicId()))
                    .withSourceResourceId(sourceId != null && librarySourceIds.contains(sourceId) ? sourceId : null);
        }).toList();
    }

    record Metadata(String title, String skill) {}

    /**
     * Tiêu đề (title, không có thì fileName) và kỹ năng (layout.meta.skill) đọc từ chuỗi JSON gốc: dựng cây một lần cho mỗi học liệu,
     * không tuần tự hóa lại cả đối tượng đã parse. Nội dung trống hoặc hỏng cho kết quả rỗng, không làm hỏng cả danh sách.
     */
    static Metadata metadataOf(String json, ObjectMapper mapper) {
        if (json == null || json.isBlank()) return new Metadata(null, null);
        JsonNode root;
        try {
            root = mapper.readTree(json);
        } catch (Exception e) {
            return new Metadata(null, null);
        }
        JsonNode title = root.path("title");
        String text = title.isMissingNode() || title.isNull() ? root.path("fileName").asText(null) : title.asText();
        return new Metadata(text, root.path("layout").path("meta").path("skill").asText(null));
    }
}
