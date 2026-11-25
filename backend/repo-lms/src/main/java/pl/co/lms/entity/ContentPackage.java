package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.DynamicUpdate;

import java.time.Instant;

@Entity
@DynamicUpdate
@Table(name = "content_packages")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContentPackage extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ContentPackageType type;

    // Học phần thuộc nhiều nhất một syllabus (ID bên CMS, không FK cứng); null = học phần tự do (chưa thuộc giáo trình nào).
    // syllabusVersionId = phiên bản syllabus lúc gắn/kiểm tra gần nhất, luôn đi cùng syllabusId.
    @Column(name = "syllabus_id", length = 100)
    private String syllabusId;

    @Column(name = "syllabus_version_id", length = 100)
    private String syllabusVersionId;

    @Column(name = "published_version_id", length = 26)
    private String publishedVersionId;

    @Column(name = "draft_version_id", length = 26)
    private String draftVersionId;

    // Khoá độc quyền màn Sửa — chỉ 1 phiên (tab) được sửa 1 package tại 1 thời điểm.
    @Column(name = "editing_user_id", length = 26)
    private String editingUserId;

    @Column(name = "editing_session_token", length = 64)
    private String editingSessionToken;

    @Column(name = "editing_lock_expires_at")
    private Instant editingLockExpiresAt;
}
