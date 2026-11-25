package pl.co.lms.service.game;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.VocabularyGameCard;
import pl.co.lms.repository.LearningResourceVersionRepository;
import java.util.*;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class VocabularyGameDeckProviderTest {
    final LearningResourceVersionRepository versions=mock(LearningResourceVersionRepository.class);
    final VocabularyGameDeckProvider decks=new VocabularyGameDeckProvider(versions,new ObjectMapper());

    @Test void usesCommonMeaningFirstThenTheFirstNonemptyVietnameseDefinition() {
        batch(List.of(
                word("common",""" 
                    {"word":"<b>environment</b>","commonMeaning":"môi&nbsp;trường",
                     "definitions":[{"meaningVi":"nghĩa khác"}]}
                    """),
                word("only-common","{\"word\":\"achievement\",\"commonMeaning\":\"thành tựu\"}"),
                word("legacy","""
                    {"word":"legacy","commonMeaning":"<p>&nbsp;</p>",
                     "definitions":[{"meaningVi":""},{"meaningVi":"<script>bad()</script>di sản"}]}
                    """)));
        assertThat(decks.library(Integer.MAX_VALUE)).containsExactly(
                new VocabularyGameCard("common","environment","môi trường"),
                new VocabularyGameCard("only-common","achievement","thành tựu"),
                new VocabularyGameCard("legacy","legacy","di sản"));
    }

    @Test void findsUsableVocabularyBeyondTheFirstFivePages() {
        when(versions.findPublishedGameContent(eq(LearningResourceType.VOCABULARY),any(Pageable.class))).thenAnswer(call -> {
            Pageable page=call.getArgument(1);
            List<LearningResourceVersion> entries=page.getPageNumber() < 5
                    ? IntStream.range(0,60).mapToObj(i -> word("empty-"+page.getPageNumber()+"-"+i,"{\"word\":\"empty\"}")).toList()
                    : List.of(word("usable","{\"word\":\"knowledge\",\"commonMeaning\":\"kiến thức\"}"));
            return new PageImpl<>(entries,page,301);
        });
        assertThat(decks.library(Integer.MAX_VALUE)).containsExactly(new VocabularyGameCard("usable","knowledge","kiến thức"));
        verify(versions).findPublishedGameContent(LearningResourceType.VOCABULARY,PageRequest.of(5,60));
    }

    @Test void stopsAtSixtyCardsAndKeepsBlastLengthLimitWithoutDroppingShorterLaterWords() {
        var entries=IntStream.range(0,60).mapToObj(i -> word("id"+i,"{\"word\":\"word"+i+"\",\"commonMeaning\":\"nghĩa\"}")).toList();
        when(versions.findPublishedGameContent(eq(LearningResourceType.VOCABULARY),any(Pageable.class)))
                .thenReturn(new PageImpl<>(entries,PageRequest.of(0,60),120));
        assertThat(decks.library(32)).hasSize(60);
        verify(versions,times(1)).findPublishedGameContent(any(),any());
        reset(versions);
        batch(List.of(word("long","{\"word\":\"this term is too long for a balloon\",\"commonMeaning\":\"nghĩa\"}"),
                word("short","{\"word\":\"art\",\"commonMeaning\":\"nghệ thuật\"}")));
        assertThat(decks.library(32)).containsExactly(new VocabularyGameCard("short","art","nghệ thuật"));
    }

    @Test void skipsMalformedMissingVietnameseAndDuplicateWordsWithoutDemoFallback() {
        var draft=word("draft","{\"word\":\"draft\",\"commonMeaning\":\"nháp\"}"); draft.setStatus(LearningResourceVersionStatus.DRAFT);
        var deleted=word("deleted","{\"word\":\"deleted\",\"commonMeaning\":\"xóa\"}"); deleted.setDeleted(true);
        batch(List.of(word("broken","broken"),word("null",null),word("array","[]"),draft,deleted,
                word("english","{\"word\":\"english\",\"definitions\":[{\"definitionEn\":\"English only\"}]}"),
                word("first","{\"word\":\"Hello\",\"commonMeaning\":\"xin chào\"}"),
                word("second","{\"word\":\"hello\",\"commonMeaning\":\"xin chào\"}")));
        assertThat(decks.library(Integer.MAX_VALUE)).containsExactly(new VocabularyGameCard("first","Hello","xin chào"));
        batch(List.of());
        assertThat(decks.library(Integer.MAX_VALUE)).isEmpty();
    }

    private void batch(List<LearningResourceVersion> entries) {
        when(versions.findPublishedGameContent(eq(LearningResourceType.VOCABULARY),any(Pageable.class))).thenReturn(new PageImpl<>(entries));
    }
    private LearningResourceVersion word(String id,String content) {
        var version=new LearningResourceVersion(); version.setId("v-"+id); version.setResourceId(id);
        version.setStatus(LearningResourceVersionStatus.PUBLISHED); version.setContent(content); return version;
    }
}
