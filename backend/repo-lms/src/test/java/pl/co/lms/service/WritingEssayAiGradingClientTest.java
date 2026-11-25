package pl.co.lms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import pl.co.lms.entity.ExerciseQuestionType;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.service.grading.ai.AiGradingClient;
import pl.co.lms.service.grading.ai.WritingAiGradingClient;
import pl.co.lms.service.grading.ai.WritingEssayAiGradingClient;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WritingEssayAiGradingClientTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @SuppressWarnings("unchecked")
    private WritingEssayAiGradingClient client(WritingAiGradingClient chat) {
        ObjectProvider<WritingAiGradingClient> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(chat);
        return new WritingEssayAiGradingClient(provider, mapper);
    }

    // Cấu hình chấm AI nằm ngay trên câu ESSAY; đề bài là questionText của câu.
    private QuestionContent essay() {
        return QuestionContent.builder().questionType(ExerciseQuestionType.ESSAY).aiRubric("IELTS_WRITING")
                .questionText("<p>Describe the <b>chart</b></p>").task(1).minimumWords(150).referenceText("ref").build();
    }

    @Test
    void supportsOnlyEssayWithRubricAndProvider() {
        WritingAiGradingClient chat = mock(WritingAiGradingClient.class);
        assertThat(client(chat).supports(essay())).isTrue();
        QuestionContent noRubric = QuestionContent.builder().questionType(ExerciseQuestionType.ESSAY).questionText("x").build();
        assertThat(client(chat).supports(noRubric)).isFalse();
        assertThat(client(chat).supports(null)).isFalse();
        assertThat(client(null).supports(essay())).isFalse();
        QuestionContent audio = QuestionContent.builder().questionType(ExerciseQuestionType.AUDIO_RESPONSE).aiRubric("IELTS_WRITING").build();
        assertThat(client(chat).supports(audio)).isFalse();
    }

    @Test
    void grade_readsPromptFromTheQuestionAndScalesToQuestionPoints() throws Exception {
        WritingAiGradingClient chat = mock(WritingAiGradingClient.class);
        when(chat.grade(any(), eq("my essay"))).thenReturn(mapper.readTree(
                "{\"criteria\":[{\"id\":\"task\",\"bandScore\":7,\"feedback\":\"a\"},{\"id\":\"coherence\",\"bandScore\":6.5,\"feedback\":\"b\"},{\"id\":\"lexical\",\"bandScore\":6.5,\"feedback\":\"c\"},{\"id\":\"grammar\",\"bandScore\":6,\"feedback\":\"d\"}],\"feedback\":\"ok\"}"));

        AiGradingClient.Result r = client(chat).grade(new AiGradingClient.Request(essay(), "{\"text\":\"my essay\"}", BigDecimal.valueOf(9)));

        assertThat(r.score()).isEqualByComparingTo("6.5");
        ArgumentCaptor<JsonNode> test = ArgumentCaptor.forClass(JsonNode.class);
        verify(chat).grade(test.capture(), eq("my essay"));
        assertThat(test.getValue().path("prompt").asText()).isEqualTo("Describe the chart");
        assertThat(test.getValue().path("task").asInt()).isEqualTo(1);
        assertThat(test.getValue().path("minimumWords").asInt()).isEqualTo(150);
        assertThat(test.getValue().path("referenceText").asText()).isEqualTo("ref");
    }

    @Test
    void grade_withoutRubricFails() {
        WritingAiGradingClient chat = mock(WritingAiGradingClient.class);
        QuestionContent noRubric = QuestionContent.builder().questionType(ExerciseQuestionType.ESSAY).questionText("x").build();
        assertThatThrownBy(() -> client(chat).grade(new AiGradingClient.Request(noRubric, "{\"text\":\"x\"}", BigDecimal.valueOf(9))))
                .isInstanceOf(IllegalStateException.class);
    }
}
