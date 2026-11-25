package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
    name = "learning_resource_versions",
    indexes = {
        @Index(name = "idx_lrv_resource_id", columnList = "resource_id")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LearningResourceVersion extends BaseEntity {

    @Column(name = "resource_id", nullable = false, length = 26)
    private String resourceId;

    @Column(nullable = false)
    private int version;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private LearningResourceVersionStatus status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content", columnDefinition = "jsonb")
    private String content;

    public <T> T getContentAs(Class<T> clazz, ObjectMapper mapper) {
        if (content == null || content.isBlank()) {
            return null;
        }
        try {
            return mapper.readValue(content, clazz);
        } catch (Exception e) {
            throw new IllegalArgumentException("Unable to deserialize content to " + clazz.getSimpleName(), e);
        }
    }

    public void setContentFrom(Object object, ObjectMapper mapper) {
        if (object == null) {
            this.content = null;
            return;
        }
        try {
            this.content = mapper.writeValueAsString(object);
        } catch (Exception e) {
            throw new IllegalArgumentException("Unable to serialize content", e);
        }
    }
}
