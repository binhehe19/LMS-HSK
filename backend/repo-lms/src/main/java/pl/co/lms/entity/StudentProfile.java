package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;

/** LMS learning preferences; identity and passwords remain owned by Authentication. */
@Entity
@Table(name = "student_profiles", uniqueConstraints = @UniqueConstraint(name = "uq_student_profile_user", columnNames = "user_id"))
@Getter @Setter
public class StudentProfile extends BaseEntity {
    @Column(name = "user_id", nullable = false, length = 26) private String userId;
    @Column(length = 60) private String publicName;
    @Column(precision = 2, scale = 1) private BigDecimal targetBand;
    private LocalDate targetDate;
    @Column(nullable = false) private int weeklyMinutes = 150;
    @Column(nullable = false) private boolean leaderboardVisible = true;
}
