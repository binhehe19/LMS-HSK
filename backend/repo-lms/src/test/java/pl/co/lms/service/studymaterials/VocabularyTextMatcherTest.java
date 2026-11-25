package pl.co.lms.service.studymaterials;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import pl.co.lms.service.studymaterials.VocabularyTextMatcher.Term;

class VocabularyTextMatcherTest {
    @Test void matchesWholeWordsCaseInsensitivelyAndKeepsUtf16OffsetsIncludingEmoji() {
        String text = "🙂 The theme is HE, then he. He’s here.";
        var result = new VocabularyTextMatcher(List.of(new Term("he", "he"))).find(text);
        assertThat(result).extracting(VocabularyTextMatcher.Match::surface).containsExactly("HE", "he");
        assertThat(result).allSatisfy(match -> assertThat(text.substring(match.start(), match.end())).isEqualTo(match.surface()));
    }
    @Test void longerPhrasesWinAndWhitespaceDoesNotHideMatches() {
        var matcher = new VocabularyTextMatcher(List.of(new Term("short", "communication"), new Term("long", "communication skills")));
        var result = VocabularyTextMatcher.nonOverlapping(matcher.find("Communication\n skills and communication skills."));
        assertThat(result).extracting(VocabularyTextMatcher.Match::resourceId).containsExactly("long", "long");
        assertThat(matcher.find("communication, skills")).hasSize(1);
        assertThat(VocabularyTextMatcher.nonOverlapping(matcher.find("communication\u00a0skills"))).singleElement().extracting(VocabularyTextMatcher.Match::resourceId).isEqualTo("long");
    }
    @Test void variantsAreExplicitAndTermsWithPunctuationAreLiteral() {
        var matcher = new VocabularyTextMatcher(List.of(new Term("candidate", "candidate"), new Term("candidate", "candidates"), new Term("cpp", "C++"), new Term("apply", "apply")));
        assertThat(matcher.find("Candidates use C++, when applying.")).extracting(VocabularyTextMatcher.Match::resourceId).containsExactly("candidate", "cpp");
    }
    @Test void unicodeQuotesAndCombiningCharactersPreserveOriginalBoundaries() {
        var matcher = new VocabularyTextMatcher(List.of(new Term("word", "sustainable"), new Term("vi", "bền vững")));
        assertThat(matcher.find("‘Sustainable’ means bền vững.")).extracting(VocabularyTextMatcher.Match::resourceId).containsExactly("word", "vi");
    }
    @Test void previewPreservesAmbiguousDictionaryEntriesButHighlightsNeverOverlap() {
        var matcher = new VocabularyTextMatcher(List.of(new Term("bank-2", "bank"), new Term("bank-1", "bank")));
        var found = matcher.find("bank");
        assertThat(found).hasSize(2);
        assertThat(VocabularyTextMatcher.nonOverlapping(found)).singleElement().extracting(VocabularyTextMatcher.Match::resourceId).isEqualTo("bank-1");
    }

    @org.junit.jupiter.api.Test
    void lookupKeysCoverEveryTermTheMatcherCanFindWithTheWordKeyConvention() {
        String text = "We  take part in a Well-Known event.";
        var keys = VocabularyTextMatcher.lookupKeys(text, 10);
        // Mọi cụm mà find() khớp được đều có khoá tương ứng (khoá từ: chữ thường, khoảng trắng gộp một).
        var matcher = new VocabularyTextMatcher(java.util.List.of(
                new VocabularyTextMatcher.Term("a", "take part in"), new VocabularyTextMatcher.Term("b", "well-known"),
                new VocabularyTextMatcher.Term("c", "event")));
        for (var match : matcher.find(text)) {
            String term = match.surface().toLowerCase(java.util.Locale.ROOT).replaceAll("\\s+", " ");
            org.assertj.core.api.Assertions.assertThat(keys).contains(term);
        }
        org.assertj.core.api.Assertions.assertThat(keys).contains("take", "take part", "take part in", "well-known", "event", "event.");
        // Cụm dài hơn giới hạn token không sinh khoá.
        org.assertj.core.api.Assertions.assertThat(VocabularyTextMatcher.lookupKeys("a b c d", 2)).containsExactlyInAnyOrder("a", "a b", "b", "b c", "c", "c d", "d");
        org.assertj.core.api.Assertions.assertThat(VocabularyTextMatcher.lookupKeys(null, 5)).isEmpty();
    }
}
