package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import pl.co.lms.entity.json.QuizContent;

import static org.assertj.core.api.Assertions.assertThat;

class TimeLimitsTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void eachModeReadsItsOwnLimit_nullMeansUnlimited() throws Exception {
        QuizContent c = mapper.readValue("{\"timeLimits\":{\"default\":3600,\"hard\":1800,\"easy\":null}}", QuizContent.class);
        assertThat(c.limitSeconds("default")).isEqualTo(3600);
        assertThat(c.limitSeconds("hard")).isEqualTo(1800);
        assertThat(c.limitSeconds("easy")).isNull();
    }

    @Test
    void withoutTimeLimitsEveryModeIsUnlimited() throws Exception {
        QuizContent c = mapper.readValue("{\"timeLimitSeconds\":600}", QuizContent.class);
        assertThat(c.limitSeconds("default")).isNull();
        assertThat(c.limitSeconds("hard")).isNull();
    }

    @Test
    void missingModeKeyIsUnlimitedNotTheDefault() throws Exception {
        QuizContent c = mapper.readValue("{\"timeLimits\":{\"default\":3600}}", QuizContent.class);
        assertThat(c.limitSeconds("hard")).isNull();
    }

    @Test
    void serializesDefaultKeyAsDefault() throws Exception {
        QuizContent c = mapper.readValue("{\"timeLimits\":{\"default\":60}}", QuizContent.class);
        assertThat(mapper.writeValueAsString(c)).contains("\"default\":60");
    }
}