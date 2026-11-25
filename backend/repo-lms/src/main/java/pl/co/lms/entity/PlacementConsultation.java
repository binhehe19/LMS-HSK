package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity @Getter @Setter
@Table(name = "placement_consultations", uniqueConstraints = @UniqueConstraint(name = "uk_placement_consultation_request", columnNames = {"user_id", "request_key"}),
        indexes = @Index(name = "idx_placement_consultation_status", columnList = "status, created_at"))
public class PlacementConsultation extends BaseEntity {
    @Column(nullable = false, length = 26) private String userId;
    @Column(nullable = false, length = 80) private String requestKey;
    @Column(nullable = false, length = 20) private String status = "REQUESTED";
    @Column(nullable = false) private Instant contactDueAt;
    @Column(length = 26) private String handledBy;
    @Column(length = 2000) private String internalNote;
}
