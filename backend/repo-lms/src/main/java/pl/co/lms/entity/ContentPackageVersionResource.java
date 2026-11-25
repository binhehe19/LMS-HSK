package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import pl.co.lms.entity.json.PlacementSettings;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "content_package_version_resources",
    indexes = {
        @Index(name = "idx_cpvr_pkg_ver_session_order", columnList = "content_package_version_id, session_no, display_order"),
        @Index(name = "idx_cpvr_resource_id", columnList = "learning_resource_id")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContentPackageVersionResource extends BaseEntity {

    @Column(name = "content_package_version_id", nullable = false, length = 26)
    private String contentPackageVersionId;

    @Column(name = "learning_resource_id", nullable = false, length = 26)
    private String learningResourceId;

    @Column(name = "learning_resource_version_id", nullable = false, length = 26)
    private String learningResourceVersionId;

    @Column(name = "session_no", nullable = false)
    private int sessionNo;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    // Điều kiện của bài khi đặt vào học phần (null = chưa đặt). Xem PlacementSettings.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "settings", columnDefinition = "jsonb")
    private PlacementSettings settings;

    // Chủ đề (ContentPackageVersionTopic) chứa học liệu trong buổi; null = không chủ đề. Phải cùng phiên bản và cùng session_no với dòng này.
    @Column(name = "topic_id", length = 26)
    private String topicId;
}
