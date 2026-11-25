package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.request.*;
import pl.co.lms.dto.response.*;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.*;
import pl.co.lms.repository.QuadWordSessionRepository;
import pl.co.lms.service.game.QuadWordCandidateProvider;
import pl.co.lms.service.game.QuadWordEngine;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class QuadWordService {
    private final QuadWordSessionRepository sessions;
    private final QuadWordCandidateProvider candidates;
    private final ObjectMapper mapper;

    @Transactional(readOnly = true)
    public List<QuadWordCollectionResponse> collections(String userId) {
        requireUser(userId);
        return candidates.collections().stream().map(collection -> {
            var learned = new java.util.HashSet<>(sessions.learnedResourceIds(userId, collection.id()));
            int count = (int) collection.words().stream().filter(word -> learned.contains(word.resourceId())).count();
            return new QuadWordCollectionResponse(collection.id(), collection.title(), collection.words().size(), count);
        }).toList();
    }

    @Transactional
    public QuadWordSessionResponse start(String userId, StartQuadWordRequest request) {
        requireUser(userId);
        if (request.source() == null) throw new ApiException(ErrorCode.E200);
        var previous = sessions.findFirstByUserIdAndSourceAndDeletedFalseOrderByCreatedAtDescIdDesc(userId, request.source());
        String previousAnswer = previous.map(s -> candidate(s).answer()).orElse(null);
        QuadWordCandidateProvider.Collection collection = null;
        java.util.List<QuadWordCandidate> pool;
        if (request.collectionId() != null) {
            collection = candidates.collections().stream().filter(item -> item.id().equals(request.collectionId()))
                    .findFirst().orElseThrow(() -> new ApiException(ErrorCode.E227, "Cấp độ không tồn tại trong kho từ vựng."));
            if (collection.words().isEmpty()) return null;
            var learned = new java.util.HashSet<>(sessions.learnedResourceIds(userId, collection.id()));
            pool = collection.words().stream().filter(word -> !learned.contains(word.resourceId())).toList();
            if (pool.isEmpty()) pool = collection.words(); // Completed set can be reviewed without resetting progress.
        } else pool = candidates.candidates();
        var selected = candidates.choose(pool, previousAnswer);
        if (selected == null) return null;
        var session = new QuadWordSession();
        session.setUserId(userId); session.setSource(request.source()); session.setStatus(QuadWordStatus.PLAYING);
        session.setCandidate(json(selected)); session.setGuesses("[]");
        session.setExpiresAt(Instant.now().plus(Duration.ofHours(24)));
        session.setCandidateResourceId(selected.resourceId());
        if (collection != null) {
            session.setCollectionKey(collection.id()); session.setCollectionTitle(collection.title());
            session.setCollectionTotal(collection.words().size());
        }
        sessions.save(session);
        return response(session);
    }

    @Transactional(readOnly = true)
    public QuadWordSessionResponse get(String userId, String id) {
        requireUser(userId);
        var session = sessions.findByIdAndUserIdAndDeletedFalse(id, userId).orElseThrow(QuadWordService::missing);
        requireActive(session);
        return response(session);
    }

    @Transactional
    public QuadWordSessionResponse guess(String userId, String id, SubmitQuadWordGuessRequest request) {
        requireUser(userId);
        var session = sessions.lockOwned(id, userId).orElseThrow(QuadWordService::missing);
        requireActive(session);
        var candidate = candidate(session);
        String letters = QuadWordEngine.validate(request.input(), candidate.answer());
        var guesses = new ArrayList<>(guesses(session));
        for (var guess : guesses) {
            if (!guess.requestId().equals(request.requestId())) continue;
            if (!guess.letters().equals(letters)) throw new ApiException(ErrorCode.CONFLICT, "Mã lượt đoán đã được dùng cho nội dung khác.");
            return response(session);
        }
        if (session.getStatus() != QuadWordStatus.PLAYING)
            throw new ApiException(ErrorCode.CONFLICT, "Ván này đã kết thúc. Bạn hãy chọn Chơi tiếp nhé.");
        if (request.expectedGuessCount() != guesses.size())
            throw new ApiException(ErrorCode.CONFLICT, "Ván chơi đã có lượt đoán mới. Vui lòng đồng bộ rồi thử lại.");
        if (guesses.stream().anyMatch(g -> g.letters().equals(letters)))
            throw new ApiException(ErrorCode.E200, "Bạn đã thử đáp án này rồi. Hãy thử một đáp án khác nhé.");
        String answer = QuadWordEngine.letters(candidate.answer());
        guesses.add(new QuadWordGuess(request.requestId(), letters, QuadWordEngine.evaluate(answer, letters)));
        session.setGuesses(json(guesses));
        if (letters.equals(answer)) session.setStatus(QuadWordStatus.WON);
        else if (guesses.size() == QuadWordEngine.MAX_GUESSES) session.setStatus(QuadWordStatus.LOST);
        sessions.saveAndFlush(session);
        return response(session);
    }

    private QuadWordSessionResponse response(QuadWordSession session) {
        var candidate = candidate(session);
        var guesses = guesses(session).stream().map(g -> new QuadWordGuessResponse(g.letters(), g.feedback())).toList();
        return new QuadWordSessionResponse(session.getId(), session.getSource(),
                QuadWordEngine.pattern(candidate.answer()), QuadWordEngine.letters(candidate.answer()).length(),
                guesses, QuadWordEngine.MAX_GUESSES - guesses.size(), session.getStatus(),
                session.getStatus() == QuadWordStatus.PLAYING ? null : candidate.review().withMeaning(candidate.meaning()), collectionProgress(session));
    }
    private QuadWordCollectionResponse collectionProgress(QuadWordSession session) {
        if (session.getCollectionKey() == null || session.getCollectionTotal() == null) return null;
        int learned = sessions.learnedResourceIds(session.getUserId(), session.getCollectionKey()).size();
        return new QuadWordCollectionResponse(session.getCollectionKey(), session.getCollectionTitle(),
                session.getCollectionTotal(), Math.min(learned, session.getCollectionTotal()));
    }
    private QuadWordCandidate candidate(QuadWordSession session) {
        try { return mapper.readValue(session.getCandidate(), QuadWordCandidate.class); }
        catch (JsonProcessingException e) { throw new ApiException(ErrorCode.E280); }
    }
    private List<QuadWordGuess> guesses(QuadWordSession session) {
        try { return mapper.readValue(session.getGuesses(), new TypeReference<List<QuadWordGuess>>() {}); }
        catch (JsonProcessingException e) { throw new ApiException(ErrorCode.E280); }
    }
    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new ApiException(ErrorCode.E280); }
    }
    private void requireActive(QuadWordSession session) {
        if (!session.getExpiresAt().isAfter(Instant.now())) throw missing();
    }
    private static void requireUser(String userId) {
        if (userId == null || userId.isBlank()) throw new ApiException(ErrorCode.UNAUTHORIZED);
    }
    private static ApiException missing() {
        return new ApiException(ErrorCode.E227, "Không tìm thấy ván chơi hoặc ván đã hết hạn. Vui lòng chọn nguồn để chơi lại.");
    }
}
