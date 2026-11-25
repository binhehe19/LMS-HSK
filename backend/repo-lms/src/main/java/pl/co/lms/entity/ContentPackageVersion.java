package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "content_package_versions",
    indexes = {
        @Index(name = "idx_cpv_package_id", columnList = "package_id")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContentPackageVersion extends BaseEntity {

    @Column(name = "package_id", nullable = false, length = 26)
    private String packageId;

    @Column(nullable = false)
    private int version;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContentPackageVersionStatus status;

    @Column(length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 120)
    private String topic;

    @Column(length = 20)
    private String level;

    @Column(name = "code_name", length = 120)
    private String codeName;

    @Column(name = "skill_type", length = 30)
    private String skillType;

    @Column(length = 30)
    private String category;

    // Số buổi của học phần ở phiên bản này: các buổi 1..sessionCount đều tồn tại kể cả khi chưa có tài nguyên nào
    // (buổi trống). Số buổi thực tế = max(sessionCount, buổi lớn nhất có tài nguyên). Null = dữ liệu cũ, chưa lưu.
    @Column(name = "session_count")
    private Integer sessionCount;
}
