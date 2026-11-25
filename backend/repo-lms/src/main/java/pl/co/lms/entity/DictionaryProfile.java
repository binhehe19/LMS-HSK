package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "dictionary_profiles", uniqueConstraints = @UniqueConstraint(name = "uq_dictionary_profile_user", columnNames = "user_id"))
@Getter @Setter
public class DictionaryProfile extends BaseEntity {
    @Column(name = "user_id", nullable = false, length = 26)
    private String userId;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;
}
