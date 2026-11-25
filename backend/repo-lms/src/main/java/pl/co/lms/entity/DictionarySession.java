package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "dictionary_sessions", uniqueConstraints = @UniqueConstraint(name = "uq_dictionary_session_owner", columnNames = {"user_id", "lesson_id", "review"}),
       indexes = @Index(name = "idx_dictionary_session_user", columnList = "user_id,updated_at"))
@Getter @Setter
public class DictionarySession extends BaseEntity {
    @Column(name = "user_id", nullable = false, length = 26)
    private String userId;
    @Column(name = "lesson_id", nullable = false, length = 26)
    private String lessonId;
    @Column(nullable = false)
    private boolean review;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;
    @Column(name = "source_versions", nullable = false, columnDefinition = "TEXT")
    private String sourceVersions;
    @Column(nullable = false)
    private boolean completed;
    @Version
    private Long revision;
}
