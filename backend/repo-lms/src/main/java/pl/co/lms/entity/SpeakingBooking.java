package pl.co.lms.entity;
import base.co.common.jpa.BaseEntity;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
@Entity @Getter @Setter @Table(name="speaking_bookings")
public class SpeakingBooking extends BaseEntity {
    @Column(nullable=false,length=26) private String userId;
    @Column(length=100) private String testKey;
    @Column(nullable=false,length=20) private String status="REQUESTED";
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") private JsonNode request;
}
