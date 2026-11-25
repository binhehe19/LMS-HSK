package pl.co.lms.service.game;

import base.co.common.exception.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import pl.co.lms.dto.request.BlastGameHitRequest;
import pl.co.lms.dto.request.SubmitBlastGameRequest;
import pl.co.lms.entity.BlastGameEndReason;
import pl.co.lms.entity.json.VocabularyGameCard;
import java.util.List;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.*;

class BlastGameScorerTest {
    List<VocabularyGameCard> cards(int size) { return IntStream.range(0,size).mapToObj(i -> new VocabularyGameCard("c"+i,"word"+i,"meaning"+i)).toList(); }
    BlastGameHitRequest hit(String question,String card,int at) { return new BlastGameHitRequest(question,card,at); }
    @Test void actualFrontendTranscriptHasIdenticalScore() throws Exception {
        var mapper=new ObjectMapper();
        try(var stream=getClass().getResourceAsStream("/blast-transcript.json")) {
            var fixture=mapper.readTree(stream);
            List<VocabularyGameCard> cards=mapper.convertValue(fixture.get("cards"),new TypeReference<List<VocabularyGameCard>>(){});
            var outcome=BlastGameScorer.score(cards,mapper.treeToValue(fixture.get("request"),SubmitBlastGameRequest.class));
            assertThat(outcome.score()).isEqualTo(fixture.path("score").asInt());
            assertThat(outcome.answered()).isEqualTo(fixture.path("answered").asInt());
            assertThat(outcome.mistakes()).isEqualTo(fixture.path("mistakes").asInt());
        }
    }
    @Test void timeoutAcceptsNoHitsOrPartialGameAndPenaltyNeverMakesScoreNegative() {
        assertThat(BlastGameScorer.score(cards(2),new SubmitBlastGameRequest(List.of(),12000,BlastGameEndReason.TIMEOUT)).score()).isZero();
        var outcome=BlastGameScorer.score(cards(2),new SubmitBlastGameRequest(List.of(hit("c0","c1",100),hit("c0","c0",400),hit("c1","c1",1000)),1420,BlastGameEndReason.COMPLETED));
        assertThat(outcome.score()).isEqualTo(2);assertThat(outcome.mistakes()).isEqualTo(1);
        assertThat(BlastGameScorer.score(cards(3),new SubmitBlastGameRequest(List.of(hit("c0","c0",100),hit("c1","c2",200)),18000,BlastGameEndReason.TIMEOUT)).score()).isZero();
    }
    @Test void rejectsForgedDeckEarlyFinishRepeatedHitWrongCooldownAndReplacementBeforeReady() {
        for(var request:List.of(
            new SubmitBlastGameRequest(List.of(hit("c0","unknown",100)),12000,BlastGameEndReason.TIMEOUT),
            new SubmitBlastGameRequest(List.of(hit("unknown","c0",100)),12000,BlastGameEndReason.TIMEOUT),
            new SubmitBlastGameRequest(List.of(hit("c0","c0",100),hit("c0","c0",200)),12000,BlastGameEndReason.TIMEOUT),
            new SubmitBlastGameRequest(List.of(hit("c0","c1",100),hit("c0","c1",200)),12000,BlastGameEndReason.TIMEOUT),
            new SubmitBlastGameRequest(List.of(hit("c0","c0",100)),520,BlastGameEndReason.COMPLETED),
            new SubmitBlastGameRequest(List.of(),11999,BlastGameEndReason.TIMEOUT),
            new SubmitBlastGameRequest(List.of(hit("c0","c0",400),hit("c1","c1",300)),12000,BlastGameEndReason.TIMEOUT)))
            assertThatThrownBy(()->BlastGameScorer.score(cards(2),request)).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->BlastGameScorer.score(cards(7),new SubmitBlastGameRequest(List.of(hit("c6","c6",100)),42000,BlastGameEndReason.TIMEOUT))).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->BlastGameScorer.score(cards(7),new SubmitBlastGameRequest(List.of(hit("c0","c0",100),hit("c6","c6",300)),42000,BlastGameEndReason.TIMEOUT))).isInstanceOf(ApiException.class);
    }
}
