package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.request.StartBlastGameRequest;
import pl.co.lms.dto.request.SubmitBlastGameRequest;
import pl.co.lms.dto.response.BlastGameLeaderboardResponse;
import pl.co.lms.dto.response.BlastGameResultResponse;
import pl.co.lms.dto.response.BlastGameSessionResponse;
import pl.co.lms.entity.BlastGameSession;
import pl.co.lms.entity.BlastGameSource;
import pl.co.lms.entity.json.VocabularyGameCard;
import pl.co.lms.repository.BlastGameSessionRepository;
import pl.co.lms.service.game.BlastGameScorer;
import pl.co.lms.service.game.VocabularyGameDeckProvider;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BlastGameService {
    private final BlastGameSessionRepository sessions;
    private final VocabularyGameDeckProvider decks;
    private final ObjectMapper mapper;

    @Transactional(readOnly = true)
    public List<VocabularyGameCard> deck(String userId, BlastGameSource source) {
        requireUser(userId);
        if (source == null) throw new ApiException(ErrorCode.E200);
        var cards = source == BlastGameSource.DEMO ? VocabularyGameDeckProvider.demo() : decks.library(32);
        if (cards.size() < 2) throw new ApiException(ErrorCode.E227, "Kho cần ít nhất 2 từ đã xuất bản, có nghĩa tiếng Việt để chơi.");
        return List.copyOf(cards);
    }

    @Transactional
    public BlastGameSessionResponse start(String userId, StartBlastGameRequest request) {
        var cards = new ArrayList<>(deck(userId, request.source()));
        String key = decks.datasetKey(cards);
        Collections.shuffle(cards);
        var session = new BlastGameSession();
        session.setUserId(userId);
        String name = VocabularyGameDeckProvider.text(request.displayName());
        session.setDisplayName(name.isBlank() ? "Học viên" : name.substring(0, Math.min(80, name.length())));
        session.setSource(request.source()); session.setDatasetKey(key); session.setCards(json(cards));
        session.setTotalWords(cards.size()); session.setStartedAt(Instant.now());
        sessions.save(session);
        return new BlastGameSessionResponse(session.getId(), key, request.source(), List.copyOf(cards), cards.size() * 6000);
    }

    @Transactional
    public BlastGameResultResponse submit(String userId, String id, SubmitBlastGameRequest request) {
        requireUser(userId);
        var session = sessions.lockOwned(id, userId).orElseThrow(BlastGameService::missing);
        if (session.getCompletedAt() != null) return resultOf(session);
        List<VocabularyGameCard> cards;
        try { cards = mapper.readValue(session.getCards(), new TypeReference<List<VocabularyGameCard>>() {}); }
        catch (Exception e) { throw new ApiException(ErrorCode.E280, e); }
        var outcome = BlastGameScorer.score(cards, request);
        long wallMs = Duration.between(session.getStartedAt(), Instant.now()).toMillis();
        if (request.elapsedMs() > wallMs + 2000) throw new ApiException(ErrorCode.E200, "Thời gian chơi không hợp lệ.");
        var previous = best(session);
        // Original blastScore.service: higher score, then faster time; only a better attempt replaces a best.
        session.setNewBest(previous == null || outcome.score() > previous.getScore()
                || (outcome.score() == previous.getScore() && request.elapsedMs() < previous.getElapsedMs()));
        session.setScore(outcome.score()); session.setAnswered(outcome.answered()); session.setMistakes(outcome.mistakes());
        session.setElapsedMs(request.elapsedMs()); session.setReason(request.reason()); session.setHits(json(request.hits()));
        session.setCompletedAt(Instant.now()); sessions.saveAndFlush(session);
        return resultOf(session);
    }

    @Transactional(readOnly = true)
    public BlastGameResultResponse result(String userId, String id) {
        var session = owned(userId, id);
        if (session.getCompletedAt() == null) throw new ApiException(ErrorCode.CONFLICT, "Lượt chơi chưa kết thúc.");
        return resultOf(session);
    }

    @Transactional(readOnly = true)
    public List<BlastGameLeaderboardResponse> leaderboard(String userId, String id) {
        var session = owned(userId, id);
        var result = new ArrayList<BlastGameLeaderboardResponse>();
        for (var row : sessions.leaderboard(session.getDatasetKey())) result.add(new BlastGameLeaderboardResponse(
                result.size() + 1, row.getUserId(), row.getDisplayName(), row.getScore(), row.getElapsedMs(), userId.equals(row.getUserId())));
        return result;
    }

    private BlastGameSession owned(String userId, String id) {
        requireUser(userId);
        return sessions.findByIdAndUserIdAndDeletedFalse(id, userId).orElseThrow(BlastGameService::missing);
    }
    private BlastGameSession best(BlastGameSession session) {
        var result = sessions.findByDatasetKeyAndUserIdAndCompletedAtIsNotNullAndDeletedFalseOrderByScoreDescElapsedMsAsc(
                session.getDatasetKey(), session.getUserId(), PageRequest.of(0, 1));
        return result.isEmpty() ? null : result.getFirst();
    }
    private BlastGameResultResponse resultOf(BlastGameSession s) {
        var best = best(s);
        return new BlastGameResultResponse(s.getId(), s.getScore(), s.getElapsedMs(), s.getAnswered(), s.getTotalWords(), s.getMistakes(), s.getReason(),
                best == null ? s.getScore() : best.getScore(), best == null ? s.getElapsedMs() : best.getElapsedMs(), s.isNewBest());
    }
    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception e) { throw new ApiException(ErrorCode.E280, e); }
    }
    private static void requireUser(String userId) {
        if (userId == null || userId.isBlank()) throw new ApiException(ErrorCode.UNAUTHORIZED);
    }
    private static ApiException missing() { return new ApiException(ErrorCode.E227, "Không tìm thấy lượt chơi."); }
}
