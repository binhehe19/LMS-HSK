package pl.co.lms.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pl.co.lms.entity.AssessmentAnswerGradingHistory;

import java.util.List;

public interface AssessmentAnswerGradingHistoryRepository extends JpaRepository<AssessmentAnswerGradingHistory, String> {
}
