package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.response.ResourcePackageUsageResponse;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceVersionRepository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

// Đồng bộ nội dung từ tài nguyên của Kho xuống các bản sao đang nằm trong học phần. Không tạo phiên bản
// học phần mới: chỉ tạo phiên bản mới cho bản sao và đổi liên kết trong phiên bản học phần đang dùng.
@Service
@RequiredArgsConstructor
@Transactional
public class LearningResourceSyncService {

    private final LearningResourceRepository resourceRepository;
    private final LearningResourceVersionRepository resourceVersionRepository;
    private final LearningResourceService resourceService;
    private final ContentPackageVersionResourceRepository linkRepository;
    private final ContentPackageVersionRepository packageVersionRepository;
    private final ContentPackageRepository packageRepository;

    @Transactional(readOnly = true)
    public List<ResourcePackageUsageResponse> listUsages(String libraryResourceId) {
        LearningResource source = requireLibraryResource(libraryResourceId);
        LearningResourceVersion sourceVersion = activeVersion(source);
        String sourceContent = sourceVersion != null ? sourceVersion.getContent() : null;

        List<LearningResource> copies = resourceRepository.findBySourceResourceIdAndDeletedFalse(libraryResourceId);
        if (copies.isEmpty()) return List.of();
        Map<String, LearningResource> copiesById = copies.stream()
                .collect(Collectors.toMap(LearningResource::getId, Function.identity()));

        List<ContentPackageVersionResource> links = linkRepository.findByLearningResourceIdInAndDeletedFalse(copiesById.keySet());
        if (links.isEmpty()) return List.of();

        Map<String, ContentPackageVersion> versions = packageVersionRepository.findAllById(
                        links.stream().map(ContentPackageVersionResource::getContentPackageVersionId).distinct().toList())
                .stream().filter(v -> !v.isDeleted()).collect(Collectors.toMap(ContentPackageVersion::getId, Function.identity()));
        Map<String, ContentPackage> packages = packageRepository.findByIdInAndDeletedFalse(
                        versions.values().stream().map(ContentPackageVersion::getPackageId).distinct().toList())
                .stream().collect(Collectors.toMap(ContentPackage::getId, Function.identity()));
        Map<String, LearningResourceVersion> linkedVersions = resourceVersionRepository.findByIdInAndDeletedFalse(
                        links.stream().map(ContentPackageVersionResource::getLearningResourceVersionId).distinct().toList())
                .stream().collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));

        List<ResourcePackageUsageResponse> result = new ArrayList<>();
        for (ContentPackageVersionResource link : links) {
            ContentPackageVersion version = versions.get(link.getContentPackageVersionId());
            if (version == null) continue;
            ContentPackage pkg = packages.get(version.getPackageId());
            // Chỉ xét bản nháp và bản đang publish; các phiên bản cũ hơn không còn được dùng.
            if (pkg == null || !(version.getId().equals(pkg.getDraftVersionId()) || version.getId().equals(pkg.getPublishedVersionId()))) continue;
            LearningResourceVersion current = linkedVersions.get(link.getLearningResourceVersionId());
            boolean upToDate = current != null && sourceContent != null && sameJson(sourceContent, current.getContent());
            result.add(new ResourcePackageUsageResponse(
                    link.getId(), pkg.getId(), pkg.getType(), version.getTitle(), version.getId(), version.getStatus(),
                    link.getSessionNo(), link.getLearningResourceId(), upToDate));
        }
        return result;
    }

    // Trả về số liên kết đã được đồng bộ.
    public int sync(String libraryResourceId, List<String> linkIds) {
        LearningResource source = requireLibraryResource(libraryResourceId);
        LearningResourceVersion sourceVersion = activeVersion(source);
        if (sourceVersion == null) {
            throw new ApiException(ErrorCode.E200, "Tài nguyên trong Kho chưa có nội dung để đồng bộ");
        }
        Object content = sourceVersion.getContentAs(source.getType().contentClassOf(source.getSubType()), resourceService.getObjectMapper());

        Map<String, ResourcePackageUsageResponse> allowed = listUsages(libraryResourceId).stream()
                .collect(Collectors.toMap(ResourcePackageUsageResponse::linkId, Function.identity()));
        int synced = 0;
        for (String linkId : linkIds.stream().filter(Objects::nonNull).distinct().toList()) {
            if (!allowed.containsKey(linkId)) {
                throw new ApiException(ErrorCode.E227, "Liên kết không thuộc tài nguyên này hoặc không còn được dùng: " + linkId);
            }
            ContentPackageVersionResource link = linkRepository.findById(linkId)
                    .filter(l -> !l.isDeleted())
                    .orElseThrow(() -> new ApiException(ErrorCode.E227, "Không tìm thấy liên kết: " + linkId));
            LearningResourceVersion draft = resourceService.createDraftVersion(link.getLearningResourceId(), content);
            LearningResourceVersion published = resourceService.publishVersion(link.getLearningResourceId(), draft.getId());
            link.setLearningResourceVersionId(published.getId());
            linkRepository.save(link);
            synced++;
        }
        return synced;
    }

    private LearningResource requireLibraryResource(String id) {
        LearningResource resource = resourceService.getResource(id);
        if (!resource.isInLibrary()) {
            throw new ApiException(ErrorCode.E200, "Chỉ tài nguyên của Kho mới có thể đồng bộ");
        }
        return resource;
    }

    private LearningResourceVersion activeVersion(LearningResource resource) {
        String versionId = resource.getPublishedVersionId() != null ? resource.getPublishedVersionId() : resource.getDraftVersionId();
        return versionId == null ? null : resourceVersionRepository.findByIdAndDeletedFalse(versionId).orElse(null);
    }

    private boolean sameJson(String a, String b) {
        if (a == null || b == null) return false;
        try {
            var mapper = resourceService.getObjectMapper();
            return mapper.readTree(a).equals(mapper.readTree(b));
        } catch (Exception e) {
            return a.equals(b);
        }
    }
}
