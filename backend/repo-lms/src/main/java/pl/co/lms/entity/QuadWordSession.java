package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

@Entity
@Table(name = "quad_word_sessions", indexes = {
    @Index(name = "idx_quad_user_source", columnList = "user_id,source,created_at"),
    @Index(name = "idx_quad_user_collection", columnList = "user_id,collection_key,status")
})
@Getter @Setter
public class QuadWordSession extends BaseEntity {
    @Column(name = "user_id", nullable = false, length = 26) private String userId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private QuadWordSource source;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private QuadWordStatus status;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb") private String candidate;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb") private String guesses;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "collection_key", length = 40) private String collectionKey;
    @Column(name = "collection_title", length = 200) private String collectionTitle;
    @Column(name = "collection_total") private Integer collectionTotal;
    @Column(name = "candidate_resource_id", length = 26) private String candidateResourceId;
}
