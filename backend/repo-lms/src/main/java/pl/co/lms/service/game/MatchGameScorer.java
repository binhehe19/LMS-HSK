package pl.co.lms.service.game;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import pl.co.lms.dto.request.MatchGameMoveRequest;
import pl.co.lms.dto.request.SubmitMatchGameRequest;
import pl.co.lms.dto.response.MatchGameCardResponse;

/** Replays the moves against the server's frozen, ordered deck. Never accepts a client score. */
public final class MatchGameScorer {
    private MatchGameScorer() {}
    public record Outcome(int score, int mistakes, int matchedPairs) {}
    public static Outcome score(List<MatchGameCardResponse> cards, SubmitMatchGameRequest request) {
        if (request.moves() == null || request.moves().isEmpty() || request.moves().size() > 5000 || request.elapsedTenths() < 0) throw invalid();
        int score = 0, mistakes = 0, matched = 0, round = 0, previousAt = 0;
        Map<String, Long> reusableAfter = new HashMap<>();
        Set<String> gone = new HashSet<>();
        for (MatchGameMoveRequest move : request.moves()) {
            if (move == null || move.atTenths() > request.elapsedTenths() || round * 6 >= cards.size() || move.round() != round
                    || move.atTenths() < previousAt || move.pairTenths() < 0 || move.pairTenths() > (long) move.atTenths() - previousAt + 1
                    || move.pairTenths() > move.atTenths()
                    || move.atTenths() < reusableAfter.getOrDefault(move.firstTileId(), 0L)
                    || move.atTenths() < reusableAfter.getOrDefault(move.secondTileId(), 0L)
                    || Objects.equals(move.firstTileId(), move.secondTileId())) throw invalid();
            Map<String, String> tileCards = new HashMap<>();
            for (MatchGameCardResponse card : cards.subList(round * 6, Math.min(cards.size(), (round + 1) * 6))) {
                tileCards.put(card.id() + "-term", card.id()); tileCards.put(card.id() + "-def", card.id());
            }
            String a = tileCards.get(move.firstTileId()), b = tileCards.get(move.secondTileId());
            if (a == null || b == null || gone.contains(a) || gone.contains(b)) throw invalid();
            boolean correct = a.equals(b); // two distinct tile IDs for the same card necessarily have opposite types
            if (correct) {
                score += (int) Math.round(100 + Math.max(0, 30 - move.pairTenths() / 10.0) * 2);
                gone.add(a); matched++;
                if (gone.size() == Math.min(6, cards.size() - round * 6)) { round++; gone.clear(); }
            } else {
                score = Math.max(0, score - 50); mistakes++;
                reusableAfter.put(move.firstTileId(), (long) move.atTenths() + 7);
                reusableAfter.put(move.secondTileId(), (long) move.atTenths() + 7);
            }
            previousAt = move.atTenths();
        }
        if (matched != cards.size()) throw invalid();
        return new Outcome(score, mistakes, matched);
    }
    private static ApiException invalid() { return new ApiException(ErrorCode.E200, "Lượt ghép thẻ không hợp lệ hoặc chưa hoàn thành."); }
}
