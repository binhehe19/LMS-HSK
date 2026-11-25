package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Chủ đề (nhóm có tên) trong một buổi của một phiên bản học phần. Tồn tại độc lập với học liệu để chủ đề rỗng vẫn được giữ;
 * học liệu trỏ tới chủ đề bằng ContentPackageVersionResource.topicId (null = không chủ đề).
 */
@Entity
@Table(
    name = "content_package_version_topics",
    indexes = @Index(name = "idx_cpvt_version_session_order", columnList = "content_package_version_id, session_no, topic_order")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContentPackageVersionTopic extends BaseEntity {

    @Column(name = "content_package_version_id", nullable = false, length = 26)
    private String contentPackageVersionId;

    @Column(name = "session_no", nullable = false)
    private int sessionNo;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "topic_order", nullable = false)
    private int topicOrder;
}
