package pl.co.lms.service.placement;

import base.co.common.exception.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.request.*;
import pl.co.lms.dto.response.*;
import pl.co.lms.entity.*;
import pl.co.lms.repository.*;
import pl.co.lms.service.*;
import pl.co.lms.client.IdentityClient;
import java.time.Instant;
import java.util.Map;

/** Placement membership and submission receipts; answers/deadlines/grading stay in the common engine. */
@Service @RequiredArgsConstructor @Transactional
public class PlacementAttemptService {
    private final PlacementTestService tests;
    private final PlacementAttemptRepository links;
    private final AssessmentAttemptRepository attempts;
    private final AssessmentAttemptService engine;
    private final AssessmentAttemptResultService results;
    private final ObjectMapper mapper;
    private final IdentityClient identity;

    public AssessmentAttemptResponse start(String id) {
        String user = PlacementAccess.user();
        // Serialize creation of the placement membership as well as the underlying attempt.
        tests.require(id, true);
        LearningResource test = tests.available(id);
        ObjectNode settings = mapper.createObjectNode().put("origin", "PLACEMENT");
        AssessmentAttemptResponse response = engine.startOrResumeSelfStudy(new StartSelfStudyAttemptRequest(
                test.getId(), "default", "placement", settings));
        AssessmentAttempt attempt = assessment(response.attemptId());
        // Placement currently offers mentor feedback only, including timeout auto-submissions.
        attempt.setGradingMethod("MANUAL");
        if (links.findByAssessmentAttemptIdAndDeletedFalse(attempt.getId()).isEmpty()) {
            PlacementAttempt link = new PlacementAttempt(); link.setUserId(user); link.setResourceId(test.getId());
            link.setAssessmentAttemptId(attempt.getId()); links.saveAndFlush(link);
        }
        return response;
    }
    @Transactional(readOnly=true)
    public AssessmentAttemptResponse get(String id) { own(id, false); return engine.getAttempt(id); }
    public AssessmentAttemptResponse save(String id, SaveAttemptDraftRequest request) { own(id, false); return engine.saveDraft(id, request); }
    @Transactional(readOnly=true)
    public AssessmentAttemptResultResponse result(String id) { own(id, false); return results.getResult(id, null).body(); }

    @Transactional(readOnly=true)
    public ObjectNode resultView(String id) {
        AssessmentAttemptResultResponse result = result(id);
        ObjectNode out = mapper.valueToTree(result);
        var profile = tests.foundation(tests.content(assessment(id).getLearningResourceVersionId()));
        out.set("foundation", profile);
        out.putNull("foundationEvaluation");
        // Only a complete server grade can be mapped, using the scale authored with this exact version.
        if (result.gradingStatus() == AssessmentGradingStatus.GRADED && result.percent() != null && profile.isObject()) {
            com.fasterxml.jackson.databind.JsonNode selected = null;
            for (var band : profile.path("bands")) {
                if (result.percent().compareTo(band.path("minPercent").decimalValue()) >= 0
                        && (selected == null || band.path("minPercent").asInt() > selected.path("minPercent").asInt())) selected = band;
            }
            if (selected != null) out.set("foundationEvaluation", selected);
        }
        return out;
    }

    @Transactional(readOnly=true)
    public ObjectNode feedbackOptions(String id) {
        PlacementAttempt link = own(id, false);
        ObjectNode out = mapper.createObjectNode();
        out.putObject("ai").put("available", false).put("reason", "AI chấm chữa chưa được bật cho Test đầu vào").putNull("quota");
        out.putObject("mentor").put("available", link.getSubmittedAt() == null).put("reason", link.getSubmittedAt() == null ? null : "Bài đã được gửi Mentor").putNull("quota");
        return out;
    }

    public ObjectNode submit(String id, PlacementRequests.Submit request) {
        PlacementAttempt link = own(id, true);
        if (request.feedbackMethod() != PlacementRequests.FeedbackMethod.MENTOR)
            throw new ApiException(ErrorCode.E235, "Test đầu vào hiện chỉ hỗ trợ Mentor chấm chữa; AI chưa được bật");
        AssessmentAttempt attempt = attempts.findByIdForUpdate(id).orElseThrow(PlacementAccess::missing);
        if (link.getSubmittedAt() != null) return receipt(link, attempt); // safe retry after a lost response
        attempt.setGradingMethod("MANUAL");
        if (attempt.getStatus() == AssessmentAttemptStatus.IN_PROGRESS) {
            engine.submit(id, new SubmitAssessmentAttemptRequest(null, request.answers(), request.revision(), request.clientState()));
        }
        // The close job may already have submitted a timed-out attempt. Never reopen it or accept late answers.
        link.setFeedbackMethod("MENTOR");
        link.setSubmittedAt(attempt.getSubmittedAt() != null ? attempt.getSubmittedAt() : Instant.now());
        links.saveAndFlush(link);
        return receipt(link, attempt);
    }
    @Transactional(readOnly=true)
    public ObjectNode receipt(String id) {
        PlacementAttempt link = own(id, false);
        if (link.getSubmittedAt() == null) throw new ApiException(ErrorCode.E220, "Bài chưa được gửi Mentor");
        return receipt(link, assessment(id));
    }
    @Transactional(readOnly=true)
    public ObjectNode history(int page, int size) {
        return page(links.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(PlacementAccess.user(), paging(page, size)), false);
    }
    /** Submitted attempts, newest first; `student` (name, email, code...) is resolved to user ids at Auth and filters on the server. */
    @Transactional(readOnly=true)
    public ObjectNode mentorQueue(int page, int size, String student) {
        PlacementAccess.admin();
        IdentityClient.UserSearchResult found = PlacementUsers.hasText(student) ? identity.searchUserIds(student.trim()) : null;
        Page<PlacementAttempt> data = found == null ? links.findBySubmittedAtIsNotNullAndDeletedFalseOrderBySubmittedAtDesc(paging(page, size))
                : found.userIds().isEmpty() ? Page.empty(paging(page, size))
                : links.findBySubmittedAtIsNotNullAndDeletedFalseAndUserIdInOrderBySubmittedAtDesc(found.userIds(), paging(page, size));
        ObjectNode out = page(data, true);
        if (found != null) out.put("studentSearchTruncated", found.truncated());
        return out;
    }
    private ObjectNode page(Page<PlacementAttempt> page, boolean admin) {
        ObjectNode out = mapper.createObjectNode().put("totalElements", page.getTotalElements()).put("totalPages", page.getTotalPages());
        var items = out.putArray("items");
        Map<String, IdentityClient.UserSummary> users = admin && page.hasContent() ? identity.lookupByIds(page.stream().map(PlacementAttempt::getUserId).toList()) : Map.of();
        page.forEach(link -> {
            ObjectNode item = receipt(link, assessment(link.getAssessmentAttemptId()));
            if (admin) { item.put("userId", link.getUserId()); PlacementUsers.put(item, users, link.getUserId()); }
            items.add(item);
        });
        return out;
    }
    private ObjectNode receipt(PlacementAttempt link, AssessmentAttempt attempt) {
        var quiz = tests.content(attempt.getLearningResourceVersionId());
        return mapper.createObjectNode().put("attemptId", attempt.getId()).put("title", quiz.getTitle())
                .put("placementId", attempt.getLearningResourceId())
                .put("feedbackMethod", link.getFeedbackMethod()).put("submittedAt", link.getSubmittedAt() == null ? null : link.getSubmittedAt().toString())
                .put("startedAt", attempt.getCreatedAt().toString()).put("attemptStatus", attempt.effectiveStatus(Instant.now()).name())
                .put("gradingStatus", attempt.getGradingStatus().name()).put("earnedPoints", attempt.getEarnedPoints())
                .put("totalPoints", attempt.getTotalPoints()).put("serverNow", Instant.now().toString())
                .set("foundation", tests.foundation(quiz));
    }
    private AssessmentAttempt assessment(String id) { return attempts.findByIdAndDeletedFalse(id).orElseThrow(PlacementAccess::missing); }
    private PlacementAttempt own(String id, boolean lock) {
        String user = PlacementAccess.user();
        return (lock ? links.lockByAssessmentAttemptId(id) : links.findByAssessmentAttemptIdAndDeletedFalse(id))
                .filter(link -> user.equals(link.getUserId())).orElseThrow(PlacementAccess::missing);
    }
    static Pageable paging(int page, int size) { return PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size))); }
}
