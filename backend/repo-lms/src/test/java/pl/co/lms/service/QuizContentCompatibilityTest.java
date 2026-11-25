package pl.co.lms.service;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import pl.co.lms.entity.ExerciseQuestionType;
import pl.co.lms.entity.json.QuizContent;
import static org.assertj.core.api.Assertions.*;
class QuizContentCompatibilityTest {
 private final ObjectMapper mapper = new ObjectMapper();
 @Test void readsImportedMatchingWithoutChangingCanonicalOutput() throws Exception {
  var quiz = mapper.readValue("""
   {"title":"Imported quiz","questions":[{"questionId":"q1","questionType":"MATCHING_PAIRS","matchingPairs":[{"pairIndex":0,"prompt":"Dog","answer":"Mammal"}]}]}
   """, QuizContent.class);
  assertThat(quiz.getQuestions().getFirst().getQuestionType()).isEqualTo(ExerciseQuestionType.MATCHING);
  assertThat(quiz.getQuestions().getFirst().getMatchingPairs().getFirst().getAnswer()).isEqualTo("Mammal");
  assertThat(mapper.writeValueAsString(quiz)).contains("\"questionType\":\"MATCHING\"");
 }
 @Test void supportsEveryCanonicalTypeAndRejectsUnknownValues() throws Exception {
  for (var type : ExerciseQuestionType.values()) assertThat(mapper.readValue("\""+type.name()+"\"", ExerciseQuestionType.class)).isEqualTo(type);
  assertThatThrownBy(()->mapper.readValue("\"UNKNOWN\"", ExerciseQuestionType.class)).isInstanceOf(Exception.class);
 }
}
