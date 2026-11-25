package pl.co.lms.service.game;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import pl.co.lms.dto.request.SubmitBlastGameRequest;
import pl.co.lms.entity.BlastGameEndReason;
import pl.co.lms.entity.json.VocabularyGameCard;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Original Blast scoring: +1 correct, -1 wrong, clamped to zero; six live balloons. */
public final class BlastGameScorer {
    private BlastGameScorer() {}
    public record Outcome(int score, int answered, int mistakes) {}
    private record Replacement(String cardId, int readyAt) {}

    public static Outcome score(List<VocabularyGameCard> deck, SubmitBlastGameRequest request) {
        int duration = deck.size() * 6000;
        if (deck.size() < 2 || deck.size() > 60 || request.hits() == null || request.hits().size() > 5000
                || request.reason() == null || request.elapsedMs() < 0 || request.elapsedMs() > duration) throw invalid();
        Map<String, Integer> active = new HashMap<>(); // wrong balloons become selectable again after 520ms
        Set<String> answered = new HashSet<>();
        List<Replacement> replacements = new ArrayList<>();
        int next = Math.min(6, deck.size()), score = 0, mistakes = 0, previous = 0, lastCorrect = -1;
        for (int i = 0; i < next; i++) active.put(deck.get(i).id(), 0);
        for (var hit : request.hits()) {
            if (hit == null || hit.atMs() < previous || hit.atMs() > request.elapsedMs()) throw invalid();
            for (var replacement : new ArrayList<>(replacements)) {
                if (replacement.readyAt() > hit.atMs() + 1) continue;
                active.put(replacement.cardId(), 0); replacements.remove(replacement);
            }
            Integer targetReady = active.get(hit.cardId()), questionReady = active.get(hit.questionCardId());
            if (targetReady == null || questionReady == null || targetReady > hit.atMs() + 1 || questionReady > hit.atMs() + 1) throw invalid();
            if (hit.cardId().equals(hit.questionCardId())) {
                active.remove(hit.cardId()); answered.add(hit.cardId()); score++; lastCorrect = hit.atMs();
                if (next < deck.size()) replacements.add(new Replacement(deck.get(next++).id(), hit.atMs() + 420));
            } else { score = Math.max(0, score - 1); mistakes++; active.put(hit.cardId(), hit.atMs() + 520); }
            previous = hit.atMs();
        }
        if (request.reason() == BlastGameEndReason.COMPLETED) {
            if (answered.size() != deck.size() || request.elapsedMs() + 1 < lastCorrect + 420) throw invalid();
        } else if (request.elapsedMs() != duration) throw invalid();
        return new Outcome(score, answered.size(), mistakes);
    }
    private static ApiException invalid() { return new ApiException(ErrorCode.E200, "Kết quả bắn từ vựng không hợp lệ hoặc lượt chơi chưa kết thúc."); }
}
