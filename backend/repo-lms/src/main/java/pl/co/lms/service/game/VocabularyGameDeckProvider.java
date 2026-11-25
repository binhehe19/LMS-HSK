package pl.co.lms.service.game;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.entity.LearningResourceVersionStatus;
import pl.co.lms.entity.json.VocabularyGameCard;
import pl.co.lms.repository.LearningResourceVersionRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Frozen published decks shared by the vocabulary games; never falls back to drafts. */
@Service
@RequiredArgsConstructor
public class VocabularyGameDeckProvider {
    private final LearningResourceVersionRepository versions;
    private final ObjectMapper mapper;

    @Transactional(readOnly = true)
    public List<VocabularyGameCard> library(int maxTermLength) {
        var cards = new ArrayList<VocabularyGameCard>();
        Set<String> terms = new HashSet<>(), ids = new HashSet<>();
        // Same published, non-deleted shared vocabulary as Dictionary / Learn Vocabulary.
        // Continue until enough usable cards or the end, including beyond the first 300 entries.
        for (int page = 0; cards.size() < 60; page++) {
            var batch = versions.findPublishedGameContent(LearningResourceType.VOCABULARY, PageRequest.of(page, 60));
            for (var version : batch) {
                if (version.isDeleted() || version.getStatus() != LearningResourceVersionStatus.PUBLISHED
                        || version.getContent() == null || version.getContent().isBlank()) continue;
                try {
                    var content = mapper.readTree(version.getContent());
                    if (content == null || !content.isObject()) continue;
                    String term = text(content.path("word").asText("")), meaning = text(content.path("commonMeaning").asText(""));
                    if (meaning.isBlank()) for (var definition : content.path("definitions")) {
                        meaning = text(definition.path("meaningVi").asText(""));
                        if (!meaning.isBlank()) break;
                    }
                    if (term.isBlank() || term.length() > maxTermLength || meaning.isBlank() || terms.contains(term.toLowerCase(Locale.ROOT)) || ids.contains(version.getResourceId())) continue;
                    cards.add(new VocabularyGameCard(version.getResourceId(), term, meaning)); terms.add(term.toLowerCase(Locale.ROOT)); ids.add(version.getResourceId());
                    if (cards.size() == 60) break;
                } catch (JsonProcessingException ignored) { /* Skip malformed content, never use its draft as a fallback. */ }
            }
            if (!batch.hasNext()) break;
        }
        return cards;
    }
    public static String text(String value) {
        if (value == null) return "";
        return HtmlUtils.htmlUnescape(value.replaceAll("(?is)<(script|style)\\b[^>]*>.*?</\\1>", "")
                .replaceAll("<[^>]*>", " ")).replace('\u00a0', ' ').replaceAll("\\s+", " ").trim();
    }
    public String datasetKey(List<VocabularyGameCard> cards) {
        try {
            var sorted = cards.stream().sorted(Comparator.comparing(VocabularyGameCard::id)).toList();
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json(sorted).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new ApiException(ErrorCode.E280); }
    }
    private String json(Object object) {
        try { return mapper.writeValueAsString(object); }
        catch (Exception e) { throw new ApiException(ErrorCode.E280); }
    }
    public static List<VocabularyGameCard> demo() {
        String[][] words = {{"environment", "môi trường"}, {"achievement", "thành tựu"}, {"opportunity", "cơ hội"},
            {"education", "giáo dục"}, {"confident", "tự tin"}, {"improve", "cải thiện"}, {"challenge", "thử thách"},
            {"knowledge", "kiến thức"}, {"sustainable", "bền vững"}, {"community", "cộng đồng"}, {"benefit", "lợi ích"}, {"experience", "kinh nghiệm"}};
        var cards = new ArrayList<VocabularyGameCard>();
        for (int i = 0; i < words.length; i++) cards.add(new VocabularyGameCard("demo-" + (i + 1), words[i][0], words[i][1]));
        return cards;
    }
}
