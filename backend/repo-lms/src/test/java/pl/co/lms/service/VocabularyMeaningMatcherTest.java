package pl.co.lms.service;

import org.junit.jupiter.api.Test;
import pl.co.lms.entity.json.VocabularyEnContent;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class VocabularyMeaningMatcherTest {
    @Test void acceptsAlternativesGlossesAndSmallTypos() {
        String[][] cases = {
                {"Cảnh báo, báo động / cảnh giác", "bao dong"},
                {"Sự cảnh báo (về nguy hiểm)", "cảnh báo"},
                {"Cảnh báo", "là sự cảnh báo"},
                {"Bền vững", "ben vug"},
                {"Cảnh báo", "canhh bao"},
                {"Cảnh báo", "cahh bao"},
                {"Cảnh báo", "cnah bao"},
                {"Có thể duy trì lâu dài", "co the duy tri lau daii"},
        };
        for (String[] item : cases)
            assertThat(VocabularyMeaningMatcher.matches(List.of(item[0]), item[1])).as("%s: %s", item[0], item[1]).isTrue();
    }

    @Test void rejectsFragmentsNegationOtherShortWordsAndUnrelatedAnswers() {
        String[][] cases = {
                {"Bền vững", "bền"}, {"Bền vững", "không bền vững"},
                {"Không bền vững", "bền vững"}, {"Cảnh báo", "cảnh cáo"},
                {"Cảnh báo", "cảnh báo sai"}, {"Tăng", "giảm"},
                {"Bền vững", "ô nhiễm"}, {"Bền vững", ""}, {"Bền vững", "???"},
        };
        for (String[] item : cases)
            assertThat(VocabularyMeaningMatcher.matches(List.of(item[0]), item[1])).as("%s: %s", item[0], item[1]).isFalse();
    }

    @Test void serviceUsesCommonMeaningAndDefinitionAlternatives() {
        var word = VocabularyEnContent.builder().commonMeaning("Cảnh báo, báo động").build();
        assertThat(DictionaryService.matchesMeaning(word, "báo động")).isTrue();
        word.setDefinitions(List.of(VocabularyEnContent.VocabularyDefinitionItem.builder().meaningVi("Cảnh giác").build()));
        assertThat(DictionaryService.matchesMeaning(word, "cảnh giác")).isTrue();
        assertThat(DictionaryService.matchesMeaning(word, "không cảnh giác")).isFalse();
        assertThat(DictionaryService.matchesMeaning(VocabularyEnContent.builder().build(), "cảnh báo")).isFalse();
    }
}
