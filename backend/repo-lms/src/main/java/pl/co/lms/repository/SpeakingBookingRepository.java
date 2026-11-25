package pl.co.lms.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.*;
import pl.co.lms.entity.SpeakingBooking;
import java.util.List;
public interface SpeakingBookingRepository extends JpaRepository<SpeakingBooking,String> {
    List<SpeakingBooking> findByUserIdAndDeletedFalseOrderByCreatedAtDesc(String user);
    Page<SpeakingBooking> findByDeletedFalseOrderByCreatedAtDesc(Pageable page);
}
