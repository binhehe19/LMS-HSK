package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import base.co.common.filter.principal.AuthPrincipal;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.client.CmsClient;
import pl.co.lms.client.dto.CmsMyClass;
import pl.co.lms.client.dto.CmsMySessionShared;
import pl.co.lms.dto.request.AcquireAssessmentLockRequest;
import pl.co.lms.dto.request.HeartbeatAssessmentAttemptRequest;
import pl.co.lms.dto.request.SaveAnnotationsRequest;
import pl.co.lms.dto.request.SaveAttemptDraftRequest;
import pl.co.lms.dto.request.StartAssessmentAttemptRequest;
import pl.co.lms.dto.request.StartSelfStudyAttemptRequest;
import pl.co.lms.dto.request.SubmitAssessmentAttemptRequest;
import pl.co.lms.dto.response.HeartbeatAssessmentAttemptResponse;
import pl.co.lms.dto.response.AssessmentAttemptHistoryResponse;
import pl.co.lms.dto.response.AssessmentAttemptResponse;
import pl.co.lms.dto.response.AssessmentLockResponse;
import pl.co.lms.dto.response.SubmitAssessmentAttemptResponse;
import pl.co.lms.entity.AssessmentContextType;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.AssessmentAnswer;
import pl.co.lms.entity.AssessmentAnswerGradingStatus;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;
import pl.co.lms.entity.json.QuestionPublicContent;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.AssessmentAnswerRepository;
import pl.co.lms.repository.AssessmentAttemptRepository;
import pl.co.lms.service.grading.AssessmentGradingEventPublisher;
import pl.co.lms.service.grading.AssessmentGradingService;
import pl.co.lms.service.grading.QuestionAutoGrader;
import pl.co.lms.service.practice.PracticeCatalogService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class AssessmentAttemptService {

    private static final String LOCK_PREFIX = "assessment-attempt-lock";
    private static final long LOCK_TTL_SECONDS = 60;
    private static final int MAX_CLIENT_STATE_LENGTH = 200_000;
    private static final int DEFAULT_MAX_ANSWER_LENGTH = 120_000;

    private final AssessmentAttemptRepository attemptRepository;
    private final AssessmentAnswerRepository answerRepository;
    private final LearningResourceRepository resourceRepository;
    private final ContentPackageVersionRepository versionRepository;
    private final ContentPackageVersionResourceRepository versionResourceRepository;
    private final AssessmentAttemptQuestionResolver questionResolver;
    private final RedisSessionLockService redisLockService;
    private final CmsClient cmsClient;
    private final AssessmentGradingEventPublisher gradingEventPublisher;
    private final SyllabusPackageService mappingService;
    private final QuizAnswerSanitizer answerSanitizer;
    private final AssessmentGradingService gradingService;
    private final PracticeCatalogService practiceCatalog;
    private final QuestionAutoGrader questionAutoGrader;

    // Lớp và buổi học thật (do CMS trả về) mà học sinh đang làm bài trong đó.
    private record ResolvedSession(CmsMyClass myClass, CmsMySessionShared session) {}

    // ── Phase 01: startOrResume ──────────────────────────────────────────────────

    // Tạo hoặc trả lại attempt đang làm dở. Idempotent theo
    // (userId, learningResourceId, sessionId) WHERE status=IN_PROGRESS.
    public AssessmentAttemptResponse startOrResume(StartAssessmentAttemptRequest req) {
        String userId = currentUserId();

        // Xác minh học sinh thuộc lớp chứa sessionId — CMS tự scope theo JWT người gọi.
        ResolvedSession resolved = resolveSession(req.sessionId(), req.classId());

        ContentPackageVersion version = versionRepository
                .findByIdAndDeletedFalse(req.contentPackageVersionId())
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "ContentPackageVersion không tồn tại"));
        if (version.getStatus() != ContentPackageVersionStatus.PUBLISHED) {
            throw new ApiException(ErrorCode.E220, "Chỉ được làm bài từ package version đã PUBLISHED");
        }

        // Tìm link-row để lấy learningResourceVersionId
        ContentPackageVersionResource link = versionResourceRepository
                .findByContentPackageVersionIdAndLearningResourceIdAndDeletedFalse(
                        req.contentPackageVersionId(), req.learningResourceId())
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Resource không thuộc package version này"));

        // Tìm attempt đang làm dở — nếu có thì resume, không thì tạo mới.
        AssessmentAttempt attempt = attemptRepository
                .findByUserIdAndLearningResourceIdAndSessionIdAndStatusAndDeletedFalse(
                        userId, req.learningResourceId(), req.sessionId(), AssessmentAttemptStatus.IN_PROGRESS)
                .orElseGet(() -> {
                    int sessionNo = requireQuizAssignedToSession(resolved, version, link);
                    QuizContent quizContent = questionResolver.getQuizContent(link.getLearningResourceVersionId());
                    return createAttempt(userId, req, sessionNo, version, link, quizContent);
                });

        return buildResponse(attempt);
    }

    // Lịch sử các lần làm một bài trong một buổi của chính người gọi (mới nhất trước).
    @Transactional(readOnly = true)
    public AssessmentAttemptHistoryResponse listMyAttempts(String learningResourceId, String sessionId) {
        String userId = currentUserId();
        List<AssessmentAttempt> attempts = attemptRepository
                .findTop100ByUserIdAndLearningResourceIdAndSessionIdAndDeletedFalseOrderByCreatedAtDesc(
                        userId, learningResourceId, sessionId);
        long total = attemptRepository.countByUserIdAndLearningResourceIdAndSessionIdAndDeletedFalse(
                userId, learningResourceId, sessionId);

        return historyResponse(attempts, total);
    }
    private AssessmentAttemptHistoryResponse historyResponse(List<AssessmentAttempt> attempts, long total) {
        Instant now = Instant.now();
        List<AssessmentAttemptHistoryResponse.Item> items = new ArrayList<>();
        for (int i = 0; i < attempts.size(); i++) {
            AssessmentAttempt a = attempts.get(i);
            AssessmentAttemptStatus status = effectiveStatus(a);
            BigDecimal percent = a.getTotalPoints() != null && a.getTotalPoints().signum() > 0
                    ? a.getEarnedPoints().multiply(BigDecimal.valueOf(100))
                            .divide(a.getTotalPoints(), 2, RoundingMode.HALF_UP)
                    : null;
            items.add(new AssessmentAttemptHistoryResponse.Item(
                    a.getId(), (int) (total - i), status, a.getGradingStatus(), a.getCreatedAt(),
                    a.getSubmittedAt(), a.getEarnedPoints(), a.getTotalPoints(), percent,
                    status == AssessmentAttemptStatus.IN_PROGRESS ? computeRemaining(a, now) : null));
        }

        return new AssessmentAttemptHistoryResponse(items);
    }

    // Chỉ cho bắt đầu lần làm mới khi bài thật sự thuộc buổi này của giáo trình lớp học sinh: học phần chứa bài được gắn
    // vào giáo trình của lớp, loại học phần mở bài tập cho học viên, và bài nằm đúng buổi. Trả về số buổi do CMS xác nhận.
    private int requireQuizAssignedToSession(ResolvedSession resolved, ContentPackageVersion version,
            ContentPackageVersionResource link) {
        Integer sessionNo = resolved.session().getSessionNo();
        String syllabusId = resolved.myClass().getSyllabusId();
        if (sessionNo == null || syllabusId == null || syllabusId.isBlank()) {
            throw new ApiException(ErrorCode.E221, "Buổi học chưa gắn với giáo trình nên chưa thể làm bài");
        }
        if (link.getSessionNo() != sessionNo
                || !mappingService.isQuizAssignedToSyllabus(syllabusId, version.getId())) {
            throw new ApiException(ErrorCode.E221, "Bài tập này không thuộc buổi học của bạn");
        }
        return sessionNo;
    }

    private AssessmentAttempt createAttempt(String userId, StartAssessmentAttemptRequest req, int sessionNo, ContentPackageVersion version,
            ContentPackageVersionResource link, QuizContent quizContent) {
        Instant now = Instant.now();
        String learningResourceVersionId = link.getLearningResourceVersionId();

        // Bài trong lớp luôn dùng chế độ mặc định.
        Instant endsAt = null;
        Integer limit = quizContent != null ? quizContent.limitSeconds("default") : null;
        if (limit != null && limit > 0) {
            endsAt = now.plusSeconds(limit);
        }

        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .userId(userId)
                .subType(subTypeOf(req.learningResourceId()))
                .contextType(AssessmentContextType.CLASS_SESSION)
                .contextKey(req.sessionId())
                .contentPackageId(version.getPackageId())
                .contentPackageVersionId(version.getId())
                .learningResourceId(req.learningResourceId())
                .learningResourceVersionId(learningResourceVersionId)
                .sessionId(req.sessionId())
                .sessionNo(sessionNo)
                .status(AssessmentAttemptStatus.IN_PROGRESS)
                .gradingStatus(AssessmentGradingStatus.NOT_SUBMITTED)
                .endsAt(endsAt)
                .build();
        attempt = attemptRepository.save(attempt);
        createAnswerRows(attempt.getId(), quizContent);
        return attempt;
    }

    // Pre-tạo assessment_answers rỗng cho mỗi câu hỏi để cố định tập câu hỏi khi bắt đầu.
    private void createAnswerRows(String attemptId, QuizContent quizContent) {
        if (quizContent == null || quizContent.getQuestions() == null) return;
        for (QuizQuestion q : quizContent.getQuestions()) {
            answerRepository.save(AssessmentAnswer.builder()
                    .attemptId(attemptId)
                    .questionId(q.getQuestionId())
                    .gradingStatus(AssessmentAnswerGradingStatus.UNGRADED)
                    .build());
        }
    }

    // ── Tự luyện (không gắn lớp/buổi) ─────────────────────────────────────────────

    // Tạo hoặc trả lại lượt tự luyện đang làm dở. Idempotent theo (user, bài, mode[:variant]) khi IN_PROGRESS.
    // Chỉ làm được bài đã publish của Kho, hoặc Test đầu vào (độc lập với Kho). Khoá làm bài (lock/heartbeat), nộp và chấm dùng chung với bài trong lớp.
    public AssessmentAttemptResponse startOrResumeSelfStudy(StartSelfStudyAttemptRequest req) {
        String userId = currentUserId();
        // Client có thể gửi resourceId hoặc mã đề (testKey) của đề đã publish.
        String resourceId = practiceCatalog.resolveResourceId(req.learningResourceId()).orElse(req.learningResourceId());
        LearningResource resource = resourceRepository.findByIdForStart(resourceId)
                .filter(r -> r.getType() == LearningResourceType.ASSESSMENT && r.getPublishedVersionId() != null
                        && (r.isInLibrary() || ResourceSubTypes.isPlacement(r.getSubType())))
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "Bài chưa được phát hành hoặc không thuộc Kho"));
        String contextKey = selfStudyContextKey(req.mode(), req.variant());

        AssessmentAttempt attempt = attemptRepository
                .findByUserIdAndLearningResourceIdAndContextKeyAndStatusAndDeletedFalse(
                        userId, resource.getId(), contextKey, AssessmentAttemptStatus.IN_PROGRESS)
                .orElseGet(() -> createSelfStudyAttempt(userId, resource, req, contextKey));
        return buildResponse(attempt);
    }

    static String selfStudyContextKey(String mode, String variant) {
        return "SELF:" + mode + (variant == null || variant.isBlank() ? "" : ":" + variant);
    }

    private AssessmentAttempt createSelfStudyAttempt(String userId, LearningResource resource,
            StartSelfStudyAttemptRequest req, String contextKey) {
        String versionId = resource.getPublishedVersionId();
        QuizContent quizContent = questionResolver.getQuizContent(versionId);
        // Chế độ do học viên chọn (default|hard|easy) chỉ khác thời lượng; null = không giới hạn.
        Instant endsAt = null;
        Integer limit = quizContent != null ? quizContent.limitSeconds(req.mode()) : null;
        if (limit != null && limit > 0) {
            endsAt = Instant.now().plusSeconds(limit);
        }

        AssessmentAttempt attempt = attemptRepository.save(AssessmentAttempt.builder()
                .userId(userId)
                .subType(resource.getSubType() != null ? resource.getSubType() : ResourceSubTypes.QUIZ)
                .contextType(AssessmentContextType.SELF_STUDY)
                .contextKey(contextKey)
                .mode(req.mode())
                .settings(req.settings())
                .learningResourceId(resource.getId())
                .learningResourceVersionId(versionId)
                .status(AssessmentAttemptStatus.IN_PROGRESS)
                .gradingStatus(AssessmentGradingStatus.NOT_SUBMITTED)
                .endsAt(endsAt)
                .build());
        createAnswerRows(attempt.getId(), quizContent);
        return attempt;
    }

    // Lưu nháp lượt tự luyện trong một giao dịch: đáp án + trạng thái giao diện, theo khoá lạc quan revision (một tài liệu, một revision).
    // Bài trong lớp không dùng đường này mà lưu đáp án qua heartbeat có khoá làm bài.
    public AssessmentAttemptResponse saveDraft(String attemptId, SaveAttemptDraftRequest req) {
        String userId = currentUserId();
        AssessmentAttempt attempt = attemptRepository.findByIdForUpdate(attemptId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "AssessmentAttempt không tồn tại"));
        if (!userId.equals(attempt.getUserId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Bạn không có quyền truy cập bài làm này");
        }
        if (attempt.getContextType() != AssessmentContextType.SELF_STUDY) {
            throw new ApiException(ErrorCode.E220, "Bài trong lớp lưu đáp án qua heartbeat");
        }
        AssessmentAttemptStatus eff = effectiveStatus(attempt);
        if (eff != AssessmentAttemptStatus.IN_PROGRESS) {
            throw new ApiException(ErrorCode.E220, "Attempt không còn đang làm (status: " + eff + ")");
        }
        if (attempt.getEndsAt() != null && !Instant.now().isBefore(attempt.getEndsAt())) {
            throw new ApiException(ErrorCode.E220, "Đã hết thời gian làm bài. Vui lòng nộp bài.");
        }
        requireRevision(attempt, req.revision());
        applyDraft(attempt, req.answers(), req.clientState());
        attempt.setRevision(attempt.getRevision() + 1);
        attemptRepository.save(attempt);
        return buildResponse(attempt);
    }

    // Ghi chú/highlight của bài tự luyện đã nộp (xem lại kết quả): chỉ cập nhật phần annotations, giữ nguyên phần còn lại của clientState.
    public void saveAnnotations(String attemptId, SaveAnnotationsRequest req) {
        String userId = currentUserId();
        AssessmentAttempt attempt = getAttemptForUser(attemptId, userId);
        if (attempt.getContextType() != AssessmentContextType.SELF_STUDY) {
            throw new ApiException(ErrorCode.E220, "Chỉ bài tự luyện có ghi chú khi xem lại");
        }
        if (effectiveStatus(attempt) == AssessmentAttemptStatus.IN_PROGRESS) {
            throw new ApiException(ErrorCode.E220, "Bài đang làm lưu ghi chú cùng bản nháp");
        }
        com.fasterxml.jackson.databind.node.ObjectNode next = attempt.getClientState() != null && attempt.getClientState().isObject()
                ? ((com.fasterxml.jackson.databind.node.ObjectNode) attempt.getClientState()).deepCopy()
                : com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
        next.set("annotations", req.annotations());
        if (next.toString().length() > MAX_CLIENT_STATE_LENGTH) {
            throw new ApiException(ErrorCode.E200, "Trạng thái giao diện quá lớn");
        }
        attempt.setClientState(next);
        attemptRepository.save(attempt);
    }

    private void requireRevision(AssessmentAttempt attempt, Long revision) {
        if (revision == null || revision != attempt.getRevision()) {
            throw new ApiException(ErrorCode.E220, "Bài làm đã thay đổi ở phiên khác. Vui lòng tải lại trang để tiếp tục.");
        }
    }

    // answers == null: giữ nguyên đáp án; ngược lại thay toàn bộ (câu vắng mặt bị xoá đáp án). clientState == null: giữ nguyên.
    private void applyDraft(AssessmentAttempt attempt, Map<String, String> answers, JsonNode clientState) {
        if (clientState != null) {
            if (clientState.toString().length() > MAX_CLIENT_STATE_LENGTH) {
                throw new ApiException(ErrorCode.E200, "Trạng thái giao diện quá lớn");
            }
            attempt.setClientState(clientState);
        }
        if (answers == null) return;

        List<AssessmentAnswer> rows = answerRepository.findByAttemptIdAndDeletedFalse(attempt.getId());
        Set<String> known = rows.stream().map(AssessmentAnswer::getQuestionId).collect(Collectors.toSet());
        int maxLength = DEFAULT_MAX_ANSWER_LENGTH;
        for (Map.Entry<String, String> e : answers.entrySet()) {
            if (!known.contains(e.getKey())) {
                throw new ApiException(ErrorCode.E204, "Đáp án không thuộc bài này");
            }
            if (e.getValue() != null && e.getValue().length() > maxLength) {
                throw new ApiException(ErrorCode.E204, "Đáp án quá dài hoặc không hợp lệ");
            }
        }
        // Lưu nháp cũng qua bộ làm sạch như lúc nộp (giá trị null nghĩa là xoá đáp án, giữ nguyên).
        QuizContent quiz = questionResolver.getQuizContent(attempt.getLearningResourceVersionId());
        Map<String, String> cleaned = new java.util.HashMap<>(answers);
        answerSanitizer.sanitize(quiz, answers.entrySet().stream().filter(e -> e.getValue() != null)
                .map(e -> new HeartbeatAssessmentAttemptRequest.AnswerItem(e.getKey(), e.getValue())).toList())
                .forEach(item -> cleaned.put(item.questionId(), item.answerJson()));
        for (AssessmentAnswer row : rows) {
            String next = cleaned.get(row.getQuestionId());
            if (!java.util.Objects.equals(next, row.getAnswerJson())) {
                row.setAnswerJson(next);
                answerRepository.save(row);
            }
        }
    }
    // ── Phase 02: lock ────────────────────────────────────────────────────────────

    // Chiếm khóa Redis cho phiên làm bài — ngăn 2 tab/thiết bị ghi đáp án đồng thời.
    // force=true cho phép tab hiện tại giành lại khóa từ tab cũ đã mất kết nối.
    public AssessmentLockResponse acquireLock(String attemptId, AcquireAssessmentLockRequest req) {
        String userId = currentUserId();
        AssessmentAttempt attempt = getAttemptForUser(attemptId, userId);
        AssessmentAttemptStatus eff = effectiveStatus(attempt);

        if (eff != AssessmentAttemptStatus.IN_PROGRESS) {
            throw new ApiException(ErrorCode.E220, "Attempt không còn đang làm (status: " + eff + ")");
        }

        RedisSessionLockService.LockResult result = redisLockService.acquireOrRenew(
                LOCK_PREFIX, attemptId, userId, req.sessionToken(), LOCK_TTL_SECONDS, req.force());

        Instant now = Instant.now();
        return new AssessmentLockResponse(result.acquired(), result.holderUserId(),
                result.expiresAt(), now, attempt.getEndsAt());
    }

    // Nhả khóa khi tab đóng (beforeunload / visibility hidden + pagehide).
    // Idempotent: không lỗi nếu khóa đã mất.
    public AssessmentLockResponse releaseLock(String attemptId, String sessionToken) {
        String userId = currentUserId();
        AssessmentAttempt attempt = getAttemptForUser(attemptId, userId);
        redisLockService.release(LOCK_PREFIX, attemptId, sessionToken);

        Instant now = Instant.now();
        return new AssessmentLockResponse(true, userId, null, now, attempt.getEndsAt());
    }

    // ── Phase 03: heartbeat, submit, getAttempt ──────────────────────────────────

    public HeartbeatAssessmentAttemptResponse heartbeat(
            String attemptId, HeartbeatAssessmentAttemptRequest req) {
        String userId = currentUserId();
        // Khoá dòng attempt như submit: heartbeat đang bay không được ghi đè các dòng đáp án đã được chấm sau khi nộp (mất điểm câu vừa đổi).
        AssessmentAttempt attempt = attemptRepository.findByIdForUpdate(attemptId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "AssessmentAttempt không tồn tại"));
        if (!userId.equals(attempt.getUserId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Bạn không có quyền truy cập bài làm này");
        }
        AssessmentAttemptStatus eff = effectiveStatus(attempt);

        // Gia hạn khóa kể cả khi TIME_OUT để FE vẫn nhận được thông báo hết giờ.
        RedisSessionLockService.LockResult lockResult = redisLockService.acquireOrRenew(
                LOCK_PREFIX, attemptId, userId, req.sessionToken(), LOCK_TTL_SECONDS, false);

        List<String> savedIds = new ArrayList<>();
        if (lockResult.acquired() && eff == AssessmentAttemptStatus.IN_PROGRESS
                && req.answers() != null && !req.answers().isEmpty()) {
            // Cùng bộ làm sạch với lúc nộp: câu nhiều ý chỉ giữ các ý có thật, câu nộp tệp/ghi âm chỉ giữ phần đúng cấu trúc.
            QuizContent quiz = questionResolver.getQuizContent(attempt.getLearningResourceVersionId());
            savedIds = saveAnswers(attemptId, answerSanitizer.sanitize(quiz, req.answers()));
        }

        Instant now = Instant.now();
        Long remaining = computeRemaining(attempt, now);

        return new HeartbeatAssessmentAttemptResponse(
                lockResult.acquired(), lockResult.expiresAt(), now,
                attempt.getEndsAt(), remaining, eff, savedIds);
    }

    public SubmitAssessmentAttemptResponse submit(
            String attemptId, SubmitAssessmentAttemptRequest req) {
        String userId = currentUserId();
        // Khoá dòng attempt: submit và job đóng bài không thể cùng đổi status.
        AssessmentAttempt attempt = attemptRepository.findByIdForUpdate(attemptId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "AssessmentAttempt không tồn tại"));
        if (!userId.equals(attempt.getUserId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Bạn không có quyền truy cập bài làm này");
        }
        boolean selfStudy = attempt.getContextType() == AssessmentContextType.SELF_STUDY;
        if (!selfStudy && (req.sessionToken() == null || req.sessionToken().isBlank())) {
            throw new ApiException(ErrorCode.E200, "Thiếu sessionToken");
        }

        if (attempt.getStatus() == AssessmentAttemptStatus.SUBMITTED) {
            throw new ApiException(ErrorCode.E220, "ĐÃ_NỘP");
        }
        if (attempt.getStatus() == AssessmentAttemptStatus.TIME_OUT) {
            throw new ApiException(ErrorCode.E220, "ĐÃ_HẾT_GIỜ");
        }

        Instant now = Instant.now();
        boolean gracePeriodOver = attempt.getEndsAt() != null
                && now.isAfter(attempt.getEndsAt().plus(AssessmentAttempt.SUBMIT_GRACE));

        boolean answersIgnored = gracePeriodOver;
        if (selfStudy && !gracePeriodOver && req.revision() != null) {
            requireRevision(attempt, req.revision());
        }
        if (!answersIgnored && req.answers() != null && !req.answers().isEmpty()) {
            List<HeartbeatAssessmentAttemptRequest.AnswerItem> items = req.answers().stream()
                    .map(a -> new HeartbeatAssessmentAttemptRequest.AnswerItem(a.questionId(), a.answerJson()))
                    .toList();
            // Câu nộp file / ghi âm / nhiều ý: chỉ giữ phần đúng cấu trúc và đúng giới hạn của câu hỏi.
            QuizContent quiz = questionResolver.getQuizContent(attempt.getLearningResourceVersionId());
            saveAnswers(attemptId, answerSanitizer.sanitize(quiz, items));
        }
        if (selfStudy && !answersIgnored && req.clientState() != null) {
            if (req.clientState().toString().length() > MAX_CLIENT_STATE_LENGTH) {
                throw new ApiException(ErrorCode.E200, "Trạng thái giao diện quá lớn");
            }
            attempt.setClientState(req.clientState());
        }

        attempt.setStatus(AssessmentAttemptStatus.SUBMITTED);
        attempt.setSubmittedAt(now);
        attempt.setGradingStatus(AssessmentGradingStatus.PENDING);
        attemptRepository.save(attempt);

        if (req.sessionToken() != null && !req.sessionToken().isBlank()) {
            redisLockService.release(LOCK_PREFIX, attemptId, req.sessionToken());
        }
        // Đề chỉ có câu chấm máy được chấm ngay trong lời gọi nộp để học sinh có kết quả liền; còn lại chấm bất đồng bộ qua sự kiện.
        if (allAutoGradable(questionResolver.getQuizContent(attempt.getLearningResourceVersionId()))) {
            gradingService.gradeAttempt(attemptId);
        } else {
            gradingEventPublisher.publishAttemptGrade(attemptId);
        }

        return new SubmitAssessmentAttemptResponse(attemptId, answersIgnored, now);
    }

    @Transactional(readOnly = true)
    public AssessmentAttemptResponse getAttempt(String attemptId) {
        String userId = currentUserId();
        AssessmentAttempt attempt = getAttemptForUser(attemptId, userId);
        return buildResponse(attempt);
    }

    // ── Shared helpers ────────────────────────────────────────────────────────────

    private String subTypeOf(String learningResourceId) {
        return resourceRepository.findByIdAndDeletedFalse(learningResourceId)
                .map(LearningResource::getSubType).orElse(ResourceSubTypes.QUIZ);
    }

    // Mọi câu chấm máy được (không cần AI/giáo viên): chấm đồng bộ khi nộp.
    private boolean allAutoGradable(QuizContent quiz) {
        if (quiz == null || quiz.getQuestions() == null || quiz.getQuestions().isEmpty()) return false;
        for (QuizQuestion q : quiz.getQuestions()) {
            if (!questionAutoGrader.canAutoGrade(QuestionContent.from(q))) return false;
        }
        return true;
    }

    private AssessmentAttemptResponse buildResponse(AssessmentAttempt attempt) {
        QuizContent quizContent = questionResolver.getQuizContent(attempt.getLearningResourceVersionId());

        List<AssessmentAttemptResponse.QuizQuestionItem> questionItems = new ArrayList<>();
        if (quizContent != null && quizContent.getQuestions() != null) {
            int order = 1;
            for (QuizQuestion q : quizContent.getQuestions()) {
                QuestionPublicContent pub = QuestionPublicContent.from(q);
                questionItems.add(new AssessmentAttemptResponse.QuizQuestionItem(q.getQuestionId(), order++, pub));
            }
        }

        List<AssessmentAttemptResponse.SavedAnswerItem> savedAnswers =
                answerRepository.findByAttemptIdAndDeletedFalse(attempt.getId()).stream()
                        .filter(a -> a.getAnswerJson() != null)
                        .map(a -> new AssessmentAttemptResponse.SavedAnswerItem(
                                a.getId(), a.getQuestionId(), a.getAnswerJson()))
                        .toList();

        // Bố cục hiển thị (JSON mờ do frontend định nghĩa) đã lọc khoá grading và (khi chưa nộp) explanation.
        JsonNode layout = quizContent == null ? null
                : LayoutFilter.forStudent(quizContent.getLayout(), effectiveStatus(attempt) != AssessmentAttemptStatus.IN_PROGRESS);

        return AssessmentAttemptResponse.from(attempt, quizContent, questionItems, savedAnswers, layout, Instant.now());
    }

    // Lưu/ghi đè answerJson cho từng câu. Pre-created AssessmentAnswer rows đã có sẵn từ createAttempt.
    private List<String> saveAnswers(String attemptId,
            List<HeartbeatAssessmentAttemptRequest.AnswerItem> items) {
        List<AssessmentAnswer> existing = answerRepository.findByAttemptIdAndDeletedFalse(attemptId);
        Map<String, AssessmentAnswer> byQuestionId = existing.stream()
                .collect(Collectors.toMap(AssessmentAnswer::getQuestionId, a -> a));

        List<String> savedIds = new ArrayList<>();
        for (HeartbeatAssessmentAttemptRequest.AnswerItem item : items) {
            AssessmentAnswer row = byQuestionId.get(item.questionId());
            if (row == null) continue;
            row.setAnswerJson(item.answerJson());
            answerRepository.save(row);
            savedIds.add(row.getId());
        }
        return savedIds;
    }

    // Trạng thái hiệu lực: IN_PROGRESS nhưng đã qua ends_at + SUBMIT_GRACE = TIME_OUT
    private AssessmentAttemptStatus effectiveStatus(AssessmentAttempt attempt) {
        return attempt.effectiveStatus(Instant.now());
    }

    private Long computeRemaining(AssessmentAttempt attempt, Instant now) {
        if (attempt.getEndsAt() == null) return null;
        long secs = attempt.getEndsAt().getEpochSecond() - now.getEpochSecond();
        return Math.max(0, secs);
    }

    private AssessmentAttempt getAttemptForUser(String attemptId, String userId) {
        AssessmentAttempt attempt = attemptRepository.findByIdAndDeletedFalse(attemptId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "AssessmentAttempt không tồn tại"));
        if (!userId.equals(attempt.getUserId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Bạn không có quyền truy cập bài làm này");
        }
        return attempt;
    }

    // Tìm lớp + buổi của học sinh. getMyClasses và getMyClassSessions đều đã được cache nên không tốn thêm lời gọi sang ERP.
    // Có classId thì chỉ tra trong lớp đó (lớp phải thuộc học sinh), không có thì quét các lớp của học sinh.
    private ResolvedSession resolveSession(String sessionId, String classId) {
        for (CmsMyClass cls : cmsClient.getMyClasses(null)) {
            if (classId != null && !classId.isBlank() && !classId.equals(cls.getId())) continue;
            for (CmsMySessionShared s : cmsClient.getMyClassSessions(cls.getId())) {
                if (sessionId.equals(s.getId())) return new ResolvedSession(cls, s);
            }
        }
        throw new ApiException(ErrorCode.FORBIDDEN, "Bạn không tham gia lớp có buổi học này");
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Yêu cầu đăng nhập");
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof AuthPrincipal authPrincipal) {
            return authPrincipal.userId();
        }
        throw new ApiException(ErrorCode.UNAUTHORIZED, "Không xác định được người dùng");
    }
}
