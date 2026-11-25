package pl.co.lms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LayoutFilterTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode layout() throws Exception {
        return mapper.readTree("""
                {"version":1,"sections":[{"id":"s1","grading":{"aiRubric":"IELTS_WRITING","referenceText":"secret"},
                  "explanation":{"transcript":[{"text":"hello"}]},
                  "groups":[{"questions":[{"questionId":"q1","prompt":"p","explanation":{"quote":"x"},
                     "meta":{"hints":[{"grading":"deep","keep":1}]}}]}]}]}
                """);
    }

    @Test
    void duringAttempt_stripsGradingAndExplanationAtAnyDepth() throws Exception {
        String json = LayoutFilter.forStudent(layout(), false).toString();
        assertThat(json).doesNotContain("grading", "explanation", "secret", "transcript", "quote", "deep")
                .contains("\"questionId\":\"q1\"", "\"keep\":1");
    }

    @Test
    void afterSubmit_keepsExplanationButStillStripsGrading() throws Exception {
        String json = LayoutFilter.forStudent(layout(), true).toString();
        assertThat(json).contains("transcript", "quote").doesNotContain("grading", "secret", "deep");
    }

    @Test
    void forGrader_keepsEverythingAndDoesNotMutateSource() throws Exception {
        JsonNode source = layout();
        String before = source.toString();
        assertThat(LayoutFilter.forGrader(source).toString()).isEqualTo(before);
        LayoutFilter.forStudent(source, false);
        assertThat(source.toString()).isEqualTo(before);
    }

    @Test
    void nullLayout_staysNull() {
        assertThat(LayoutFilter.forStudent(null, false)).isNull();
        assertThat(LayoutFilter.forGrader(null)).isNull();
    }
}