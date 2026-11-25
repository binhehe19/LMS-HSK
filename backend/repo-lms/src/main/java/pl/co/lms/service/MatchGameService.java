package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.entity.MatchGameSession;
import pl.co.lms.entity.json.VocabularyGameCard;
import pl.co.lms.service.game.VocabularyGameDeckProvider;
import pl.co.lms.repository.MatchGameSessionRepository;
import pl.co.lms.service.game.MatchGameScorer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import pl.co.lms.dto.request.StartMatchGameRequest;
import pl.co.lms.dto.request.SubmitMatchGameRequest;
import pl.co.lms.dto.response.MatchGameCardResponse;
import pl.co.lms.dto.response.MatchGameLeaderboardResponse;
import pl.co.lms.dto.response.MatchGameResultResponse;
import pl.co.lms.dto.response.MatchGameSessionResponse;
import pl.co.lms.entity.MatchGameSource;

@Service
@RequiredArgsConstructor
public class MatchGameService {
    private final MatchGameSessionRepository sessions;
    private final VocabularyGameDeckProvider decks;
    private final ObjectMapper mapper;

    @Transactional
    public MatchGameSessionResponse start(String userId, StartMatchGameRequest request) {
        requireUser(userId);
        if (request.source() == null) throw new ApiException(ErrorCode.E200);
        var deck = request.source() == MatchGameSource.DEMO ? VocabularyGameDeckProvider.demo() : decks.library(Integer.MAX_VALUE);
        var cards = new ArrayList<>(deck.stream().map(c -> new MatchGameCardResponse(c.id(), c.term(), c.definition())).toList());
        if (cards.isEmpty()) throw new ApiException(ErrorCode.E227, "Chưa có từ phù hợp trong Từ điển / Học từ vựng. Vui lòng kiểm tra bộ từ đã xuất bản và có nghĩa tiếng Việt.");
        String key = datasetKey(cards);
        Collections.shuffle(cards);
        var session = new MatchGameSession();
        session.setUserId(userId);
        String name = VocabularyGameDeckProvider.text(request.displayName());
        session.setDisplayName(name.isBlank() ? "Học viên" : name.substring(0, Math.min(80, name.length())));
        session.setSource(request.source()); session.setDatasetKey(key);
        session.setCards(json(cards)); session.setStartedAt(Instant.now());
        sessions.save(session);
        return new MatchGameSessionResponse(session.getId(), key, request.source(), List.copyOf(cards), (cards.size() + 5) / 6);
    }

    @Transactional
    public MatchGameResultResponse submit(String userId, String id, SubmitMatchGameRequest request) {
        requireUser(userId);
        var session = sessions.lockOwned(id, userId).orElseThrow(MatchGameService::missing);
        // The same POST can safely be retried after a lost network response.
        if (session.getCompletedAt() != null) return resultOf(session);
        List<MatchGameCardResponse> deck;
        try { deck = mapper.readValue(session.getCards(), new TypeReference<List<MatchGameCardResponse>>() {}); }
        catch (Exception e) { throw new ApiException(ErrorCode.E280); }
        var outcome = MatchGameScorer.score(deck, request);
        long wallTenths = Duration.between(session.getStartedAt(), Instant.now()).toMillis() / 100;
        if (request.elapsedTenths() > wallTenths + 20) throw new ApiException(ErrorCode.E200, "Thời gian chơi không hợp lệ.");
        var previous = best(session);
        session.setNewBest(previous == null || outcome.score() > previous.getScore()
                || (outcome.score() == previous.getScore() && request.elapsedTenths() < previous.getElapsedTenths()));
        session.setScore(outcome.score()); session.setElapsedTenths(request.elapsedTenths());
        session.setMatchedPairs(outcome.matchedPairs()); session.setMistakes(outcome.mistakes());
        session.setMoves(json(request.moves())); session.setCompletedAt(Instant.now());
        sessions.saveAndFlush(session);
        return resultOf(session);
    }

    @Transactional(readOnly = true)
    public MatchGameResultResponse result(String userId, String id) {
        var session = owned(userId, id);
        if (session.getCompletedAt() == null) throw new ApiException(ErrorCode.CONFLICT, "Lượt chơi chưa hoàn thành.");
        return resultOf(session);
    }

    @Transactional(readOnly = true)
    public List<MatchGameLeaderboardResponse> leaderboard(String userId, String id) {
        var session = owned(userId, id);
        var entries = sessions.leaderboard(session.getDatasetKey());
        var result = new ArrayList<MatchGameLeaderboardResponse>();
        for (var row : entries) result.add(new MatchGameLeaderboardResponse(result.size() + 1, row.getUserId(),
                row.getDisplayName(), row.getScore(), row.getElapsedTenths(), userId.equals(row.getUserId())));
        return result;
    }

    private MatchGameSession owned(String userId, String id) {
        requireUser(userId);
        return sessions.findByIdAndUserIdAndDeletedFalse(id, userId).orElseThrow(MatchGameService::missing);
    }
    private MatchGameSession best(MatchGameSession session) {
        var result = sessions.findByDatasetKeyAndUserIdAndCompletedAtIsNotNullAndDeletedFalseOrderByScoreDescElapsedTenthsAsc(
                session.getDatasetKey(), session.getUserId(), PageRequest.of(0, 1));
        return result.isEmpty() ? null : result.getFirst();
    }
    private MatchGameResultResponse resultOf(MatchGameSession s) {
        var best = best(s);
        return new MatchGameResultResponse(s.getId(), s.getScore(), s.getElapsedTenths(), s.getMatchedPairs(), s.getMistakes(),
                best == null ? s.getScore() : best.getScore(), best == null ? s.getElapsedTenths() : best.getElapsedTenths(), s.isNewBest());
    }
    String datasetKey(List<MatchGameCardResponse> cards) {
        return decks.datasetKey(cards.stream().map(c -> new VocabularyGameCard(c.id(), c.term(), c.definition())).toList());
    }
    private String json(Object object) {
        try { return mapper.writeValueAsString(object); }
        catch (Exception e) { throw new ApiException(ErrorCode.E280); }
    }
    private static void requireUser(String userId) {
        if (userId == null || userId.isBlank()) throw new ApiException(ErrorCode.UNAUTHORIZED);
    }
    private static ApiException missing() { return new ApiException(ErrorCode.E227, "Không tìm thấy lượt chơi."); }
}
