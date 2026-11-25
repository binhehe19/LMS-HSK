package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.ResourceSubTypes;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ResourceSearchColumnsTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void normalize_lowercasesRemovesVietnameseMarksAndCollapsesSpaces() {
        assertThat(ResourceSearchColumns.normalize("  Bền   VỮNG đẹp  ")).isEqualTo("ben vung dep");
        assertThat(ResourceSearchColumns.normalize("Đường")).isEqualTo("duong");
        assertThat(ResourceSearchColumns.normalize("Résumé")).isEqualTo("resume");
        assertThat(ResourceSearchColumns.normalize(null)).isEmpty();
        assertThat(ResourceSearchColumns.normalize("   ")).isEmpty();
    }

    @Test
    void wordKey_keepsAccentsSoResumeAndResumeAreDifferentWords() {
        assertThat(ResourceSearchColumns.wordKey("  Sus  Tain ")).isEqualTo("sus tain");
        assertThat(ResourceSearchColumns.wordKey("résumé")).isNotEqualTo(ResourceSearchColumns.wordKey("resume"));
        assertThat(ResourceSearchColumns.wordKey(" ")).isNull();
    }

    @Test
    void vocabulary_indexesWordMeaningsAndCollocationsAndTagsButNotExamples() {
        String json = """
                {"word":"Sustainable","cefrLevel":"b2","topic":" Environment ","commonMeaning":"bền vững",
                 "definitions":[{"meaningVi":"Có thể duy trì","definitionEn":"able to continue","exampleEn":"SECRETEXAMPLE"}],
                 "collocations":[{"pattern":"ADJ","words":["environmental","green"],"exampleEn":"SECRETCOLLOC"}],
                 "thesaurus":[{"relation":"SYNONYM","words":["durable"]}]}""";
        var v = ResourceSearchColumns.build(LearningResourceType.VOCABULARY, json, List.of("Figma demo", "IELTS"), mapper);

        assertThat(v.title()).isEqualTo("sustainable");
        assertThat(v.wordKey()).isEqualTo("sustainable");
        assertThat(v.cefrLevel()).isEqualTo("B2");
        assertThat(v.topic()).isEqualTo("Environment");
        assertThat(v.text()).contains("ben vung", "co the duy tri", "able to continue", "environmental", "green")
                .doesNotContain("secretexample", "secretcolloc", "durable", "adj");
        assertThat(v.tags()).isEqualTo("figma demo ielts");
    }

    @Test
    void vocabularyIsIndexedBySubType_enAndZhEachReadOnlyTheirOwnFields() throws Exception {
        String zhJson = """
                {"word":"好","hskLevel":1,"isSingleVocab":true,"radical":"女 nữ",
                 "pinyins":[{"pinyin":"hǎo","isPrimary":true,"wordTypes":"adj","meanings":[{"meaningVi":"tốt","meaningEn":"good","meaningZh":"口语","exampleSentenceZh":"很好"}]}],
                 "definitions":[{"meaningVi":"SHOULDNOTAPPEAR"}],"commonMeaning":"IGNOREDEN","cefrLevel":"A1","topic":"IGNORED"}""";
        var zh = ResourceSearchColumns.build(LearningResourceType.VOCABULARY, ResourceSubTypes.ZH, zhJson, null, mapper);
        assertThat(zh.text()).isEqualTo("hao");
        assertThat(zh.cefrLevel()).as("ZH has no CEFR level").isNull();
        assertThat(zh.topic()).isNull();
        var zhMeta = ResourceSearchColumns.vocabularyMetadata(ResourceSubTypes.ZH, mapper.readTree(zhJson));
        assertThat(zhMeta.facets()).contains("|level=1|", "|single=true|", "|wordType=adj|");

        String enJson = """
                {"word":"good","cefrLevel":"a1","commonMeaning":"tốt","hskLevel":3,
                 "pinyins":[{"pinyin":"SHOULDNOTAPPEAR","meanings":[{"meaningVi":"NOPE"}]}]}""";
        var en = ResourceSearchColumns.build(LearningResourceType.VOCABULARY, ResourceSubTypes.EN, enJson, null, mapper);
        assertThat(en.text()).contains("tot").doesNotContain("shouldnotappear", "nope");
        assertThat(en.cefrLevel()).isEqualTo("A1");
        var enMeta = ResourceSearchColumns.vocabularyMetadata(ResourceSubTypes.EN, mapper.readTree(enJson));
        assertThat(enMeta.facets()).as("EN has no HSK filters").isEmpty();
    }
    @Test
    void grammarAssessmentAndFilesUseTheirOwnTitleFields_andRichTextLosesItsTags() {
        var grammar = ResourceSearchColumns.build(LearningResourceType.GRAMMAR,
                "{\"title\":\"Thì hiện tại đơn\",\"generalDefinition\":\"<p>Diễn tả <b>thói quen</b></p>\",\"category\":\"Tenses\",\"structure\":\"S + V(s/es)\"}", null, mapper);
        assertThat(grammar.title()).isEqualTo("thi hien tai don");
        assertThat(grammar.text()).contains("dien ta thoi quen", "tenses", "s + v(s/es)").doesNotContain("<");
        assertThat(grammar.wordKey()).isNull();

        var quiz = ResourceSearchColumns.build(LearningResourceType.ASSESSMENT, "{\"title\":\"Reading 1\",\"description\":\"Bài đọc\",\"questions\":[]}", null, mapper);
        assertThat(quiz.title()).isEqualTo("reading 1");
        assertThat(quiz.text()).isEqualTo("bai doc");

        var slide = ResourceSearchColumns.build(LearningResourceType.SLIDE, "{\"fileName\":\"Bài giảng Tuần 1.pptx\"}", null, mapper);
        assertThat(slide.title()).isEqualTo("bai giang tuan 1.pptx");
        assertThat(slide.text()).contains("bai giang tuan 1.pptx");

        // Có tiêu đề: tìm theo tiêu đề, tên tệp vẫn tìm được qua phần nội dung.
        var titled = ResourceSearchColumns.build(LearningResourceType.SLIDE,
                "{\"title\":\"Bài 18: Khoa học\",\"fileName\":\"HSK4 - BÀI 18.pptx\"}", null, mapper);
        assertThat(titled.title()).isEqualTo("bai 18: khoa hoc");
        assertThat(titled.text()).contains("hsk4 - bai 18.pptx");
    }

    @Test
    void missingOrBrokenContentStillKeepsTags_andNeverReturnsNull() {
        var noContent = ResourceSearchColumns.build(LearningResourceType.VOCABULARY, null, List.of("Tag A"), mapper);
        assertThat(noContent.title()).isEmpty();
        assertThat(noContent.text()).isEmpty();
        assertThat(noContent.tags()).isEqualTo("tag a");

        var broken = ResourceSearchColumns.build(LearningResourceType.GRAMMAR, "{not json", null, mapper);
        assertThat(broken.title()).isEmpty();
        assertThat(broken.tags()).isEmpty();
    }

    @Test
    void overlongValuesAreCutToTheColumnLimits() {
        String longWord = "a".repeat(600);
        var v = ResourceSearchColumns.build(LearningResourceType.VOCABULARY, "{\"word\":\"" + longWord + "\"}", null, mapper);
        assertThat(v.title()).hasSize(500);
        assertThat(v.wordKey()).as("a word longer than the key column cannot be compared and is left out").isNull();
    }
}
