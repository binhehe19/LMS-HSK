package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import pl.co.lms.entity.LanguagePracticeMode;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.entity.json.AudioPracticeContent;
import pl.co.lms.repository.LearningResourceVersionRepository;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class LanguagePracticeCatalogTest {
    private final ObjectMapper mapper = new ObjectMapper();

    private LearningResourceVersion lesson(String id, boolean shadowing, boolean dictation, boolean video) {
        var version = LearningResourceVersion.builder().resourceId(id).build();
        version.setContentFrom(AudioPracticeContent.builder().title(id).description("Lesson description")
                .level("A2").youtubeVideoId(video ? "dQw4w9WgXcQ" : null).audioFileId(video ? null : "file-1")
                .durationMillis(30000L).shadowingEnabled(shadowing).dictationEnabled(dictation)
                .segments(List.of(AudioPracticeContent.AudioPracticeSegment.builder().segmentNo(1)
                        .transcript("secret transcript").acceptedDictationAnswers(List.of("secret accepted answer")).build())).build(), mapper);
        return version;
    }

    @Test void catalogFiltersEnabledModesAndReturnsMetadataWithoutAnswers() throws Exception {
        var versions = mock(LearningResourceVersionRepository.class);
        var service = new LanguagePracticeService(null, versions, null, null, mapper);
        var invalid = LearningResourceVersion.builder().resourceId("invalid").build();
        invalid.setContentFrom(AudioPracticeContent.builder().segments(List.of()).build(), mapper);
        when(versions.findPublishedGameContent(LearningResourceType.AUDIO_PRACTICE, Pageable.unpaged()))
                .thenReturn(new PageImpl<>(List.of(lesson("video", true, true, true), lesson("audio", false, true, false), invalid)));
        assertThat(service.catalog(LanguagePracticeMode.SHADOWING)).extracting(item -> item.id()).containsExactly("video");
        var items = service.catalog(LanguagePracticeMode.DICTATION);
        assertThat(items).extracting(item -> item.media()).containsExactly("video", "audio");
        assertThat(items).allSatisfy(item -> { assertThat(item.durationMillis()).isEqualTo(30000); assertThat(item.segmentCount()).isEqualTo(1); });
        assertThat(mapper.writeValueAsString(items)).doesNotContain("secret", "transcript", "acceptedDictationAnswers", "audioFileId");
    }
}
