package pl.co.lms.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;
import pl.co.lms.service.QuizContentChecks;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

// Mọi file seed phải đọc được thành QuizContent hợp lệ và layout chỉ tham chiếu tới câu hỏi có thật.
class AssessmentSeedFilesTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void everySeedParsesAndLayoutReferencesExistingQuestions() throws Exception {
        Resource[] files = new PathMatchingResourcePatternResolver().getResources("classpath*:seed/assessments/*.json");
        assertThat(files).hasSizeGreaterThanOrEqualTo(19);
        for (Resource file : files) {
            JsonNode root = mapper.readTree(file.getInputStream());
            assertThat(root.has("assessmentType")).as("tên cũ assessmentType: " + file.getFilename()).isFalse();
            assertThat(ResourceSubTypes.validate(pl.co.lms.entity.LearningResourceType.ASSESSMENT, root.path("subType").asText())).as(file.getFilename()).isNotNull();
            QuizContent content = mapper.treeToValue(root.path("content"), QuizContent.class);
            assertThat(content.getQuestions()).as(file.getFilename()).isNotEmpty();
            Set<String> ids = new HashSet<>();
            for (QuizQuestion q : content.getQuestions()) {
                assertThat(ids.add(q.getQuestionId())).as("duplicate id in " + file.getFilename()).isTrue();
                assertThat(q.getQuestionType()).isNotNull();
            }
            Set<String> referenced = new HashSet<>();
            collect(content.getLayout(), referenced);
            assertThat(ids).as(file.getFilename()).containsAll(referenced);
            assertThat(referenced).as(file.getFilename()).containsAll(ids);
            assertThat(content.limitSeconds("default")).isPositive();
            assertThat(root.path("content").has("timeLimitSeconds")).as("timeLimitSeconds is gone: " + file.getFilename()).isFalse();
            assertThat(content.getLayout().path("version").asInt()).as("layout v2: " + file.getFilename()).isEqualTo(2);
            assertThat(content.getLayout().path("meta").path("key").asText()).as("key: " + file.getFilename()).endsWith("-v2");
            assertThat(QuizContentChecks.problems(content)).as("content checks: " + file.getFilename()).isEmpty();
            String json = root.path("content").toString();
            assertThat(json).as("no legacy fields: " + file.getFilename())
                    .doesNotContain("\"groups\"").doesNotContain("\"paragraphs\"").doesNotContain("\"sources\"").doesNotContain("[BLANK]").doesNotContain("{{blank}}")
                    .doesNotContain("MATCHING_PAIRS").doesNotContain("\"TRUE_FALSE\"").doesNotContain("\"questionType\":\"MATCHING_");
            // Mọi seed Writing là câu ESSAY còn đủ dữ kiện chấm AI.
            if (root.path("subType").asText().equals(ResourceSubTypes.PRACTICE_WRITING)) {
                QuizQuestion essay = content.getQuestions().get(0);
                assertThat(essay.getAiRubric()).as(file.getFilename()).isEqualTo("IELTS_WRITING");
                assertThat(essay.getTask()).isNotNull();
                assertThat(essay.getMinimumWords()).isPositive();
            }
        }
    }

    private void collect(JsonNode node, Set<String> out) {
        if (node == null) return;
        if (node.isObject()) {
            if (node.has("questionIds")) node.get("questionIds").forEach(id -> out.add(id.asText()));
            node.fields().forEachRemaining(e -> collect(e.getValue(), out));
        } else if (node.isArray()) {
            node.forEach(n -> collect(n, out));
        }
    }
}