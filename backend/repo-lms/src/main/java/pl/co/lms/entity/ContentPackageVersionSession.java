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
 * Tên của một buổi trong một phiên bản học phần. Buổi vẫn được xác định bằng session_no (trên học liệu và chủ đề);
 * dòng này chỉ gắn thêm tên và là tùy chọn: buổi không có dòng vẫn hợp lệ. Mỗi (phiên bản, session_no) tối đa một dòng
 * chưa xóa (chỉ mục duy nhất từng phần tạo ở DatabaseIndexInitializer).
 */
@Entity
@Table(
    name = "content_package_version_sessions",
    indexes = @Index(name = "idx_cpvs_version_session", columnList = "content_package_version_id, session_no")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContentPackageVersionSession extends BaseEntity {

    @Column(name = "content_package_version_id", nullable = false, length = 26)
    private String contentPackageVersionId;

    @Column(name = "session_no", nullable = false)
    private int sessionNo;

    @Column(name = "title", nullable = false, length = 200)
    private String title;
}
