package pl.co.lms.service.game;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import pl.co.lms.entity.*;
import pl.co.lms.repository.LearningResourceVersionRepository;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class QuadWordCandidateProviderTest {
    LearningResourceVersionRepository versions = mock(LearningResourceVersionRepository.class);
    QuadWordCandidateProvider provider = new QuadWordCandidateProvider(versions, new ObjectMapper());
    @Test void vocabularyPreservesSanitizedOptionalReviewMaterial() throws Exception {
        var candidate = provider.convert(version("""
            {"word":"<b>hotel</b>","ukPhonetic":"/həʊˈtel/","ukAudioUrl":"/api/storage/file/hotel-uk","definitions":[
              {},
              {"meaningVi":"<script>evil()</script><b>khách sạn</b>","definitionEn":"A place to stay","exampleEn":"A hotel.","exampleVi":"Một khách sạn."}]}
            """));
        assertThat(candidate.answer()).isEqualTo("hotel"); assertThat(candidate.meaning()).isEqualTo("khách sạn");
        assertThat(candidate.review().definition()).isEqualTo("A place to stay");
        assertThat(candidate.review().exampleVi()).isEqualTo("Một khách sạn.");
        assertThat(candidate.review().phonetic()).isEqualTo("/həʊˈtel/");
        assertThat(candidate.review().audioUrl()).isEqualTo("/api/storage/file/hotel-uk");
        assertThat(candidate.review().audioAccent()).isEqualTo("UK");
    }
    @Test void usPronunciationUsesMatchingIpaAndAudioAndOldReviewsRemainReadable() throws Exception {
        var candidate=provider.convert(version("""
            {"word":"hotel","usPhonetic":"/hoʊˈtel/","usAudioUrl":"https://example.test/hotel-us.mp3",
             "definitions":[{"meaningVi":"khách sạn"}]}
            """));
        assertThat(candidate.review().phonetic()).isEqualTo("/hoʊˈtel/");
        assertThat(candidate.review().audioAccent()).isEqualTo("US");
        assertThat(candidate.review().audioUrl()).isEqualTo("https://example.test/hotel-us.mp3");
        var legacy=new ObjectMapper().readValue("{\"answer\":\"hotel\",\"phonetic\":\"/həʊˈtel/\"}",pl.co.lms.entity.json.QuadWordReview.class);
        assertThat(legacy.phonetic()).isEqualTo("/həʊˈtel/");
        assertThat(legacy.audioUrl()).isNull();
        assertThat(legacy.audioAccent()).isNull();
    }
    @Test void missingArbitraryOrAnswerRevealingMeaningsDoNotBlockWords() throws Exception {
        for (String content : List.of("{\"word\":\"hotel\"}",
                "{\"word\":\"hotel\",\"definitions\":[{\"meaningVi\":\"hotel là khách sạn\"}]}",
                "{\"word\":\"hotel\",\"definitions\":[{\"meaningVi\":\"A place to stay\"}]}",
                "{\"word\":\"phuong\",\"cefrLevel\":\"B1\",\"definitions\":[{\"meaningVi\":\"d\"}]}",
                "{\"word\":\"hotel\",\"definitions\":null}")) {
            var candidate = provider.convert(version(content));
            assertThat(candidate).isNotNull();
            assertThat(candidate.review()).isNotNull();
        }
    }
    @Test void commonMeaningIsAnOptionalReviewFallbackAndInvalidSpellingsStayExcluded() throws Exception {
        var candidate = provider.convert(version("{\"word\":\"hotel\",\"commonMeaning\":\"<p>khách sạn</p>\"}"));
        assertThat(candidate.meaning()).isEqualTo("khách sạn");
        assertThat(candidate.review().definition()).isEmpty();
        for (String answer : List.of("", "zztest4999", "hôtel", "word!", "a".repeat(81)))
            assertThat(provider.convert(version("{\"word\":\"" + answer + "\"}"))).isNull();
    }
    @Test void candidatesDeduplicateAndSkipMalformedOrUnpublishedVersions() {
        var good = version("{\"word\":\"hotel\",\"definitions\":[{\"meaningVi\":\"khách sạn\"}]}");
        var draft = version(good.getContent()); draft.setStatus(LearningResourceVersionStatus.DRAFT);
        var deleted = version(good.getContent()); deleted.setDeleted(true);
        when(versions.findPublishedGameContent(eq(LearningResourceType.VOCABULARY), any()))
                .thenReturn(new PageImpl<>(List.of(good, version(good.getContent()), version("invalid"), draft, deleted)));
        var pool = provider.candidates();
        assertThat(pool).hasSize(1);
        assertThat(provider.choose(pool, "HOTEL")).isEqualTo(pool.getFirst());
        assertThat(provider.choose(List.of(), null)).isNull();
    }
    @Test void avoidsImmediatelyRepeatingThePreviousNormalizedAnswer() throws Exception {
        var hotel = provider.convert(version("{\"word\":\"hotel\",\"definitions\":[{\"meaningVi\":\"khách sạn\"}]}"));
        var ocean = provider.convert(version("{\"word\":\"ocean\",\"definitions\":[{\"meaningVi\":\"đại dương\"}]}"));
        assertThat(provider.choose(List.of(hotel, ocean), "hotel")).isEqualTo(ocean);
    }
    private LearningResourceVersion version(String json) {
        var v = new LearningResourceVersion(); v.setId("v"); v.setResourceId("r"); v.setStatus(LearningResourceVersionStatus.PUBLISHED); v.setContent(json); return v;
    }

    @Test void collectionsScanAllWordsAndExposeEveryLevelWithoutAMinimumSize() {
        var entries = new java.util.ArrayList<LearningResourceVersion>();
        for (int i = 0; i < 501; i++) {
            String term = "word" + (char) ('a' + i / 26) + (char) ('a' + i % 26);
            var entry = version("{\"word\":\"" + term + "\",\"cefrLevel\":\"B2\",\"definitions\":[{\"meaningVi\":\"khách sạn\"}]}");
            entry.setId("v" + i); entry.setResourceId("r" + i); entries.add(entry);
        }
        // Duplicate spelling and a small level must not inflate the playable set.
        entries.add(version(entries.getFirst().getContent()));
        entries.add(version("{\"word\":\"hotel\",\"cefrLevel\":\"B1\",\"definitions\":[{\"meaningVi\":\"khách sạn\"}]}"));
        when(versions.findPublishedGameContent(eq(LearningResourceType.VOCABULARY), any())).thenAnswer(invocation -> {
            org.springframework.data.domain.Pageable page = invocation.getArgument(1);
            int from = (int) page.getOffset(), to = Math.min(entries.size(), from + page.getPageSize());
            return new PageImpl<>(entries.subList(from, to), page, entries.size());
        });
        var collections = provider.collections();
        assertThat(collections).extracting(QuadWordCandidateProvider.Collection::id).containsExactly("ALL", "A2", "B1", "B2", "C1", "C2");
        assertThat(collections.getFirst().words()).hasSize(502);
        var b2 = collections.stream().filter(item -> item.id().equals("B2")).findFirst().orElseThrow();
        assertThat(b2.title()).isEqualTo("Khá (B2)");
        assertThat(b2.words()).hasSize(501);
        var b1 = collections.stream().filter(item -> item.id().equals("B1")).findFirst().orElseThrow();
        assertThat(b1.title()).isEqualTo("Trung cấp (B1)");
        assertThat(b1.words()).hasSize(1);
        assertThat(collections.stream().filter(item -> item.id().equals("C2")).findFirst().orElseThrow().words()).isEmpty();
        verify(versions, times(3)).findPublishedGameContent(eq(LearningResourceType.VOCABULARY), any());
    }
}
