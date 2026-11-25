package pl.co.lms.service.game;

import base.co.common.exception.ApiException;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class QuadWordEngineTest {
    @Test void repeatedLettersUseOnlyTheAvailableCounts() {
        assertThat(QuadWordEngine.evaluate("HOTEL", "HELLO")).containsExactly("correct", "present", "present", "absent", "present");
        assertThat(QuadWordEngine.evaluate("COFFEE", "EEEEEE")).containsExactly("absent", "absent", "absent", "absent", "correct", "correct");
    }
    @Test void phrasesAndSeparatorsMatchTheExistingFrontendRules() {
        assertThat(QuadWordEngine.pattern("  Present   Simple ")).isEqualTo("_______ ______");
        assertThat(QuadWordEngine.pattern("well-known")).isEqualTo("____-_____");
        assertThat(QuadWordEngine.validate(" present  SIMPLE ", "Present Simple")).isEqualTo("PRESENTSIMPLE");
    }
    @Test void missingMalformedAndWrongLengthInputsAreRejected() {
        for (String input : new String[] { null, "", "hot", "hotels", "h0tel", "hôtel" })
            assertThatThrownBy(() -> QuadWordEngine.validate(input, "hotel")).isInstanceOf(ApiException.class);
    }
}
