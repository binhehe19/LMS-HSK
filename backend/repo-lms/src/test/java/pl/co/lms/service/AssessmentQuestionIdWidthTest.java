package pl.co.lms.service;
import org.junit.jupiter.api.Test;
import jakarta.persistence.Column;
import pl.co.lms.entity.AssessmentAnswer;
import pl.co.lms.entity.AssessmentAnswerGradingHistory;
import static org.assertj.core.api.Assertions.assertThat;
class AssessmentQuestionIdWidthTest {
 @Test void answerAndGradingHistoryAcceptLegacyUuidQuestionIds() throws Exception {
  String id="123e4567-e89b-12d3-a456-426614174000";
  for(Class<?> type : new Class<?>[]{AssessmentAnswer.class,AssessmentAnswerGradingHistory.class})
   assertThat(type.getDeclaredField("questionId").getAnnotation(Column.class).length()).isGreaterThanOrEqualTo(id.length());
  assertThat(AssessmentAnswer.builder().questionId(id).build().getQuestionId()).isEqualTo(id);
  assertThat(AssessmentAnswerGradingHistory.builder().questionId(id).build().getQuestionId()).isEqualTo(id);
 }
}
