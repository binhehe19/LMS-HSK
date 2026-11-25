package pl.co.lms.service.progress;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.client.CmsClient;
import pl.co.lms.client.dto.CmsMyClass;
import pl.co.lms.client.dto.CmsMySessionShared;
import pl.co.lms.dto.response.ClassHomeworkProgressResponse;
import pl.co.lms.dto.response.SessionHomeworkProgressResponse;
import pl.co.lms.entity.LearningResourceState;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.entity.VocabularyComprehensionLevel;
import pl.co.lms.repository.LearningResourceStateRepository;
import pl.co.lms.repository.AssessmentAttemptRepository;
import pl.co.lms.service.progress.HomeworkProgressCalculator.Cluster;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

// Tiến độ bài tập của học sinh, tính hoàn toàn ở backend (FE chỉ hiển thị). Công thức và định nghĩa: docs/homework-progress-metrics.md.
// Nguồn dữ liệu: buổi học từ CMS, danh sách bài/từ theo buổi từ SessionUnitsProvider, attempt đã nộp/đóng (assessment_attempts)
// và mức thuộc từ (learning_resource_states.comprehension_level = KNOWN).
@Service
@RequiredArgsConstructor
public class HomeworkProgressService {

    private static final List<AssessmentAttemptStatus> FINISHED = List.of(AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIME_OUT);
    private static final int STATE_QUERY_CHUNK = 500;
    private static final String CANCELLED = "CANCELLED";

    private final CmsClient cmsClient;
    private final SessionUnitsProvider unitsProvider;
    private final AssessmentAttemptRepository attemptRepository;
    private final LearningResourceStateRepository stateRepository;

    // Kết quả tính cho một buổi kèm dữ liệu gốc, để cấp lớp gom lại mà không tính lại.
    private record SessionResult(
            CmsMySessionShared session,
            SessionUnits units,
            Map<String, AssessmentAttempt> latestAttemptByResource,
            HomeworkProgressCalculator.Session progress) {}

    @Transactional(readOnly = true)
    public ClassHomeworkProgressResponse getClassProgress(String userId, String classId) {
        CmsMyClass myClass = requireMyClass(classId);
        List<CmsMySessionShared> sessions = cmsClient.getMyClassSessions(classId).stream()
                .filter(s -> s.getSessionNo() != null && !CANCELLED.equals(s.getStatus()))
                .toList();
        List<SessionResult> results = compute(userId, myClass.getSyllabusId(), sessions);

        // Tiến độ cá nhân: trung bình mọi buổi có dữ liệu (buổi có nội dung mà chưa làm là 0%, buổi không có nội dung bị bỏ).
        Double personal = HomeworkProgressCalculator.average(
                results.stream().map(r -> r.progress().personalProgress()).toList());
        // Chuyên cần bài tập: chỉ các buổi đã có ít nhất một bài đã làm.
        Double diligence = HomeworkProgressCalculator.average(
                results.stream().filter(r -> r.progress().totalDoneUnits() > 0)
                        .map(r -> r.progress().homeworkProgress()).toList());
        // Điểm trung bình: mỗi bài đã chấm xong (GRADED) một phiếu, qua mọi buổi và cả 3 cụm.
        List<Double> scores = new ArrayList<>();
        for (SessionResult r : results) {
            for (List<String> unitIds : List.of(r.units().grammarUnits(), r.units().vocabularyUnits(), r.units().quickTestUnits())) {
                for (String resourceId : unitIds) {
                    AssessmentAttempt attempt = r.latestAttemptByResource().get(resourceId);
                    if (attempt != null && attempt.getGradingStatus() == AssessmentGradingStatus.GRADED) {
                        scores.add(HomeworkProgressCalculator.attemptPercent(attempt.getEarnedPoints(), attempt.getTotalPoints()));
                    }
                }
            }
        }
        return new ClassHomeworkProgressResponse(
                personal, diligence, HomeworkProgressCalculator.average(scores),
                results.stream().map(this::toResponse).toList());
    }

    @Transactional(readOnly = true)
    public SessionHomeworkProgressResponse getSessionProgress(String userId, String classId, String sessionId) {
        CmsMyClass myClass = requireMyClass(classId);
        CmsMySessionShared session = cmsClient.getMyClassSessions(classId).stream()
                .filter(s -> sessionId.equals(s.getId()))
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Không tìm thấy buổi học trong lớp"));
        List<SessionResult> results = compute(userId, myClass.getSyllabusId(), List.of(session));
        return toResponse(results.get(0));
    }

    private List<SessionResult> compute(String userId, String syllabusId, List<CmsMySessionShared> sessions) {
        if (sessions.isEmpty()) return List.of();

        Map<String, SessionUnits> unitsBySessionId = new HashMap<>();
        Set<String> allWordIds = new HashSet<>();
        for (CmsMySessionShared s : sessions) {
            SessionUnits units = syllabusId == null || s.getSessionNo() == null
                    ? SessionUnits.EMPTY : unitsProvider.get(syllabusId, s.getSessionNo());
            unitsBySessionId.put(s.getId(), units);
            allWordIds.addAll(units.wordResourceIds());
        }
        Map<String, Map<String, AssessmentAttempt>> attempts = latestFinishedAttempts(
                userId, sessions.stream().map(CmsMySessionShared::getId).toList());
        Set<String> knownWordIds = knownWordIds(userId, allWordIds);

        List<SessionResult> results = new ArrayList<>();
        for (CmsMySessionShared s : sessions) {
            SessionUnits units = unitsBySessionId.get(s.getId());
            Map<String, AssessmentAttempt> latest = attempts.getOrDefault(s.getId(), Map.of());
            int known = (int) units.wordResourceIds().stream().filter(knownWordIds::contains).count();
            Cluster grammar = HomeworkProgressCalculator.exerciseCluster(
                    units.grammarUnits().size(), countDone(units.grammarUnits(), latest));
            Cluster vocabulary = HomeworkProgressCalculator.vocabularyCluster(
                    units.vocabularyUnits().size(), countDone(units.vocabularyUnits(), latest),
                    units.wordResourceIds().size(), known);
            Cluster quickTest = HomeworkProgressCalculator.exerciseCluster(
                    units.quickTestUnits().size(), countDone(units.quickTestUnits(), latest));
            results.add(new SessionResult(s, units, latest, HomeworkProgressCalculator.session(grammar, vocabulary, quickTest)));
        }
        return results;
    }

    // Với mỗi (buổi, bài) lấy attempt đã nộp/đóng MỚI NHẤT (theo thời điểm bắt đầu) - trường hợp làm lại nhiều lần.
    // Bài được nhận diện bằng learningResourceId (nhiều bài có thể cùng nằm trong 1 học phần).
    private Map<String, Map<String, AssessmentAttempt>> latestFinishedAttempts(String userId, List<String> sessionIds) {
        Map<String, Map<String, AssessmentAttempt>> bySession = new HashMap<>();
        for (AssessmentAttempt a : attemptRepository.findByUserIdAndSessionIdInAndStatusInAndDeletedFalse(userId, sessionIds, FINISHED)) {
            Map<String, AssessmentAttempt> byResource = bySession.computeIfAbsent(a.getSessionId(), k -> new HashMap<>());
            AssessmentAttempt current = byResource.get(a.getLearningResourceId());
            if (current == null || a.getCreatedAt().isAfter(current.getCreatedAt())) {
                byResource.put(a.getLearningResourceId(), a);
            }
        }
        return bySession;
    }

    private Set<String> knownWordIds(String userId, Set<String> wordIds) {
        Set<String> known = new HashSet<>();
        List<String> ids = new ArrayList<>(wordIds);
        for (int from = 0; from < ids.size(); from += STATE_QUERY_CHUNK) {
            List<String> chunk = ids.subList(from, Math.min(ids.size(), from + STATE_QUERY_CHUNK));
            for (LearningResourceState state : stateRepository.findByUserIdAndLearningResourceIdInAndDeletedFalse(userId, chunk)) {
                if (state.getComprehensionLevel() == VocabularyComprehensionLevel.KNOWN) {
                    known.add(state.getLearningResourceId());
                }
            }
        }
        return known;
    }

    private int countDone(List<String> unitResourceIds, Map<String, AssessmentAttempt> latestAttemptByResource) {
        return (int) unitResourceIds.stream().filter(latestAttemptByResource::containsKey).count();
    }

    // Kiểm tra học sinh thuộc lớp (CMS tự lọc theo JWT người gọi).
    private CmsMyClass requireMyClass(String classId) {
        return cmsClient.getMyClasses(null).stream()
                .filter(c -> classId.equals(c.getId()))
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN, "Bạn không tham gia lớp học này"));
    }

    private SessionHomeworkProgressResponse toResponse(SessionResult r) {
        HomeworkProgressCalculator.Session p = r.progress();
        return new SessionHomeworkProgressResponse(
                r.session().getId(), r.session().getSessionNo(),
                p.homeworkProgress(), p.personalProgress(),
                toDto(p.grammar()), toDto(p.vocabulary()), toDto(p.quickTest()));
    }

    private SessionHomeworkProgressResponse.Cluster toDto(Cluster c) {
        return new SessionHomeworkProgressResponse.Cluster(
                c.percent(), c.doneUnits(), c.totalUnits(), c.knownWords(), c.totalWords());
    }
}
