package pl.co.lms.service;

import base.co.common.dto.PageResponse;
import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.client.CmsClient;
import pl.co.lms.dto.request.CreateContentPackageRequest;
import pl.co.lms.dto.request.UpdateContentPackageVersionRequest;
import pl.co.lms.dto.response.ContentPackageResponse;
import pl.co.lms.dto.response.ContentPackageVersionResponse;
import pl.co.lms.dto.response.EditLockResponse;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.entity.ContentPackageVersionSession;
import pl.co.lms.entity.ContentPackageVersionTopic;
import pl.co.lms.entity.json.PlacementSettings;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.repository.ContentPackageVersionSessionRepository;
import pl.co.lms.repository.ContentPackageVersionTopicRepository;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ContentPackageService {

    private static final String PKG_LOCK_PREFIX = "pkg-edit-lock";
    private static final long PKG_LOCK_TTL_SECONDS = 60;
    private static final int MAX_SESSION_COUNT = 500;

    private final ContentPackageRepository packageRepository;
    private final ContentPackageVersionRepository versionRepository;
    private final ContentPackageVersionResourceRepository versionResourceRepository;
    private final LearningResourceService learningResourceService;
    private final RedisSessionLockService redisLockService;
    private final pl.co.lms.service.studymaterials.StudyMaterialVocabularyRefreshService studyVocabularyRefresh;
    private final ContentPackageVersionTopicRepository topicRepository;
    private final ContentPackageVersionSessionRepository sessionRepository;
    private final CmsClient cmsClient;

    public ContentPackage createPackage(ContentPackageType type, String syllabusId, String syllabusVersionId) {
        if (type == null) {
            throw new ApiException(ErrorCode.E200, "ContentPackage type is required");
        }
        // Học phần có thể chưa thuộc giáo trình nào (cả hai trống); nếu thuộc thì phải đủ cặp id + phiên bản.
        boolean hasSyllabus = syllabusId != null && !syllabusId.isBlank();
        boolean hasVersion = syllabusVersionId != null && !syllabusVersionId.isBlank();
        if (hasSyllabus != hasVersion) {
            throw new ApiException(ErrorCode.E200, "syllabusId và syllabusVersionId phải cùng có hoặc cùng để trống");
        }
        ContentPackage contentPackage = ContentPackage.builder()
                .type(type)
                .syllabusId(hasSyllabus ? syllabusId : null)
                .syllabusVersionId(hasVersion ? syllabusVersionId : null)
                .build();
        return packageRepository.save(contentPackage);
    }

    // Thay cặp giáo trình trên chính học phần, giữ nguyên ID và các phiên bản học phần.
    public ContentPackage attachToSyllabus(String id, String syllabusId, String syllabusVersionId) {
        if (syllabusId == null || syllabusId.isBlank() || syllabusVersionId == null || syllabusVersionId.isBlank()) {
            throw new ApiException(ErrorCode.E200, "Gắn vào giáo trình phải có syllabusId và syllabusVersionId");
        }
        if (!syllabusId.matches("[A-Za-z0-9_-]{1,100}")) {
            throw new ApiException(ErrorCode.E200, "Mã giáo trình không hợp lệ");
        }
        ContentPackage current = getPackage(id);
        String previousSyllabusId = current.getSyllabusId();
        String previousVersionId = current.getSyllabusVersionId();
        if (syllabusId.equals(previousSyllabusId) && syllabusVersionId.equals(previousVersionId)) return current;
        if (cmsClient.listSyllabusVersions(syllabusId).stream().noneMatch(version -> syllabusVersionId.equals(version.getId()))) {
            throw new ApiException(ErrorCode.E200, "Phiên bản không thuộc giáo trình đã chọn");
        }
        int updated = packageRepository.replaceSyllabus(id, syllabusId, syllabusVersionId,
                previousSyllabusId, previousVersionId, java.time.Instant.now());
        if (updated == 0) {
            throw new ApiException(ErrorCode.E200, "Giáo trình của học phần vừa thay đổi. Vui lòng tải lại và thử lại.");
        }
        ContentPackage moved = getPackage(id);
        if (previousSyllabusId != null && !previousSyllabusId.equals(syllabusId)) {
            clearSyllabusSettings(moved.getPublishedVersionId());
            clearSyllabusSettings(moved.getDraftVersionId());
        }
        return moved;
    }

    private void clearSyllabusSettings(String versionId) {
        if (versionId == null) return;
        for (ContentPackageVersionResource link : versionResourceRepository
                .findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc(versionId)) {
            PlacementSettings settings = link.getSettings();
            if (settings != null && (settings.getGradingItem() != null || settings.getCloCodes() != null)) {
                link.setSettings(cloneSettings(settings, false));
            }
        }
    }

    // Sao chép thành một học phần mới (bản nháp) thuộc giáo trình đích: chép thông tin và các dòng đặt bài theo buổi,
    // bài (resource) dùng chung với phiên bản ghim; học phần mới không dính gì vào bản gốc.
    public ContentPackage copyPackage(String sourceId, String syllabusId, String syllabusVersionId, String title) {
        if (syllabusId == null || syllabusId.isBlank() || syllabusVersionId == null || syllabusVersionId.isBlank()) {
            throw new ApiException(ErrorCode.E200, "Sao chép học phần phải chỉ rõ giáo trình đích (syllabusId, syllabusVersionId)");
        }
        ContentPackage source = getPackage(sourceId);
        String sourceVersionId = source.getPublishedVersionId() != null ? source.getPublishedVersionId() : source.getDraftVersionId();
        if (sourceVersionId == null) {
            throw new ApiException(ErrorCode.E227, "Học phần nguồn chưa có phiên bản nào để sao chép");
        }
        ContentPackageVersion from = getVersion(sourceVersionId);

        ContentPackage copy = createPackage(source.getType(), syllabusId, syllabusVersionId);
        ContentPackageVersion draft = createDraftVersion(copy.getId(), ContentPackageVersion.builder()
                .title(title != null && !title.isBlank() ? title.trim() : from.getTitle())
                .description(from.getDescription())
                .level(from.getLevel())
                .topic(from.getTopic())
                .codeName(from.getCodeName())
                .skillType(from.getSkillType())
                .category(from.getCategory())
                .sessionCount(from.getSessionCount())
                .build());
        cloneLinks(from.getId(), draft.getId(), source.getSyllabusId() != null && source.getSyllabusId().equals(syllabusId));
        return copy;
    }

    // keepSyllabusBound = false khi sao chép sang giáo trình khác: hạng mục tính điểm và CLO thuộc syllabus cũ nên bị bỏ.
    private void cloneLinks(String fromVersionId, String toVersionId, boolean keepSyllabusBound) {
        // Tên buổi thuộc phiên bản nên cũng được sao chép (id mới); buổi chỉ gắn với học liệu/chủ đề qua session_no.
        for (ContentPackageVersionSession session : sessionRepository
                .findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAsc(fromVersionId)) {
            sessionRepository.save(ContentPackageVersionSession.builder()
                    .contentPackageVersionId(toVersionId)
                    .sessionNo(session.getSessionNo())
                    .title(session.getTitle())
                    .build());
        }
        // Chủ đề thuộc phiên bản nên được sao chép với id mới (kể cả chủ đề rỗng); topic_id của các dòng sao chép trỏ sang id mới.
        java.util.Map<String, String> topicIds = new java.util.HashMap<>();
        for (ContentPackageVersionTopic topic : topicRepository
                .findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscTopicOrderAsc(fromVersionId)) {
            ContentPackageVersionTopic copy = topicRepository.save(ContentPackageVersionTopic.builder()
                    .contentPackageVersionId(toVersionId)
                    .sessionNo(topic.getSessionNo())
                    .title(topic.getTitle())
                    .topicOrder(topic.getTopicOrder())
                    .build());
            topicIds.put(topic.getId(), copy.getId());
        }
        for (ContentPackageVersionResource link : versionResourceRepository
                .findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc(fromVersionId)) {
            versionResourceRepository.save(ContentPackageVersionResource.builder()
                    .contentPackageVersionId(toVersionId)
                    .learningResourceId(link.getLearningResourceId())
                    .learningResourceVersionId(link.getLearningResourceVersionId())
                    .sessionNo(link.getSessionNo())
                    .displayOrder(link.getDisplayOrder())
                    .settings(cloneSettings(link.getSettings(), keepSyllabusBound))
                    .topicId(link.getTopicId() == null ? null : topicIds.get(link.getTopicId()))
                    .build());
        }
    }

    private static PlacementSettings cloneSettings(PlacementSettings s, boolean keepSyllabusBound) {
        if (s == null) return null;
        return PlacementSettings.builder()
                .assignmentType(s.getAssignmentType()).maxAttempts(s.getMaxAttempts()).showAnswer(s.getShowAnswer())
                .passThresholdPct(s.getPassThresholdPct()).releaseOffsetH(s.getReleaseOffsetH()).dueOffsetH(s.getDueOffsetH())
                .cloCodes(keepSyllabusBound ? s.getCloCodes() : null)
                .gradingItem(keepSyllabusBound ? s.getGradingItem() : null)
                .build();
    }

    public ContentPackage createPackageWithInitialDraft(CreateContentPackageRequest req) {
        ContentPackage pkg = createPackage(req.type(), req.syllabusId(), req.syllabusVersionId());
        if (req.title() != null && !req.title().isBlank()) {
            ContentPackageVersion draft = ContentPackageVersion.builder()
                    .title(req.title())
                    .description(req.description())
                    .level(req.level())
                    .topic(req.topic())
                    .sessionCount(req.sessionCount())
                    .build();
            createDraftVersion(pkg.getId(), draft);
        }
        return pkg;
    }

    @Transactional(readOnly = true)
    public ContentPackage getPackage(String id) {
        return packageRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "ContentPackage not found: " + id));
    }

    @Transactional(readOnly = true)
    public ContentPackageResponse getPackageResponse(String id) {
        ContentPackage pkg = getPackage(id);
        return buildResponses(List.of(pkg)).get(0);
    }

    @Transactional(readOnly = true)
    public PageResponse<ContentPackageResponse> listPackageResponses(ContentPackageType type, int page, int size) {
        return listPackageResponses(type, null, page, size);
    }

    // syllabusId (tuỳ chọn): chỉ lấy học phần thuộc giáo trình đó, lọc ở server để phân trang đúng.
    @Transactional(readOnly = true)
    public PageResponse<ContentPackageResponse> listPackageResponses(ContentPackageType type, String syllabusId, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        boolean bySyllabus = syllabusId != null && !syllabusId.isBlank();
        Page<ContentPackage> pageResult;
        if (bySyllabus) {
            pageResult = type != null
                    ? packageRepository.findByTypeAndSyllabusIdAndDeletedFalseOrderByCreatedAtDesc(type, syllabusId, pageable)
                    : packageRepository.findBySyllabusIdAndDeletedFalseOrderByCreatedAtDesc(syllabusId, pageable);
        } else {
            pageResult = type != null
                    ? packageRepository.findByTypeAndDeletedFalseOrderByCreatedAtDesc(type, pageable)
                    : packageRepository.findByDeletedFalseOrderByCreatedAtDesc(pageable);
        }

        List<ContentPackageResponse> items = buildResponses(pageResult.getContent());
        return new PageResponse<>(items, pageResult.getTotalElements(), pageResult.getTotalPages(), page, size, null);
    }

    /**
     * Danh sách học phần cho quản trị: lọc và phân trang ở server. Tên, mô tả, cấp độ lấy từ phiên bản đang hiển thị
     * (đã xuất bản, chưa có thì bản nháp), cùng cách màn hình dựng dòng. keyword khớp tên/mô tả (chứa) hoặc đầu mã học phần
     * (10 ký tự đầu của id); status = PUBLISHED | DRAFT; level khớp đúng.
     */
    @Transactional(readOnly = true)
    public PageResponse<ContentPackageResponse> searchPackageResponses(ContentPackageType type, String syllabusId, String keyword,
            String status, String level, int page, int size) {
        return searchPackageResponses(type, syllabusId, false, keyword, status, level, page, size);
    }

    /** freeOnly = true chỉ lấy học phần tự do (chưa thuộc giáo trình nào, syllabusId null). */
    @Transactional(readOnly = true)
    public PageResponse<ContentPackageResponse> searchPackageResponses(ContentPackageType type, String syllabusId, boolean freeOnly,
            String keyword, String status, String level, int page, int size) {
        String needle = keyword == null ? "" : keyword.trim().toLowerCase();
        String like = "%" + needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        String codePrefix = needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Specification<ContentPackage> filter = (r, q, cb) -> {
            List<Predicate> all = new ArrayList<>();
            all.add(cb.isFalse(r.get("deleted")));
            if (type != null) all.add(cb.equal(r.get("type"), type));
            if (syllabusId != null && !syllabusId.isBlank()) all.add(cb.equal(r.get("syllabusId"), syllabusId));
            if (freeOnly) all.add(cb.isNull(r.get("syllabusId")));
            if ("PUBLISHED".equals(status)) all.add(cb.isNotNull(r.get("publishedVersionId")));
            if ("DRAFT".equals(status)) all.add(cb.isNull(r.get("publishedVersionId")));
            if (level != null && !level.isBlank()) {
                all.add(cb.exists(activeVersion(q, r, cb, v -> List.of(cb.equal(v.get("level"), level)))));
            }
            if (!needle.isEmpty()) {
                // Mã học phần = 10 ký tự đầu của id; khớp cả khi từ khóa chỉ trùng mã.
                Predicate byText = cb.exists(activeVersion(q, r, cb, v -> List.of(cb.or(
                        cb.like(cb.lower(v.<String>get("title")), like, '\\'), cb.like(cb.lower(v.<String>get("description")), like, '\\')))));
                all.add(cb.or(byText, cb.like(cb.lower(r.<String>get("id")), codePrefix, '\\')));
            }
            return cb.and(all.toArray(Predicate[]::new));
        };
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size)), Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ContentPackage> result = packageRepository.findAll(filter, pageable);
        return new PageResponse<>(buildResponses(result.getContent()), result.getTotalElements(), result.getTotalPages(), page, size, null);
    }

    /** Subquery chọn phiên bản đang hiển thị của học phần (đã xuất bản, chưa có thì bản nháp) thỏa các điều kiện thêm. */
    private static Subquery<String> activeVersion(CriteriaQuery<?> q, Root<ContentPackage> r, CriteriaBuilder cb,
            Function<Root<ContentPackageVersion>, List<Predicate>> extra) {
        Subquery<String> active = q.subquery(String.class);
        Root<ContentPackageVersion> v = active.from(ContentPackageVersion.class);
        List<Predicate> on = new ArrayList<>();
        on.add(cb.equal(v.get("id"), cb.coalesce(r.<String>get("publishedVersionId"), r.<String>get("draftVersionId"))));
        on.add(cb.isFalse(v.get("deleted")));
        on.addAll(extra.apply(v));
        return active.select(v.<String>get("id")).where(on.toArray(Predicate[]::new));
    }
    @Transactional(readOnly = true)
    public List<ContentPackageResponse> listPackageResponsesByIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return buildResponses(packageRepository.findByIdInAndDeletedFalse(ids));
    }

    private List<ContentPackageResponse> buildResponses(List<ContentPackage> packages) {
        if (packages.isEmpty()) return List.of();

        Set<String> versionIds = new HashSet<>();
        for (ContentPackage pkg : packages) {
            if (pkg.getDraftVersionId() != null) versionIds.add(pkg.getDraftVersionId());
            if (pkg.getPublishedVersionId() != null) versionIds.add(pkg.getPublishedVersionId());
        }
        Map<String, ContentPackageVersion> versionsById = versionIds.isEmpty() ? Map.of()
                : versionRepository.findAllById(versionIds).stream()
                        .filter(v -> !v.isDeleted())
                        .collect(Collectors.toMap(ContentPackageVersion::getId, v -> v));

        return packages.stream().map(pkg -> {
            ContentPackageVersionResponse draft = pkg.getDraftVersionId() != null
                    ? Optional.ofNullable(versionsById.get(pkg.getDraftVersionId()))
                            .map(ContentPackageVersionResponse::from).orElse(null)
                    : null;
            ContentPackageVersionResponse published = pkg.getPublishedVersionId() != null
                    ? Optional.ofNullable(versionsById.get(pkg.getPublishedVersionId()))
                            .map(ContentPackageVersionResponse::from).orElse(null)
                    : null;
            String activeVersionId = pkg.getPublishedVersionId() != null
                    ? pkg.getPublishedVersionId()
                    : pkg.getDraftVersionId();
            long resourceCount = activeVersionId != null
                    ? versionResourceRepository.countByContentPackageVersionIdAndDeletedFalse(activeVersionId) : 0;
            // Số buổi = buổi lớn nhất đã lưu (kể cả buổi trống) hoặc số buổi có tài nguyên, lấy giá trị lớn hơn.
            long usedSessions = activeVersionId != null
                    ? versionResourceRepository.countDistinctSessionNoByContentPackageVersionIdAndDeletedFalse(activeVersionId) : 0;
            ContentPackageVersion activeVersion = activeVersionId != null ? versionsById.get(activeVersionId) : null;
            long savedSessions = activeVersion != null && activeVersion.getSessionCount() != null
                    ? activeVersion.getSessionCount() : 0;
            long sessionCount = Math.max(usedSessions, savedSessions);
            return ContentPackageResponse.from(pkg, resourceCount, sessionCount, draft, published);
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<ContentPackageResponse> listPackageResponses(ContentPackageType type) {
        return listPackageResponses(type, 0, 1000).getItems();
    }

    @Transactional(readOnly = true)
    public List<ContentPackage> listPackages(ContentPackageType type) {
        if (type != null) {
            return packageRepository.findByTypeAndDeletedFalseOrderByCreatedAtDesc(type);
        }
        return packageRepository.findByDeletedFalseOrderByCreatedAtDesc();
    }

    public void deletePackage(String id) {
        ContentPackage contentPackage = getPackage(id);
        contentPackage.setDeleted(true);
        packageRepository.save(contentPackage);
    }

    public ContentPackageVersion createDraftVersion(String packageId, ContentPackageVersion draftData) {
        ContentPackage contentPackage = getPackage(packageId);

        int nextVersion = versionRepository.findByPackageIdAndDeletedFalseOrderByVersionDesc(packageId).stream()
                .findFirst()
                .map(v -> v.getVersion() + 1)
                .orElse(1);

        draftData.setPackageId(packageId);
        draftData.setVersion(nextVersion);
        draftData.setStatus(ContentPackageVersionStatus.DRAFT);

        ContentPackageVersion saved = versionRepository.save(draftData);
        contentPackage.setDraftVersionId(saved.getId());
        packageRepository.save(contentPackage);
        return saved;
    }

    public ContentPackageVersion updateDraftVersion(String packageId, String versionId, UpdateContentPackageVersionRequest req) {
        ContentPackageVersion version = getVersion(versionId);

        if (!version.getPackageId().equals(packageId)) {
            throw new ApiException(ErrorCode.E200, "Version does not belong to the specified package");
        }
        if (version.getStatus() != ContentPackageVersionStatus.DRAFT) {
            throw new ApiException(ErrorCode.E220, "Chỉ có thể sửa phiên bản đang ở trạng thái DRAFT");
        }

        if (req.title() != null) version.setTitle(req.title());
        if (req.description() != null) version.setDescription(req.description());
        if (req.level() != null) version.setLevel(req.level());
        if (req.topic() != null) version.setTopic(req.topic());
        if (req.sessionCount() != null) {
            if (req.sessionCount() < 0 || req.sessionCount() > MAX_SESSION_COUNT) {
                throw new ApiException(ErrorCode.E200, "Số buổi phải trong khoảng 0–" + MAX_SESSION_COUNT);
            }
            version.setSessionCount(req.sessionCount());
        }

        return versionRepository.save(version);
    }

    public ContentPackageVersion ensureDraftForEdit(String packageId) {
        ContentPackage contentPackage = getPackage(packageId);
        if (contentPackage.getDraftVersionId() != null) {
            ContentPackageVersion existing = getVersion(contentPackage.getDraftVersionId());
            if (existing.getStatus() == ContentPackageVersionStatus.DRAFT) {
                return existing;
            }
            contentPackage.setDraftVersionId(null);
            packageRepository.save(contentPackage);
        }
        if (contentPackage.getPublishedVersionId() == null) {
            throw new ApiException(ErrorCode.E227, "Package chưa có version nào để sửa");
        }

        ContentPackageVersion published = getVersion(contentPackage.getPublishedVersionId());
        ContentPackageVersion draftData = ContentPackageVersion.builder()
                .title(published.getTitle())
                .description(published.getDescription())
                .level(published.getLevel())
                .topic(published.getTopic())
                .codeName(published.getCodeName())
                .skillType(published.getSkillType())
                .category(published.getCategory())
                .sessionCount(published.getSessionCount())
                .build();
        ContentPackageVersion draft = createDraftVersion(packageId, draftData);

        cloneLinks(published.getId(), draft.getId(), true);

        return draft;
    }

    public void discardDraft(String packageId, String sessionToken) {
        ContentPackage contentPackage = getPackage(packageId);
        requireValidLock(contentPackage, sessionToken);
        if (contentPackage.getDraftVersionId() == null) {
            throw new ApiException(ErrorCode.E227, "Package không có bản nháp nào để huỷ");
        }

        String draftId = contentPackage.getDraftVersionId();
        List<ContentPackageVersionResource> draftLinks = versionResourceRepository
                .findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc(draftId);
        draftLinks.forEach(link -> {
            link.setDeleted(true);
            versionResourceRepository.save(link);
        });
        topicRepository.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscTopicOrderAsc(draftId).forEach(topic -> {
            topic.setDeleted(true);
            topicRepository.save(topic);
        });
        sessionRepository.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAsc(draftId).forEach(session -> {
            session.setDeleted(true);
            sessionRepository.save(session);
        });

        ContentPackageVersion draft = getVersion(draftId);
        draft.setDeleted(true);
        versionRepository.save(draft);

        contentPackage.setDraftVersionId(null);
        if (contentPackage.getPublishedVersionId() == null) {
            contentPackage.setDeleted(true);
        }
        clearLock(contentPackage);
        packageRepository.save(contentPackage);
    }

    public EditLockResponse acquireOrRenewLock(String packageId, String userId, String sessionToken) {
        try {
            RedisSessionLockService.LockResult result = redisLockService.acquireOrRenew(
                    PKG_LOCK_PREFIX, packageId, userId, sessionToken, PKG_LOCK_TTL_SECONDS, false);
            return new EditLockResponse(result.acquired(), result.holderUserId(), result.expiresAt(), false);
        } catch (Exception e) {
            throw new ApiException(ErrorCode.E220,
                    "Không thể kiểm tra khoá chỉnh sửa (Redis không khả dụng) — vui lòng thử lại");
        }
    }

    public void releaseLock(String packageId, String sessionToken) {
        try {
            redisLockService.release(PKG_LOCK_PREFIX, packageId, sessionToken);
        } catch (Exception ignored) {
        }
    }

    private void clearLock(ContentPackage contentPackage) {
        try {
            redisLockService.forceDelete(PKG_LOCK_PREFIX, contentPackage.getId());
        } catch (Exception ignored) {
        }
    }

    private void requireValidLock(ContentPackage contentPackage, String sessionToken) {
        boolean held;
        try {
            held = redisLockService.isHeldBy(PKG_LOCK_PREFIX, contentPackage.getId(), sessionToken);
        } catch (Exception e) {
            throw new ApiException(ErrorCode.E220,
                    "Không thể xác minh khoá chỉnh sửa (Redis không khả dụng) — vui lòng thử lại");
        }
        if (!held) {
            throw new ApiException(ErrorCode.E220,
                    "Phiên chỉnh sửa của bạn đã hết hạn hoặc bị người khác giành mất — vui lòng tải lại trang");
        }
    }

    public EditLockResponse heartbeatAndMaybeSave(
            String packageId, String userId, String sessionToken,
            String versionId, UpdateContentPackageVersionRequest updates) {
        EditLockResponse lockResult = acquireOrRenewLock(packageId, userId, sessionToken);
        if (!lockResult.acquired()) {
            return lockResult;
        }
        boolean saved = false;
        if (versionId != null) {
            updateDraftVersion(packageId, versionId, updates);
            saved = true;
        }
        return new EditLockResponse(true, userId, lockResult.lockExpiresAt(), saved);
    }

    public ContentPackageVersion publishVersion(String packageId, String versionId, String sessionToken) {
        ContentPackage contentPackage = getPackage(packageId);
        requireValidLock(contentPackage, sessionToken);
        ContentPackageVersion version = getVersion(versionId);

        if (!version.getPackageId().equals(packageId)) {
            throw new ApiException(ErrorCode.E200, "Version does not belong to the specified package");
        }

        if (version.getTitle() == null || version.getTitle().isBlank()) {
            throw new ApiException(ErrorCode.E200, "Cần đặt tên học phần trước khi publish");
        }
        if (versionResourceRepository.countByContentPackageVersionIdAndDeletedFalse(version.getId()) == 0) {
            throw new ApiException(ErrorCode.E200, "Học phần chưa có nội dung nào nên chưa thể publish");
        }

        version.setStatus(ContentPackageVersionStatus.PUBLISHED);
        versionRepository.save(version);

        contentPackage.setPublishedVersionId(version.getId());
        if (version.getId().equals(contentPackage.getDraftVersionId())) {
            contentPackage.setDraftVersionId(null);
        }
        clearLock(contentPackage);
        packageRepository.save(contentPackage);
        if (contentPackage.getType() == ContentPackageType.VOCABULARY) studyVocabularyRefresh.refreshPackage(packageId, versionId);
        return version;
    }

    public ContentPackageVersion archiveVersion(String packageId, String versionId) {
        ContentPackage contentPackage = getPackage(packageId);
        ContentPackageVersion version = getVersion(versionId);

        if (!version.getPackageId().equals(packageId)) {
            throw new ApiException(ErrorCode.E200, "Version does not belong to the specified package");
        }

        version.setStatus(ContentPackageVersionStatus.ARCHIVED);
        versionRepository.save(version);

        if (version.getId().equals(contentPackage.getDraftVersionId())) {
            contentPackage.setDraftVersionId(null);
            packageRepository.save(contentPackage);
        }
        if (version.getId().equals(contentPackage.getPublishedVersionId())) {
            contentPackage.setPublishedVersionId(null);
            packageRepository.save(contentPackage);
        }
        return version;
    }

    @Transactional(readOnly = true)
    public ContentPackageVersion getVersion(String versionId) {
        return versionRepository.findByIdAndDeletedFalse(versionId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "ContentPackageVersion not found: " + versionId));
    }

    @Transactional(readOnly = true)
    public List<ContentPackageVersion> listVersions(String packageId) {
        getPackage(packageId);
        return versionRepository.findByPackageIdAndDeletedFalseOrderByVersionDesc(packageId);
    }
}
