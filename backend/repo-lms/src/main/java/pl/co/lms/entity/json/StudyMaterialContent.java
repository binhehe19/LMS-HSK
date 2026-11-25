package pl.co.lms.entity.json;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;
import pl.co.lms.entity.StudyMaterialCategory;
import java.util.List;

/** Versioned editorial content. Paragraphs are plain text; offsets use UTF-16, as in JavaScript. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class StudyMaterialContent {
    private StudyMaterialCategory category;
    private String title;
    private String subtitle;
    private String description;
    private String imageUrl;
    private String topic;
    private String band;
    private String source;
    private String cefrLevel;
    private Boolean academicWordList;
    @Builder.Default private String tier = "free";
    @Builder.Default private String skill = "Reading";
    private Integer minutes;
    private String part;
    @Builder.Default private List<Paragraph> paragraphs = List.of();
    @Builder.Default private List<Section> sections = List.of();
    // Reuse the same storage-file descriptor as the existing MATERIAL/SLIDE resources.
    private SlideMaterialContent file;
    private Integer pageCount;
    private SlideMaterialContent video;
    private String videoUrl;
    private Integer durationSeconds;
    @Builder.Default private List<Chapter> chapters = List.of();
    // null = ask the authoring service to detect; [] = intentionally do not link any words.
    private List<VocabularyLink> vocabularyLinks;
    private VocabularyUnit vocabularyUnit;
    // Kết quả dò dùng chung cho phiên bản bài; trạng thái học viên không nằm trong đây.
    private VocabularyIndex vocabularyIndex;

    public record Paragraph(String en, String vi) {}
    public record Section(String title, String text, Integer page) {}
    public record Chapter(int seconds, String title) {}
    public record VocabularyLink(String resourceId, List<String> variants) {}
    public record VocabularyUnit(String packageVersionId, int sessionNo) {}
    public record VocabularyVersion(String resourceId, String versionId) {}
    public record VocabularyOccurrence(String resourceId, int paragraphIndex, String language, int start, int end, String surface) {}
    public record VocabularyIndex(List<VocabularyVersion> words, List<VocabularyOccurrence> highlights) {}
}
