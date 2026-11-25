package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import base.co.common.filter.principal.AuthPrincipal;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.client.CmsClient;
import pl.co.lms.client.IdentityClient;
import pl.co.lms.client.dto.CmsClassSession;
import pl.co.lms.dto.request.AcquireAssessmentLockRequest;
import pl.co.lms.dto.request.SaveAssessmentManualGradingRequest;
import pl.co.lms.dto.response.AssessmentGradingDetailResponse;
import pl.co.lms.dto.response.AssessmentGradingListItemResponse;
import pl.co.lms.dto.response.AssessmentLockResponse;
import pl.co.lms.entity.AssessmentAnswer;
import pl.co.lms.entity.AssessmentAnswerGradingHistory;
import pl.co.lms.entity.AssessmentAnswerGradingStatus;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentContextType;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;
import pl.co.lms.repository.AssessmentAnswerGradingHistoryRepository;
import pl.co.lms.repository.AssessmentAnswerRepository;
import pl.co.lms.repository.AssessmentAttemptRepository;
import pl.co.lms.service.grading.AssessmentGradingNotifier;
import pl.co.lms.dto.response.PartResult;
import pl.co.lms.service.grading.AssessmentGradingService;
import pl.co.lms.service.grading.QuestionAutoGrader;
import pl.co.lms.service.grading.AssessmentGradingSpecifications;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

// Admin chấm tay, duyệt điểm AI và chấm lại.
@Service
@RequiredArgsConstructor
public class AssessmentManualGradingService {

    private static final int MAX_RUBRIC_LENGTH = 20_000;
    static final String LOCK_PREFIX = "assessment-grading-lock";
    private static final long LOCK_TTL_SECONDS = 120;

    private final AssessmentAttemptRepository attemptRepository;
    private final AssessmentAnswerRepository answerRepository;
    private final AssessmentAnswerGradingHistoryRepository historyRepository;
    private final AssessmentAttemptQuestionResolver questionResolver;
    private final RedisSessionLockService redisLockService;
    private final AssessmentGradingService gradingService;
    private final AssessmentGradingNotifier notifier;
    private final IdentityClient identityClient;
    private final CmsClient cmsClient;
    private final QuestionAutoGrader autoGrader;

    /**
     * Bộ lọc danh sách chấm bài. contextType: chỉ bài trong lớp (CLASS_SESSION) hoặc chỉ bài tự luyện (SELF_STUDY), null = cả hai.
     * keyword: một từ khoá tìm chung, khớp tên/email/mã học sinh (tra ở Auth) HOẶC tên bài. classId: chỉ bài làm trong các buổi của lớp đó.
     * sessionNo: chỉ bài làm ở buổi số N (số thứ tự buổi trong lớp, null = mọi buổi); dùng cùng classId để chọn đúng buổi của một lớp.
     * startedFrom/startedTo: khoảng ngày bắt đầu làm bài, gồm cả hai đầu, tính theo giờ Việt Nam; null = không giới hạn.
     * allStatuses: xem mọi bài đã nộp (mọi trạng thái trừ NOT_SUBMITTED) thay vì một trạng thái; gradingStatus bị bỏ qua.
     */
    public record ListQuery(AssessmentGradingStatus gradingStatus, boolean allStatuses, String subType, AssessmentContextType contextType,
                            boolean provisionalOnly, String keyword, String classId, Integer sessionNo,
                            LocalDate startedFrom, LocalDate startedTo, int page, int size) {}

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** studentSearchTruncated: từ khoá khớp quá nhiều học sinh nên kết quả có thể chưa đầy đủ. */
    public record ListResult(Page<AssessmentGradingListItemResponse> page, boolean studentSearchTruncated) {}

    // Không để @Transactional: hàm này gọi Auth/CMS qua mạng, không nên giữ kết nối DB trong lúc chờ.
    public ListResult list(ListQuery query) {
        Pageable pageable = PageRequest.of(Math.max(0, query.page()), Math.min(Math.max(1, query.size()), 100),
                Sort.by(Sort.Direction.ASC, "submittedAt"));
        Set<AssessmentContextType> contexts = query.contextType() == null
                ? EnumSet.allOf(AssessmentContextType.class) : EnumSet.of(query.contextType());

        Set<String> keywordUserIds = null;
        boolean truncated = false;
        if (hasText(query.keyword())) {
            IdentityClient.UserSearchResult found = identityClient.searchUserIds(query.keyword().trim());
            keywordUserIds = found.userIds();
            truncated = found.truncated();
        }
        List<String> sessionIds = null;
        if (hasText(query.classId())) {
            sessionIds = cmsClient.getClassSessions(query.classId().trim()).stream()
                    .map(CmsClassSession::getId).filter(Objects::nonNull).toList();
        }
        // Tất cả: mọi bài đã nộp (bỏ NOT_SUBMITTED = đang làm dở). Chỉ "bài có điểm AI chưa duyệt" (không chọn trạng thái) thì
        // không ép trạng thái chấm; còn lại mặc định chờ chấm tay.
        Set<AssessmentGradingStatus> statuses;
        if (query.allStatuses()) {
            statuses = EnumSet.complementOf(EnumSet.of(AssessmentGradingStatus.NOT_SUBMITTED));
        } else if (query.gradingStatus() != null) {
            statuses = EnumSet.of(query.gradingStatus());
        } else {
            statuses = query.provisionalOnly() ? null : EnumSet.of(AssessmentGradingStatus.MANUAL_GRADING);
        }

        Page<AssessmentAttempt> result = attemptRepository.findAll(AssessmentGradingSpecifications.of(
                new AssessmentGradingSpecifications.Filter(statuses, ResourceSubTypes.normalize(query.subType()), contexts, query.provisionalOnly(),
                        keywordUserIds, sessionIds, query.sessionNo(), ResourceSearchColumns.normalize(query.keyword()),
                        query.startedFrom() == null ? null : query.startedFrom().atStartOfDay(BUSINESS_ZONE).toInstant(),
                        // "Đến ngày" gồm cả ngày đó: giới hạn trên là đầu ngày kế tiếp.
                        query.startedTo() == null ? null : query.startedTo().plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant())),
                pageable);

        Set<String> withProvisional = new HashSet<>();
        Map<String, IdentityClient.UserSummary> users = Map.of();
        if (!result.isEmpty()) {
            withProvisional.addAll(answerRepository.findAttemptIdsWithStatus(
                    result.getContent().stream().map(AssessmentAttempt::getId).toList(),
                    AssessmentAnswerGradingStatus.AI_GRADED));
            users = identityClient.lookupByIds(result.getContent().stream().map(AssessmentAttempt::getUserId).toList());
        }
        Map<String, IdentityClient.UserSummary> userById = users;
        return new ListResult(result.map(a -> AssessmentGradingListItemResponse.from(
                a, withProvisional.contains(a.getId()), titleOf(a), userById.get(a.getUserId()))), truncated);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    // Không @Transactional (xem list): các lần đọc DB tự chạy giao dịch riêng, tra tên học sinh ở Auth không giữ kết nối DB.
    public AssessmentGradingDetailResponse detail(String attemptId) {
        AssessmentAttempt attempt = attemptRepository.findByIdAndDeletedFalse(attemptId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "AssessmentAttempt không tồn tại"));
        Map<String, AssessmentAnswer> byQuestionId = new HashMap<>();
        for (AssessmentAnswer a : answerRepository.findByAttemptIdAndDeletedFalse(attemptId)) {
            byQuestionId.put(a.getQuestionId(), a);
        }

        QuizContent quizContent = questionResolver.getQuizContent(attempt.getLearningResourceVersionId());
        List<QuizQuestion> questions = quizContent != null && quizContent.getQuestions() != null
                ? quizContent.getQuestions() : List.of();

        List<AssessmentGradingDetailResponse.Item> items = new ArrayList<>();
        int order = 1;
        for (QuizQuestion question : questions) {
            QuestionContent q = QuestionContent.from(question);
            AssessmentAnswer a = byQuestionId.get(question.getQuestionId());
            AssessmentAnswerGradingStatus status = a == null ? AssessmentAnswerGradingStatus.UNGRADED : a.getGradingStatus();
            items.add(new AssessmentGradingDetailResponse.Item(
                    a == null ? null : a.getId(), question.getQuestionId(), order++, q,
                    a == null ? null : a.getAnswerJson(), status,
                    a == null ? null : a.getEarnedPoints(), a == null ? null : a.getMaxPoints(),
                    a == null ? null : a.getGraderComment(), a == null ? null : a.getGraderId(),
                    sourceOf(status), status == AssessmentAnswerGradingStatus.AI_GRADED,
                    a == null ? null : a.getRubricScores(),
                    question.getGradingCriteria(),
                    partsOf(q, a == null ? null : a.getAnswerJson())));
        }
        // Người chấm thấy bố cục đầy đủ (kể cả grading và explanation).
        JsonNode layout = quizContent == null ? null : LayoutFilter.forGrader(quizContent.getLayout());
        IdentityClient.UserSummary student = identityClient.lookupByIds(List.of(attempt.getUserId())).get(attempt.getUserId());
        return new AssessmentGradingDetailResponse(attempt.getId(), attempt.getUserId(), attempt.getSessionId(),
                attempt.getSessionNo(), attempt.getStatus(), attempt.getGradingStatus(),
                attempt.getEarnedPoints(), attempt.getTotalPoints(), attempt.getSubmittedAt(), items,
                attempt.getSubType(), attempt.getContextType(), quizContent == null ? null : quizContent.getTitle(), layout,
                student == null ? null : student.getFullName(), student == null ? null : student.getEmail(),
                student == null ? null : student.getUserCode());
    }

    private List<PartResult> partsOf(QuestionContent question, String answerJson) {
        List<PartResult> parts = autoGrader.partResults(question, answerJson);
        return parts.isEmpty() ? null : parts;
    }

    private String titleOf(AssessmentAttempt attempt) {
        QuizContent content = questionResolver.getQuizContent(attempt.getLearningResourceVersionId());
        return content == null ? null : content.getTitle();
    }

    public AssessmentLockResponse acquireLock(String attemptId, AcquireAssessmentLockRequest req) {
        String adminId = currentUserId();
        RedisSessionLockService.LockResult result = redisLockService.acquireOrRenew(
                LOCK_PREFIX, attemptId, adminId, req.sessionToken(), LOCK_TTL_SECONDS, req.force());
        return new AssessmentLockResponse(result.acquired(), result.holderUserId(), result.expiresAt(), Instant.now(), null);
    }

    public AssessmentLockResponse releaseLock(String attemptId, String sessionToken) {
        String adminId = currentUserId();
        redisLockService.release(LOCK_PREFIX, attemptId, sessionToken);
        return new AssessmentLockResponse(true, adminId, null, Instant.now(), null);
    }

    @Transactional
    public void save(String attemptId, SaveAssessmentManualGradingRequest req) {
        String adminId = currentUserId();
        AssessmentAttempt attempt = attemptRepository.findByIdForUpdate(attemptId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "AssessmentAttempt không tồn tại"));
        AssessmentGradingStatus gradingStatus = attempt.getGradingStatus();
        if (attempt.getStatus() == AssessmentAttemptStatus.IN_PROGRESS
                || gradingStatus == AssessmentGradingStatus.NOT_SUBMITTED || gradingStatus == AssessmentGradingStatus.PENDING) {
            throw new ApiException(ErrorCode.E221, "Bài chưa qua bước chấm tự động");
        }
        if (!redisLockService.isHeldBy(LOCK_PREFIX, attemptId, req.sessionToken())) {
            throw new ApiException(ErrorCode.E425, "Bạn không còn giữ khoá chấm bài này");
        }

        List<AssessmentAnswer> answers = answerRepository.findByAttemptIdAndDeletedFalse(attemptId);
        Map<String, AssessmentAnswer> byId = new HashMap<>();
        for (AssessmentAnswer a : answers) byId.put(a.getId(), a);

        boolean wasGraded = gradingStatus == AssessmentGradingStatus.GRADED;
        boolean scoreChangedForStudent = false;
        Instant now = Instant.now();
        List<AssessmentAnswerGradingHistory> histories = new ArrayList<>();
        for (SaveAssessmentManualGradingRequest.Item item : req.items()) {
            AssessmentAnswer answer = byId.get(item.answerId());
            if (answer == null) {
                throw new ApiException(ErrorCode.E221, "answerId không thuộc bài làm này: " + item.answerId());
            }
            if (answer.getGradingStatus() == AssessmentAnswerGradingStatus.AI_PENDING) {
                throw new ApiException(ErrorCode.E221, "Câu đang được chấm tự động, chưa thể sửa điểm");
            }
            BigDecimal max = answer.getMaxPoints() == null ? BigDecimal.ZERO : answer.getMaxPoints();
            // Điểm theo tiêu chí (rubricScores) là JSON mờ do frontend tính; backend chỉ lưu và giới hạn dung lượng.
            JsonNode rubric = item.rubricScores() == null || item.rubricScores().isNull() ? null : item.rubricScores();
            if (rubric != null && rubric.toString().length() > MAX_RUBRIC_LENGTH) {
                throw new ApiException(ErrorCode.E221, "rubricScores quá lớn");
            }
            BigDecimal earned = item.earnedPoints().setScale(2, RoundingMode.HALF_UP);
            if (earned.compareTo(max) > 0) {
                throw new ApiException(ErrorCode.E221, "earnedPoints vượt maxPoints của câu " + item.answerId());
            }

            BigDecimal previousPoints = answer.getEarnedPoints();
            String previousComment = answer.getGraderComment();
            answer.setEarnedPoints(earned);
            answer.setGraderComment(item.graderComment());
            answer.setGraderId(adminId);
            answer.setGradedAt(now);
            if (rubric != null) {
                answer.setRubricScores(rubric);
            }
            attempt.setGradingMethod("MANUAL");
            answer.setGradingStatus(isAlreadyFinal(answer.getGradingStatus())
                    ? AssessmentAnswerGradingStatus.SCORE_UPDATED : AssessmentAnswerGradingStatus.MANUAL_GRADED);
            if (previousPoints != null && previousPoints.compareTo(earned) != 0) {
                scoreChangedForStudent = true;
            }
            histories.add(gradingService.newHistory(answer, previousPoints, previousComment, adminId,
                    item.graderComment(), now));
        }
        answerRepository.saveAll(answers);
        historyRepository.saveAll(histories);

        gradingService.recompute(attempt, answers);
        if (wasGraded && scoreChangedForStudent) {
            notifier.notifyRegraded(attempt);
        }
    }

    private boolean isAlreadyFinal(AssessmentAnswerGradingStatus status) {
        return status == AssessmentAnswerGradingStatus.AUTO_GRADED
                || status == AssessmentAnswerGradingStatus.MANUAL_GRADED
                || status == AssessmentAnswerGradingStatus.SCORE_UPDATED;
    }

    private static String sourceOf(AssessmentAnswerGradingStatus status) {
        return switch (status) {
            case AUTO_GRADED -> "AUTO";
            case AI_GRADED -> "AI";
            case MANUAL_GRADED, SCORE_UPDATED -> "MANUAL";
            default -> null;
        };
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof AuthPrincipal principal) {
            return principal.userId();
        }
        throw new ApiException(ErrorCode.UNAUTHORIZED, "Yêu cầu đăng nhập");
    }
}
