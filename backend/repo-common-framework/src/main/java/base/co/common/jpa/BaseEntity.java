package base.co.common.jpa;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import base.co.common.util.UlidGenerator;

import java.time.Instant;

@Getter
@Setter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @Id
    @Column(length = 26, nullable = false, updatable = false, columnDefinition = "varchar(26)")
    private String id;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @CreatedBy
    @Column(name = "created_by", length = 26, updatable = false)
    private String createdBy;

    @Column(nullable = false)
    private Instant updatedAt;

    @LastModifiedBy
    @Column(name = "updated_by", length = 26)
    private String updatedBy;

    @Column(nullable = false)
    private boolean deleted;

    @PrePersist
    public void onCreate() {
        Instant now = Instant.now();
        if (id == null) {
            id = UlidGenerator.nextUlid();
        }
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        deleted = false;
    }

    @PreUpdate
    public void onUpdate() {
        updatedAt = Instant.now();
    }
}
