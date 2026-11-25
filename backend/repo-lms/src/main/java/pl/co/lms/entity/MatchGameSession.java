package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

@Entity
@Table(name = "match_game_sessions", indexes = {
    @Index(name = "idx_match_dataset_user", columnList = "dataset_key,user_id,score,elapsed_tenths")
})
@Getter @Setter
public class MatchGameSession extends BaseEntity {
    @Column(name = "user_id", nullable = false, length = 26) private String userId;
    @Column(name = "display_name", nullable = false, length = 80) private String displayName;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private MatchGameSource source;
    @Column(name = "dataset_key", nullable = false, length = 64) private String datasetKey;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "cards", nullable = false, columnDefinition = "jsonb") private String cards;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "moves", columnDefinition = "jsonb") private String moves;
    @Column(name = "started_at", nullable = false) private Instant startedAt;
    @Column(name = "completed_at") private Instant completedAt;
    private Integer score;
    @Column(name = "elapsed_tenths") private Integer elapsedTenths;
    private Integer mistakes;
    @Column(name = "matched_pairs") private Integer matchedPairs;
    @Column(name = "new_best") private boolean newBest;
}
