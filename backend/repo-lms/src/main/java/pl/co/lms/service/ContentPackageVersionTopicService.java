package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.entity.ContentPackageVersionTopic;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.repository.ContentPackageVersionTopicRepository;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;

/** Chủ đề trong một buổi của phiên bản học phần: chỉ ghi được trên bản nháp. Xóa chủ đề không xóa học liệu (học liệu về "không chủ đề"). */
@Service
@RequiredArgsConstructor
@Transactional
public class ContentPackageVersionTopicService {

    static final int MAX_TITLE = 200;

    private final ContentPackageVersionTopicRepository topicRepository;
    private final ContentPackageVersionResourceRepository linkRepository;
    private final ContentPackageVersionRepository versionRepository;

    private void requireDraft(String versionId) {
        ContentPackageVersion version = versionRepository.findByIdAndDeletedFalse(versionId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "ContentPackageVersion not found: " + versionId));
        if (version.getStatus() != ContentPackageVersionStatus.DRAFT) {
            throw new ApiException(ErrorCode.E220, "Chỉ có thể sửa chủ đề của phiên bản đang DRAFT");
        }
    }

    private ContentPackageVersionTopic getTopic(String versionId, String topicId) {
        ContentPackageVersionTopic topic = topicRepository.findByIdAndDeletedFalse(topicId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Chủ đề không tồn tại: " + topicId));
        if (!topic.getContentPackageVersionId().equals(versionId)) {
            throw new ApiException(ErrorCode.E227, "Chủ đề không thuộc phiên bản này: " + topicId);
        }
        return topic;
    }

    private static String cleanTitle(String raw) {
        String title = raw == null ? "" : raw.strip();
        if (title.isEmpty()) throw new ApiException(ErrorCode.E200, "Tên chủ đề không được để trống");
        if (title.length() > MAX_TITLE) throw new ApiException(ErrorCode.E200, "Tên chủ đề tối đa " + MAX_TITLE + " ký tự");
        return title;
    }

    private void requireUniqueTitle(String versionId, int sessionNo, String title, String exceptId) {
        boolean taken = topicRepository.findByContentPackageVersionIdAndSessionNoAndDeletedFalseOrderByTopicOrderAsc(versionId, sessionNo).stream()
                .anyMatch(t -> !t.getId().equals(exceptId) && t.getTitle().toLowerCase(Locale.ROOT).equals(title.toLowerCase(Locale.ROOT)));
        if (taken) throw new ApiException(ErrorCode.E220, "Buổi này đã có chủ đề tên \"" + title + "\"");
    }

    @Transactional(readOnly = true)
    public List<ContentPackageVersionTopic> list(String versionId, Integer sessionNo) {
        return sessionNo != null
                ? topicRepository.findByContentPackageVersionIdAndSessionNoAndDeletedFalseOrderByTopicOrderAsc(versionId, sessionNo)
                : topicRepository.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscTopicOrderAsc(versionId);
    }

    public ContentPackageVersionTopic create(String versionId, int sessionNo, String rawTitle) {
        requireDraft(versionId);
        if (sessionNo < 1) throw new ApiException(ErrorCode.E200, "sessionNo must be >= 1");
        String title = cleanTitle(rawTitle);
        requireUniqueTitle(versionId, sessionNo, title, null);
        int next = topicRepository.findByContentPackageVersionIdAndSessionNoAndDeletedFalseOrderByTopicOrderAsc(versionId, sessionNo).stream()
                .mapToInt(ContentPackageVersionTopic::getTopicOrder).max().orElse(-1) + 1;
        return topicRepository.save(ContentPackageVersionTopic.builder()
                .contentPackageVersionId(versionId).sessionNo(sessionNo).title(title).topicOrder(next).build());
    }

    public ContentPackageVersionTopic rename(String versionId, String topicId, String rawTitle) {
        requireDraft(versionId);
        ContentPackageVersionTopic topic = getTopic(versionId, topicId);
        String title = cleanTitle(rawTitle);
        requireUniqueTitle(versionId, topic.getSessionNo(), title, topicId);
        topic.setTitle(title);
        return topicRepository.save(topic);
    }

    /** Danh sách phải đúng bằng tập chủ đề hiện có của buổi (không thiếu, không thừa, không trùng). */
    public void reorder(String versionId, int sessionNo, List<String> topicIdsInOrder) {
        requireDraft(versionId);
        List<ContentPackageVersionTopic> topics = topicRepository
                .findByContentPackageVersionIdAndSessionNoAndDeletedFalseOrderByTopicOrderAsc(versionId, sessionNo);
        var expected = new HashSet<>(topics.stream().map(ContentPackageVersionTopic::getId).toList());
        if (topicIdsInOrder.size() != expected.size() || !expected.equals(new HashSet<>(topicIdsInOrder))) {
            throw new ApiException(ErrorCode.E200, "Danh sách chủ đề phải gồm đúng các chủ đề hiện có của buổi");
        }
        for (ContentPackageVersionTopic topic : topics) {
            topic.setTopicOrder(topicIdsInOrder.indexOf(topic.getId()));
        }
        topicRepository.saveAll(topics);
    }

    public void delete(String versionId, String topicId) {
        requireDraft(versionId);
        ContentPackageVersionTopic topic = getTopic(versionId, topicId);
        List<ContentPackageVersionResource> members = linkRepository
                .findByContentPackageVersionIdAndSessionNoAndDeletedFalseOrderByDisplayOrderAsc(versionId, topic.getSessionNo()).stream()
                .filter(l -> topicId.equals(l.getTopicId())).toList();
        members.forEach(l -> l.setTopicId(null));
        linkRepository.saveAll(members);
        topic.setDeleted(true);
        topicRepository.save(topic);
    }
}
