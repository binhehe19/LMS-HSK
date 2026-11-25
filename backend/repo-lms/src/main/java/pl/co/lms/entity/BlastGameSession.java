package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

@Entity
@Table(name = "blast_game_sessions", indexes = @Index(name = "idx_blast_dataset_user", columnList = "dataset_key,user_id,score,elapsed_ms"))
@Getter
@Setter
public class BlastGameSession extends BaseEntity {
    @Column(name = "user_id", nullable = false, length = 26) private String userId;
    @Column(name = "display_name", nullable = false, length = 80) private String displayName;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private BlastGameSource source;
    @Column(name = "dataset_key", nullable = false, length = 64) private String datasetKey;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb") private String cards;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb") private String hits;
    @Column(name = "started_at", nullable = false) private Instant startedAt;
    @Column(name = "completed_at") private Instant completedAt;
    private Integer score;
    @Column(name = "elapsed_ms") private Integer elapsedMs;
    private Integer answered;
    @Column(name = "total_words", nullable = false) private int totalWords;
    private Integer mistakes;
    @Enumerated(EnumType.STRING) @Column(length = 16) private BlastGameEndReason reason;
    @Column(name = "new_best") private boolean newBest;
}
