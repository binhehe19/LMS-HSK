package pl.co.lms.service.game;

import base.co.common.exception.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import pl.co.lms.dto.request.*;
import pl.co.lms.dto.response.MatchGameCardResponse;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class MatchGameScorerTest {
    @Test void acceptsTheActualFrontendEngineTranscriptWithTheSameScore() throws Exception {
        var mapper = new ObjectMapper();
        try (var stream = getClass().getResourceAsStream("/match-transcript.json")) {
            var fixture = mapper.readTree(stream);
            List<MatchGameCardResponse> deck = mapper.convertValue(fixture.get("cards"), new TypeReference<List<MatchGameCardResponse>>() {});
            var request = mapper.treeToValue(fixture.get("request"), SubmitMatchGameRequest.class);
            var outcome = MatchGameScorer.score(deck, request);
            assertThat(outcome.score()).isEqualTo(fixture.path("score").asInt());
            assertThat(outcome.mistakes()).isEqualTo(fixture.path("mistakes").asInt());
            assertThat(outcome.matchedPairs()).isEqualTo(deck.size());
        }
    }
    private List<MatchGameCardResponse> cards(int count) {
        var cards = new ArrayList<MatchGameCardResponse>();
        for (int i = 0; i < count; i++) cards.add(new MatchGameCardResponse("c" + i, "word" + i, "meaning" + i));
        return cards;
    }
    private MatchGameMoveRequest move(int round, String a, String b, int pair, int at) {
        return new MatchGameMoveRequest(round, a, b, pair, at);
    }
    @Test void formulaAndPenaltyAndRoundProgression() {
        var moves = new ArrayList<MatchGameMoveRequest>();
        moves.add(move(0, "c0-term", "c1-def", 0, 0)); // score floor at zero
        int time = 7;
        for (int i = 0; i < 7; i++) {
            moves.add(move(i / 6, "c" + i + "-def", "c" + i + "-term", 0, time));
            time += 11 + (i == 5 ? 3 : 0);
        }
        var outcome = MatchGameScorer.score(cards(7), new SubmitMatchGameRequest(moves, time));
        assertThat(outcome.score()).isEqualTo(1120); assertThat(outcome.mistakes()).isEqualTo(1);
        assertThat(outcome.matchedPairs()).isEqualTo(7);
        assertThat(MatchGameScorer.score(cards(1), new SubmitMatchGameRequest(List.of(move(0, "c0-term", "c0-def", 53, 53)), 64)).score()).isEqualTo(149);
        assertThat(MatchGameScorer.score(cards(1), new SubmitMatchGameRequest(List.of(move(0, "c0-term", "c0-def", 400, 400)), 411)).score()).isEqualTo(100);
    }
    @Test void rejectsUnknownRepeatedIncompleteAndImpossibleTiming() {
        for (var request : List.of(
                new SubmitMatchGameRequest(List.of(move(0, "unknown", "c0-def", 0, 0)), 11),
                new SubmitMatchGameRequest(List.of(move(0, "c0-term", "c0-term", 0, 0)), 11),
                new SubmitMatchGameRequest(List.of(move(1, "c0-term", "c0-def", 0, 0)), 11),
                new SubmitMatchGameRequest(List.of(move(0, "c0-term", "c0-def", 1, 0)), 11),
                new SubmitMatchGameRequest(List.of(move(0, "c0-term", "c0-def", 0, 11)), 10),
                new SubmitMatchGameRequest(List.of(move(0, "c0-term", "c0-def", 0, 0), move(0, "c0-term", "c0-def", 0, 11)), 22),
                new SubmitMatchGameRequest(List.of(move(0, "c0-term", "c0-def", 0, -1)), Integer.MAX_VALUE))) {
            assertThatThrownBy(() -> MatchGameScorer.score(cards(1), request)).isInstanceOf(ApiException.class);
        }
        assertThatThrownBy(() -> MatchGameScorer.score(cards(2), new SubmitMatchGameRequest(List.of(move(0,"c0-term","c0-def",0,0)),11))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> MatchGameScorer.score(cards(2), new SubmitMatchGameRequest(List.of(move(0,"c0-term","c0-def",0,10),move(0,"c1-term","c1-def",10,11)),21))).isInstanceOf(ApiException.class);
    }
    @Test void acceptsImmediatePairsAndRoundChangesWithoutAnimationPadding() {
        var moves=new ArrayList<MatchGameMoveRequest>();
        for(int i=0;i<7;i++) moves.add(move(i/6,"c"+i+"-term","c"+i+"-def",0,0));
        var result=MatchGameScorer.score(cards(7),new SubmitMatchGameRequest(moves,0));
        assertThat(result.score()).isEqualTo(1120); assertThat(result.matchedPairs()).isEqualTo(7);
    }
    @Test void wrongPairCooldownDoesNotBlockUnrelatedPairsButPreventsEarlyReuse() {
        var moves=new ArrayList<MatchGameMoveRequest>();
        moves.add(move(0,"c0-term","c1-def",0,0));
        moves.add(move(0,"c2-term","c2-def",0,0));
        moves.add(move(0,"c0-term","c0-def",0,7));
        moves.add(move(0,"c1-term","c1-def",0,7));
        assertThat(MatchGameScorer.score(cards(3),new SubmitMatchGameRequest(moves,7)).score()).isEqualTo(480);
        moves.set(2,move(0,"c0-term","c0-def",0,6));
        assertThatThrownBy(()->MatchGameScorer.score(cards(3),new SubmitMatchGameRequest(moves,7))).isInstanceOf(ApiException.class);
    }
}
