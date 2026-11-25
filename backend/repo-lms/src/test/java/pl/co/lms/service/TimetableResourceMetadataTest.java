package pl.co.lms.service;
import org.junit.jupiter.api.Test;
import pl.co.lms.dto.response.ContentPackageVersionResourceResponse;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.LearningResourceType;
import java.time.Instant;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
class TimetableResourceMetadataTest {
    private static final com.fasterxml.jackson.databind.ObjectMapper MAPPER = new com.fasterxml.jackson.databind.ObjectMapper();

    private static ContentPackageVersionResourceService.Metadata meta(String json) {
        return ContentPackageVersionResourceService.metadataOf(json, MAPPER);
    }

    @Test void metadataReadsTitleAndSkillFromRawJson() {
        var m = meta("{\"title\":\"Bài 1\",\"layout\":{\"meta\":{\"skill\":\"LISTENING\"}}}");
        assertThat(m.title()).isEqualTo("Bài 1");
        assertThat(m.skill()).isEqualTo("LISTENING");
    }

    @Test void metadataFallsBackToFileNameOnlyWhenTitleIsMissingOrNull() {
        assertThat(meta("{\"fileName\":\"slide.pdf\"}").title()).isEqualTo("slide.pdf");
        assertThat(meta("{\"title\":null,\"fileName\":\"slide.pdf\"}").title()).isEqualTo("slide.pdf");
        assertThat(meta("{\"title\":\"\",\"fileName\":\"slide.pdf\"}").title()).isEmpty();
        assertThat(meta("{\"title\":\"T\",\"fileName\":\"slide.pdf\"}").title()).isEqualTo("T");
    }

    @Test void metadataIsEmptyForMissingFieldsBlankOrBrokenJson() {
        assertThat(meta("{}").title()).isNull();
        assertThat(meta("{}").skill()).isNull();
        assertThat(meta("{\"layout\":{\"version\":2}}").skill()).isNull();
        assertThat(meta(null)).isEqualTo(new ContentPackageVersionResourceService.Metadata(null, null));
        assertThat(meta("  ")).isEqualTo(new ContentPackageVersionResourceService.Metadata(null, null));
        assertThat(meta("{not json")).isEqualTo(new ContentPackageVersionResourceService.Metadata(null, null));
    }

    @Test void studentMetadataNeverIncludesQuizContentOrSettings() {
        var resource = new ContentPackageVersionResourceResponse("link", "package", "resource", "version", 1, 0,
                LearningResourceType.ASSESSMENT, Map.of("questions", "private answers"), Instant.now())
                .withMetadata("Listening lesson", ResourceSubTypes.QUIZ, "LISTENING");
        var student = resource.withoutContent();
        assertThat(student.resourceContent()).isNull();
        assertThat(student.settings()).isNull();
        assertThat(student.resourceTitle()).isEqualTo("Listening lesson");
        assertThat(student.subType()).isEqualTo(ResourceSubTypes.QUIZ);
        assertThat(student.skill()).isEqualTo("LISTENING");
    }
}
