package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionSession;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.ContentPackageVersionSessionRepository;

import java.util.List;

/** Tên buổi của phiên bản học phần: chỉ ghi được trên bản nháp. Xóa tên không xóa buổi hay học liệu (buổi vẫn hiện theo số). */
@Service
@RequiredArgsConstructor
@Transactional
public class ContentPackageVersionSessionService {

    static final int MAX_TITLE = 200;

    private final ContentPackageVersionSessionRepository sessionRepository;
    private final ContentPackageVersionRepository versionRepository;

    private void requireDraft(String versionId) {
        ContentPackageVersion version = versionRepository.findByIdAndDeletedFalse(versionId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "ContentPackageVersion not found: " + versionId));
        if (version.getStatus() != ContentPackageVersionStatus.DRAFT) {
            throw new ApiException(ErrorCode.E220, "Chỉ có thể sửa tên buổi của phiên bản đang DRAFT");
        }
    }

    private static void requireSessionNo(int sessionNo) {
        if (sessionNo < 1) throw new ApiException(ErrorCode.E200, "sessionNo must be >= 1");
    }

    private static String cleanTitle(String raw) {
        String title = raw == null ? "" : raw.strip();
        if (title.isEmpty()) throw new ApiException(ErrorCode.E200, "Tên buổi không được để trống");
        if (title.length() > MAX_TITLE) throw new ApiException(ErrorCode.E200, "Tên buổi tối đa " + MAX_TITLE + " ký tự");
        return title;
    }

    @Transactional(readOnly = true)
    public List<ContentPackageVersionSession> list(String versionId) {
        return sessionRepository.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAsc(versionId);
    }

    /** Đặt hoặc đổi tên buổi; gọi lại với cùng buổi chỉ đổi tên (vẫn một dòng). */
    public ContentPackageVersionSession set(String versionId, int sessionNo, String rawTitle) {
        requireDraft(versionId);
        requireSessionNo(sessionNo);
        String title = cleanTitle(rawTitle);
        ContentPackageVersionSession session = sessionRepository
                .findByContentPackageVersionIdAndSessionNoAndDeletedFalse(versionId, sessionNo)
                .orElseGet(() -> ContentPackageVersionSession.builder()
                        .contentPackageVersionId(versionId).sessionNo(sessionNo).build());
        session.setTitle(title);
        return sessionRepository.save(session);
    }

    /** Xóa tên buổi; không có tên thì không làm gì. */
    public void clear(String versionId, int sessionNo) {
        requireDraft(versionId);
        requireSessionNo(sessionNo);
        sessionRepository.findByContentPackageVersionIdAndSessionNoAndDeletedFalse(versionId, sessionNo).ifPresent(session -> {
            session.setDeleted(true);
            sessionRepository.save(session);
        });
    }
}
