package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Educator-assessed autonomy. Null is unassessed; values 1..4 correspond to the four segments. */
@Entity
@Table(name = "learning_orbit_space")
@Getter
@Setter
@NoArgsConstructor
public class LearningOrbitSpace extends BaseEntity {
    @Column(name = "user_id", nullable = false, unique = true, length = 26)
    private String userId;
    private Integer scopeLevel;
    private Integer probeLevel;
    private Integer assembleLevel;
    private Integer communicateLevel;
    private Integer evaluateLevel;
    @Column(length = 1000)
    private String recommendation;
    @Version
    private Long revision;
}
