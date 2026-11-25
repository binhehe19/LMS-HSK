package pl.co.lms.service.studymaterials;

import pl.co.lms.dto.response.StudyMaterialOccurrenceResponse;
import pl.co.lms.dto.response.StudyMaterialVocabularyCandidateResponse;
import pl.co.lms.dto.response.StudyMaterialVocabularyResponse;
import pl.co.lms.dto.response.StudyMaterialWordResponse;
import pl.co.lms.dto.response.StudyMaterialVocabularyPackageResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.StudyMaterialContent;
import pl.co.lms.entity.json.StudyMaterialContent.VocabularyLink;
import pl.co.lms.entity.json.VocabularyEnContent;
import pl.co.lms.repository.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import static pl.co.lms.service.studymaterials.StudyMaterialValidation.*;

@Service @Transactional(readOnly = true)
public class StudyMaterialVocabularyService {
    private final LearningResourceRepository resources;
    private final LearningResourceVersionRepository versions;
    private final LearningResourceStateRepository states;
    private final ObjectMapper mapper;
    private final StudyMaterialVocabularyUnitService units;

    public StudyMaterialVocabularyService(LearningResourceRepository resources, LearningResourceVersionRepository versions,
                                          LearningResourceStateRepository states, ObjectMapper mapper, StudyMaterialVocabularyUnitService units) {
        this.resources = resources; this.versions = versions; this.states = states; this.mapper = mapper;
        this.units = units;
    }
    public List<StudyMaterialVocabularyPackageResponse> unitOptions() { return units.options(); }

    public List<StudyMaterialVocabularyCandidateResponse> detect(List<StudyMaterialContent.Paragraph> paragraphs, Map<String, List<String>> variants) {
        return detect(paragraphs, variants, null);
    }
    public List<StudyMaterialVocabularyCandidateResponse> detect(List<StudyMaterialContent.Paragraph> paragraphs, Map<String, List<String>> variants, StudyMaterialContent.VocabularyUnit unit) {
        var preview = StudyMaterialContent.builder().category(unit == null ? StudyMaterialCategory.BILINGUAL : StudyMaterialCategory.DIGLOT).title("Preview").paragraphs(paragraphs).vocabularyUnit(unit).build();
        preview.setVocabularyLinks(variants == null ? List.of() : variants.entrySet().stream().map(entry -> new VocabularyLink(entry.getKey(), entry.getValue())).toList());
        validate(preview);
        var words = unit == null ? readWords(libraryWordsIn(paragraphs, variants)) : units.words(unit);
        var terms = terms(words.values(), list(preview.getVocabularyLinks()));
        var matches = occurrences(paragraphs, new VocabularyTextMatcher(terms), false);
        var byWord = matches.stream().collect(Collectors.groupingBy(StudyMaterialOccurrenceResponse::resourceId, LinkedHashMap::new, Collectors.toList()));
        require(byWord.size() <= 500, "Bài có hơn 500 từ khớp; hãy chia thành các bài ngắn hơn");
        return byWord.entrySet().stream().map(entry -> new StudyMaterialVocabularyCandidateResponse(words.get(entry.getKey()), entry.getValue())).toList();
    }
    // Cụm dài nhất tính theo token (gồm dấu câu) khi tra từ trong Kho; từ dài hơn không được dò.
    private static final int LOOKUP_TOKENS = 10;
    private static final int MAX_LOOKUP_KEYS = 200_000;
    /**
     * Từ trong Kho xuất hiện trong bài đọc, tra theo khoá từ (word_key) của từng cụm token thay vì nạp cả Kho vào bộ nhớ, cộng các từ được chỉ
     * định rõ trong variants (khoá là id từ) vì biến thể có thể khác khoá từ.
     */
    private List<LearningResource> libraryWordsIn(List<StudyMaterialContent.Paragraph> paragraphs, Map<String, List<String>> variants) {
        var keys = new LinkedHashSet<String>();
        for (var paragraph : paragraphs) {
            keys.addAll(VocabularyTextMatcher.lookupKeys(paragraph.en(), LOOKUP_TOKENS));
            keys.addAll(VocabularyTextMatcher.lookupKeys(paragraph.vi(), LOOKUP_TOKENS));
        }
        require(keys.size() <= MAX_LOOKUP_KEYS, "Bài đọc quá dài để dò từ vựng; hãy chia thành các bài ngắn hơn");
        var found = new LinkedHashMap<String, LearningResource>();
        var list = new ArrayList<>(keys);
        for (int offset = 0; offset < list.size(); offset += 1000) {
            resources.findLibraryVocabularyByWordKeys(list.subList(offset, Math.min(offset + 1000, list.size()))).forEach(word -> found.put(word.getId(), word));
        }
        if (variants != null && !variants.isEmpty()) resources.findByIdInAndDeletedFalse(variants.keySet()).forEach(word -> found.putIfAbsent(word.getId(), word));
        return List.copyOf(found.values());
    }
    public List<VocabularyLink> detectLinks(StudyMaterialContent content) {
        return detect(list(content.getParagraphs()), Map.of()).stream().map(candidate -> new VocabularyLink(candidate.word().resourceId(), List.of())).toList();
    }
    public void precompute(StudyMaterialContent content) {
        var words = units.words(content.getVocabularyUnit());
        var links = list(content.getVocabularyLinks());
        var matches = occurrences(list(content.getParagraphs()), new VocabularyTextMatcher(terms(words.values(), links)), true);
        var found = matches.stream().map(StudyMaterialOccurrenceResponse::resourceId).collect(Collectors.toSet());
        require(found.size() <= 500, "Bài có hơn 500 từ khớp; hãy chia thành các bài ngắn hơn");
        words.keySet().retainAll(found);
        var variants = links.stream().collect(Collectors.toMap(VocabularyLink::resourceId, link -> list(link.variants()), (a, b) -> a));
        content.setVocabularyLinks(words.keySet().stream().map(id -> new VocabularyLink(id, variants.getOrDefault(id, List.of()))).toList());
        content.setVocabularyIndex(new StudyMaterialContent.VocabularyIndex(
                words.values().stream().map(word -> new StudyMaterialContent.VocabularyVersion(word.resourceId(), word.versionId())).toList(),
                matches.stream().map(match -> new StudyMaterialContent.VocabularyOccurrence(match.resourceId(), match.paragraphIndex(), match.language(), match.start(), match.end(), match.surface())).toList()));
    }
    public void validateLinks(StudyMaterialContent content) {
        if (content.getCategory() == StudyMaterialCategory.DIGLOT) {
            require(content.getVocabularyUnit() != null && content.getVocabularyIndex() != null, "Chọn Unit và lưu lại bài Diglot để dò từ vựng");
            return;
        }
        var links = list(content.getVocabularyLinks());
        var words = linkedWords(links);
        if (links.isEmpty()) return;
        require(words.size() == links.size(), "Từ liên kết phải thuộc kho từ vựng đã xuất bản");
        var found = occurrences(list(content.getParagraphs()), new VocabularyTextMatcher(terms(words.values(), links)), false).stream().map(StudyMaterialOccurrenceResponse::resourceId).collect(Collectors.toSet());
        require(found.containsAll(words.keySet()), "Từ liên kết hoặc biến thể chưa xuất hiện trong bài đọc");
    }
    public StudyMaterialVocabularyResponse forReader(String user, StudyMaterialContent content) {
        boolean diglot = content.getCategory() == StudyMaterialCategory.DIGLOT;
        var words = diglot ? indexedWords(content) : linkedWords(list(content.getVocabularyLinks()));
        var personal = words.isEmpty() ? Map.<String, LearningResourceState>of() : states.findByUserIdAndLearningResourceIdInAndDeletedFalse(user, new ArrayList<>(words.keySet())).stream()
                .collect(Collectors.toMap(LearningResourceState::getLearningResourceId, Function.identity(), StudyMaterialVocabularyService::latestState));
        var result = words.values().stream().map(word -> {
            var state = personal.get(word.resourceId());
            // Reuse explicit dictionary states; never infer learning from saved, opened, or quiz score.
            boolean learned = isLearned(state);
            return new StudyMaterialWordResponse(word.resourceId(), word.versionId(), word.content(), learned, state != null && state.isSaved());
        }).toList();
        var highlights = diglot ? content.getVocabularyIndex() == null ? List.<StudyMaterialOccurrenceResponse>of() : list(content.getVocabularyIndex().highlights()).stream()
                .filter(match -> words.containsKey(match.resourceId()))
                .map(match -> new StudyMaterialOccurrenceResponse(match.resourceId(), match.paragraphIndex(), match.language(), match.start(), match.end(), match.surface())).toList()
                : occurrences(list(content.getParagraphs()), new VocabularyTextMatcher(terms(result.stream().filter(StudyMaterialWordResponse::learned).toList(), list(content.getVocabularyLinks()))), true);
        return new StudyMaterialVocabularyResponse(result, highlights);
    }
    private LinkedHashMap<String, StudyMaterialWordResponse> indexedWords(StudyMaterialContent content) {
        var result = new LinkedHashMap<String, StudyMaterialWordResponse>();
        if (content.getVocabularyUnit() == null || content.getVocabularyIndex() == null || list(content.getVocabularyIndex().words()).isEmpty()) return result;
        var index = content.getVocabularyIndex().words();
        var ids = resources.findByIdInAndDeletedFalse(index.stream().map(StudyMaterialContent.VocabularyVersion::resourceId).toList()).stream()
                .filter(word -> word.getType() == LearningResourceType.VOCABULARY && ResourceSubTypes.isEnglish(word.getSubType())).map(LearningResource::getId).collect(Collectors.toSet());
        var byVersion = versions.findByIdInAndDeletedFalse(index.stream().map(StudyMaterialContent.VocabularyVersion::versionId).toList()).stream()
                .filter(version -> version.getStatus() == LearningResourceVersionStatus.PUBLISHED).collect(Collectors.toMap(LearningResourceVersion::getId, Function.identity()));
        for (var entry : index) {
            var version = byVersion.get(entry.versionId());
            if (!ids.contains(entry.resourceId()) || version == null || !entry.resourceId().equals(version.getResourceId())) continue;
            result.put(entry.resourceId(), new StudyMaterialWordResponse(entry.resourceId(), version.getId(), version.getContentAs(VocabularyEnContent.class, mapper), false, false));
        }
        return result;
    }
    // The product's eventual "đã học" criterion can be changed at this single policy boundary.
    public static boolean isLearned(LearningResourceState state) {
        if (state == null) return false;
        if (state.getComprehensionLevel() != null) return state.getComprehensionLevel() == VocabularyComprehensionLevel.KNOWN;
        return state.getStatus() == FlashcardStatus.LEARNED;
    }
    static LearningResourceState latestState(LearningResourceState left, LearningResourceState right) {
        return Comparator.nullsFirst(java.time.Instant::compareTo).compare(left.getUpdatedAt(), right.getUpdatedAt()) >= 0 ? left : right;
    }
    private LinkedHashMap<String, StudyMaterialWordResponse> linkedWords(List<VocabularyLink> links) {
        if (links.isEmpty()) return new LinkedHashMap<>();
        return readWords(resources.findByIdInAndDeletedFalse(links.stream().map(VocabularyLink::resourceId).toList()));
    }
    private LinkedHashMap<String, StudyMaterialWordResponse> readWords(List<LearningResource> source) {
        var eligible = source.stream().filter(resource -> resource.getType() == LearningResourceType.VOCABULARY && ResourceSubTypes.isEnglish(resource.getSubType()) && resource.isInLibrary() && !resource.isDeleted() && resource.getPublishedVersionId() != null).toList();
        var ids = eligible.stream().map(LearningResource::getPublishedVersionId).distinct().toList();
        var published = new HashMap<String, LearningResourceVersion>();
        for (int offset = 0; offset < ids.size(); offset += 500) {
            versions.findByIdInAndDeletedFalse(ids.subList(offset, Math.min(offset + 500, ids.size()))).forEach(version -> published.put(version.getId(), version));
        }
        var result = new LinkedHashMap<String, StudyMaterialWordResponse>();
        for (var resource : eligible) {
            var version = published.get(resource.getPublishedVersionId());
            if (version == null || version.getStatus() != LearningResourceVersionStatus.PUBLISHED || !resource.getId().equals(version.getResourceId())) continue;
            var content = version.getContentAs(VocabularyEnContent.class, mapper);
            if (content == null || content.getWord() == null || content.getWord().isBlank()) continue;
            result.put(resource.getId(), new StudyMaterialWordResponse(resource.getId(), version.getId(), content, false, false));
        }
        return result;
    }
    private static List<VocabularyTextMatcher.Term> terms(Collection<StudyMaterialWordResponse> words, List<VocabularyLink> links) {
        var variants = links.stream().collect(Collectors.toMap(VocabularyLink::resourceId, link -> list(link.variants()), (left, right) -> left));
        var terms = new ArrayList<VocabularyTextMatcher.Term>();
        for (var word : words) {
            terms.add(new VocabularyTextMatcher.Term(word.resourceId(), word.content().getWord()));
            for (var variant : variants.getOrDefault(word.resourceId(), List.of())) terms.add(new VocabularyTextMatcher.Term(word.resourceId(), variant));
        }
        return terms;
    }
    private static List<StudyMaterialOccurrenceResponse> occurrences(List<StudyMaterialContent.Paragraph> paragraphs, VocabularyTextMatcher matcher, boolean removeOverlaps) {
        var result = new ArrayList<StudyMaterialOccurrenceResponse>();
        for (int index = 0; index < paragraphs.size(); index++) {
            var paragraph = paragraphs.get(index);
            for (String language : List.of("en", "vi")) {
                var found = matcher.find(language.equals("en") ? paragraph.en() : paragraph.vi());
                if (removeOverlaps) found = VocabularyTextMatcher.nonOverlapping(found);
                for (var match : found) {
                    require(result.size() < 100000, "Bài đọc có quá nhiều vị trí từ vựng");
                    result.add(new StudyMaterialOccurrenceResponse(match.resourceId(), index, language, match.start(), match.end(), match.surface()));
                }
            }
        }
        return result;
    }
}
