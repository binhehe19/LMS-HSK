package pl.co.lms.service.game;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.*;
import pl.co.lms.repository.LearningResourceVersionRepository;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class QuadWordCandidateProvider {
    private final LearningResourceVersionRepository versions;
    private final ObjectMapper mapper;

    public record Collection(String id, String title, List<QuadWordCandidate> words) {}

    /** Full eligible CEFR sets; answers remain server-side. No 300-word sampling limit within a set. */
    public List<Collection> collections() {
        var groups = new TreeMap<String, LinkedHashMap<String, QuadWordCandidate>>();
        var all = new LinkedHashMap<String, QuadWordCandidate>();
        int page = 0;
        org.springframework.data.domain.Page<LearningResourceVersion> batch;
        do {
            batch = versions.findPublishedGameContent(LearningResourceType.VOCABULARY, PageRequest.of(page++, 200));
            for (var version : batch) {
                if (version.isDeleted() || version.getStatus() != LearningResourceVersionStatus.PUBLISHED) continue;
                try {
                    var content = mapper.readTree(version.getContent());
                    if (content == null || !content.isObject()) continue;
                    String level = text(content, "cefrLevel").toUpperCase(Locale.ROOT);
                    var word = convert(version);
                    if (word == null) continue;
                    all.putIfAbsent(QuadWordEngine.letters(word.answer()), word);
                    if (Set.of("A1", "A2", "B1", "B2", "C1", "C2").contains(level))
                        groups.computeIfAbsent(level, ignored -> new LinkedHashMap<>())
                                .putIfAbsent(QuadWordEngine.letters(word.answer()), word);
                } catch (JsonProcessingException | IllegalArgumentException ignored) { /* Skip unusable content. */ }
            }
        } while (batch.hasNext());
        var result = new ArrayList<Collection>();
        result.add(new Collection("ALL", "Tất cả cấp độ", List.copyOf(all.values())));
        for (String level : List.of("A1", "A2", "B1", "B2", "C1", "C2")) {
            var words = groups.getOrDefault(level, new LinkedHashMap<>());
            if (level.equals("A1") && words.isEmpty()) continue;
            String title = switch (level) {
                case "A1" -> "Nhập môn (A1)";
                case "A2" -> "Cơ bản (A2)";
                case "B1" -> "Trung cấp (B1)";
                case "B2" -> "Khá (B2)";
                case "C1" -> "Nâng cao (C1)";
                default -> "Thành thạo (C2)";
            };
            result.add(new Collection(level, title, List.copyOf(words.values())));
        }
        return List.copyOf(result);
    }

    /** Read at most 300 published library entries, sampling pages across a large library. */
    public List<QuadWordCandidate> candidates() {
        var type = LearningResourceType.VOCABULARY;
        var first = versions.findPublishedGameContent(type, PageRequest.of(0, 60));
        Set<Integer> pages = new LinkedHashSet<>();
        int count = Math.min(4, Math.max(0, first.getTotalPages() - 1));
        while (pages.size() < count) pages.add(ThreadLocalRandom.current().nextInt(1, first.getTotalPages()));
        var selected = new LinkedHashMap<String, QuadWordCandidate>();
        add(first.getContent(), selected);
        for (int page : pages)
            add(versions.findPublishedGameContent(type, PageRequest.of(page, 60)).getContent(), selected);
        return List.copyOf(selected.values());
    }

    private void add(List<LearningResourceVersion> batch, Map<String, QuadWordCandidate> result) {
        for (var version : batch) {
            if (version.isDeleted() || version.getStatus() != LearningResourceVersionStatus.PUBLISHED) continue;
            try {
                var candidate = convert(version);
                if (candidate != null) result.putIfAbsent(QuadWordEngine.letters(candidate.answer()), candidate);
            } catch (JsonProcessingException | IllegalArgumentException ignored) {
                // Malformed legacy content is not a reason to use a draft or a demo answer.
            }
        }
    }

    QuadWordCandidate convert(LearningResourceVersion version) throws JsonProcessingException {
        JsonNode content = mapper.readTree(version.getContent());
        if (content == null || !content.isObject()) return null;
        String answer = text(content, "word");
        if (!answer.matches("[a-zA-Z]+(?:[ '-][a-zA-Z]+)*") || QuadWordEngine.letters(answer).length() > 80) return null;
        // Definitions are optional review material, never a condition for playing a word.
        JsonNode definition = mapper.createObjectNode();
        for (var entry : content.path("definitions")) {
            if (List.of("meaningVi", "definitionEn", "exampleEn", "exampleVi").stream()
                    .anyMatch(field -> !text(entry, field).isBlank())) {
                definition = entry;
                break;
            }
        }
        String meaning = first(text(definition, "meaningVi"), text(content, "commonMeaning"));
        String ukPhonetic=text(content,"ukPhonetic"), usPhonetic=text(content,"usPhonetic");
        boolean uk=!ukPhonetic.isBlank() || usPhonetic.isBlank() &&
                (!text(content,"ukAudioUrl").isBlank() || text(content,"usAudioUrl").isBlank());
        var review = new QuadWordReview(answer, text(definition, "definitionEn"),
                first(ukPhonetic,usPhonetic),
                text(content, "usageNote"), text(definition, "exampleEn"), text(definition, "exampleVi"),
                text(content,uk ? "ukAudioUrl" : "usAudioUrl"), uk ? "UK" : "US");
        return new QuadWordCandidate(version.getResourceId(), version.getId(), answer, meaning, review);
    }
    private static String text(JsonNode node, String field) {
        return VocabularyGameDeckProvider.text(node.path(field).asText(""));
    }
    private static String first(String a, String b) { return a.isBlank() ? b : a; }

    public QuadWordCandidate choose(List<QuadWordCandidate> candidates, String previousAnswer) {
        var pool = candidates.stream().filter(c -> previousAnswer == null
                || !QuadWordEngine.letters(c.answer()).equals(QuadWordEngine.letters(previousAnswer))).toList();
        if (pool.isEmpty()) pool = candidates;
        return pool.isEmpty() ? null : pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
    }
}
