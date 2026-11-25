package pl.co.lms.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import base.co.common.event.EventPublisher;
import base.co.common.notification.NotificationPublisher;
import pl.co.lms.client.CmsClient;
import pl.co.lms.dto.request.CreateLearningResourceRequest;
import pl.co.lms.dto.request.HeartbeatAssessmentAttemptRequest.AnswerItem;
import pl.co.lms.dto.request.SaveAssessmentManualGradingRequest;
import pl.co.lms.dto.request.SaveAttemptDraftRequest;
import pl.co.lms.dto.request.StartSelfStudyAttemptRequest;
import pl.co.lms.dto.request.SubmitAssessmentAttemptRequest;
import pl.co.lms.dto.response.AssessmentAttemptResponse;
import pl.co.lms.dto.response.AssessmentAttemptResultResponse;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.entity.json.QuestionPublicContent;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;
import pl.co.lms.repository.AssessmentAttemptRepository;
import base.co.common.filter.principal.AuthPrincipal;
import pl.co.lms.service.AssessmentAttemptQuestionResolver;
import pl.co.lms.service.AssessmentAttemptResultService;
import pl.co.lms.service.AssessmentAttemptService;
import pl.co.lms.service.AssessmentManualGradingService;
import pl.co.lms.service.SyllabusPackageService;
import pl.co.lms.service.LearningResourceService;
import pl.co.lms.service.RedisSessionLockService;
import pl.co.lms.service.practice.PracticeCatalogService;
import pl.co.lms.service.QuizAnswerSanitizer;
import pl.co.lms.service.grading.AssessmentGradingEventPublisher;
import pl.co.lms.service.grading.AssessmentGradingNotifier;
import pl.co.lms.service.grading.AssessmentGradingService;
import pl.co.lms.service.grading.QuestionAutoGrader;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Luồng thật trên H2 với các file seed: tạo bài vào Kho, bắt đầu theo chế độ thời gian, lưu nháp, nộp, chấm, kết quả (điểm thô), danh mục
 * và việc lọc khoá {@code explanation}/{@code grading} của layout.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:unified;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa", "spring.datasource.password=", "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.flyway.enabled=false"})
@Import({JacksonAutoConfiguration.class, AssessmentAttemptService.class, AssessmentAttemptQuestionResolver.class,
        AssessmentAttemptResultService.class, AssessmentManualGradingService.class, AssessmentGradingService.class,
        AssessmentGradingEventPublisher.class, AssessmentGradingNotifier.class, QuestionAutoGrader.class, QuizAnswerSanitizer.class,
        PracticeCatalogService.class, LearningResourceService.class})
class AssessmentUnifiedFlowTest {

    @MockBean RedisSessionLockService redisLockService;
    @MockBean CmsClient cmsClient;
    @MockBean pl.co.lms.client.IdentityClient identityClient;
    @MockBean SyllabusPackageService mappingService;
    @MockBean EventPublisher eventPublisher;
    @MockBean NotificationPublisher notificationPublisher;

    @Autowired ObjectMapper mapper;
    @Autowired LearningResourceService resources;
    @Autowired AssessmentAttemptService attempts;
    @Autowired AssessmentAttemptResultService results;
    @Autowired AssessmentManualGradingService grading;
    @Autowired PracticeCatalogService catalog;
    @Autowired AssessmentAttemptRepository attemptRepository;
    @Autowired AssessmentGradingService gradingService;
    @Autowired pl.co.lms.repository.LearningResourceRepository resourceRepository;

    @BeforeEach
    void signIn() {
        var principal = new AuthPrincipal("student-1", false, Set.of());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    private JsonNode seed(String name) throws Exception {
        return mapper.readTree(new ClassPathResource("seed/assessments/" + name + ".json").getInputStream());
    }

    private String publish(String name) throws Exception {
        JsonNode seed = seed(name);
        QuizContent content = mapper.treeToValue(seed.get("content"), QuizContent.class);
        List<String> tags = new ArrayList<>();
        seed.get("tags").forEach(t -> tags.add(t.asText()));
        return resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.ASSESSMENT, content, true, true, null, seed.get("subType").asText(), tags)).getId();
    }

    private static boolean hasKey(JsonNode node, String key) {
        if (node == null) return false;
        if (node.isObject()) {
            if (node.has(key)) return true;
            for (JsonNode child : node) if (hasKey(child, key)) return true;
        } else if (node.isArray()) {
            for (JsonNode child : node) if (hasKey(child, key)) return true;
        }
        return false;
    }

    // Đáp án đúng của một câu theo nội dung đầy đủ (admin): chọn một, nối nhiều dòng hoặc điền nhiều chỗ trống.
    private String correctAnswerJson(JsonNode question) {
        ObjectNode answer = mapper.createObjectNode();
        if (question.has("matchingPairs")) {
            ObjectNode map = answer.putObject("matchingAnswers");
            for (JsonNode pair : question.get("matchingPairs")) map.put(pair.get("pairIndex").asText(), pair.get("answerOptionIndex").asInt());
            return answer.toString();
        }
        if (question.has("blanks")) {
            ObjectNode map = answer.putObject("blankAnswers");
            for (JsonNode blank : question.get("blanks")) map.put(blank.get("blankIndex").asText(), blank.get("correctAnswer").asText());
            return answer.toString();
        }
        for (JsonNode o : question.get("options")) if (o.path("correct").asBoolean()) return "{\"selectedOptionIndex\":" + o.get("optionIndex").asInt() + "}";
        throw new IllegalStateException("câu mẫu không có đáp án: " + question.get("questionId"));
    }

    private static BigDecimal totalPoints(JsonNode questions) {
        BigDecimal total = BigDecimal.ZERO;
        for (JsonNode q : questions) total = total.add(q.get("points").decimalValue());
        return total;
    }

    // Mọi đề mẫu phải lưu được qua LearningResourceService (kiểm tra nội dung chạy ở đó), không dựa vào log của bộ nạp seed.
    @Test
    void everySeedIsAcceptedByTheResourceService() throws Exception {
        var files = new org.springframework.core.io.support.PathMatchingResourcePatternResolver().getResources("classpath*:seed/assessments/*.json");
        assertThat(files).hasSizeGreaterThanOrEqualTo(19);
        for (var file : files) {
            String name = file.getFilename().replace(".json", "");
            assertThat(publish(name)).as(name).isNotBlank();
        }
    }

    @Test
    void reading_modeSetsDeadline_layoutIsFilteredUntilSubmit_andResultIsRawPoints() throws Exception {
        String id = publish("read-vitamins-01");
        JsonNode seed = seed("read-vitamins-01");
        JsonNode limits = seed.get("content").get("timeLimits");

        Instant before = Instant.now();
        AssessmentAttemptResponse hard = attempts.startOrResumeSelfStudy(new StartSelfStudyAttemptRequest(id, "hard", null, null));
        assertThat(hard.endsAt()).isBetween(before.plusSeconds(limits.get("hard").asInt() - 2), Instant.now().plusSeconds(limits.get("hard").asInt() + 2));
        assertThat(hard.mode()).isEqualTo("hard");
        assertThat(hard.subType()).isEqualTo(ResourceSubTypes.PRACTICE_READING);
        JsonNode layout = hard.layout();
        assertThat(hasKey(layout, "explanation")).as("no explanation while the attempt is open").isFalse();
        assertThat(hasKey(layout, "grading")).isFalse();
        assertThat(hasKey(layout, "content")).as("section text is public").isTrue();
        assertThat(mapper.writeValueAsString(hard.questions())).doesNotContain("\"correct\"").doesNotContain("correctAnswer");

        // Mỗi chế độ là một lượt riêng (khoá ngữ cảnh khác nhau).
        AssessmentAttemptResponse easy = attempts.startOrResumeSelfStudy(new StartSelfStudyAttemptRequest(id, "easy", null, null));
        assertThat(easy.attemptId()).isNotEqualTo(hard.attemptId());
        assertThat(easy.endsAt()).isAfter(hard.endsAt());

        // Nộp toàn bộ đáp án đúng ở lượt "hard".
        Map<String, String> answers = new java.util.LinkedHashMap<>();
        for (JsonNode q : seed.get("content").get("questions")) answers.put(q.get("questionId").asText(), correctAnswerJson(q));
        AssessmentAttemptResponse saved = attempts.saveDraft(hard.attemptId(), new SaveAttemptDraftRequest(hard.revision(), answers, mapper.createObjectNode().put("flagged", 1)));
        assertThat(saved.revision()).isEqualTo(hard.revision() + 1);
        attempts.submit(hard.attemptId(), new SubmitAssessmentAttemptRequest(null, List.of(), saved.revision(), null));

        AssessmentAttemptResultResponse result = results.getResult(hard.attemptId(), null).body();
        assertThat(result.gradingStatus()).isEqualTo(AssessmentGradingStatus.GRADED);
        assertThat(result.earnedPoints()).isEqualByComparingTo(totalPoints(seed.get("content").get("questions")));
        assertThat(result.totalPoints()).isEqualByComparingTo(result.earnedPoints());
        assertThat(result.percent()).isEqualByComparingTo(BigDecimal.valueOf(100));
        assertThat(result.subType()).isEqualTo(ResourceSubTypes.PRACTICE_READING);
        assertThat(result.learningResourceId()).isEqualTo(id);
        String released = mapper.writeValueAsString(result.questions());
        assertThat(released).as("explanation and answers are released after submit").contains("\"explanation\"").contains("\"answer\"");
        assertThat(result.questions().get(0).parts()).as("per-line results of a composite question").isNotEmpty().allMatch(part -> part.correct());
        assertThat(hasKey(result.layout(), "grading")).isFalse();

        // Danh mục: trạng thái hoàn thành, điểm thô, tag và mốc giờ.
        JsonNode item = catalog.catalog(ResourceSubTypes.PRACTICE_READING, "student-1").stream().filter(n -> n.get("id").asText().equals(id)).findFirst().orElseThrow();
        assertThat(item.get("status").asText()).isEqualTo("completed");
        assertThat(item.get("earnedPoints").decimalValue()).isEqualByComparingTo(result.earnedPoints());
        assertThat(item.get("tags").size()).isGreaterThan(0);
        assertThat(item.get("timeLimits").get("hard").asInt()).isEqualTo(limits.get("hard").asInt());
        assertThat(item.get("meta").get("label").asText()).isEqualTo("Passage 1");
        assertThat(item.get("sectionCount").asInt()).isEqualTo(1);
        assertThat(hasKey(item, "explanation")).isFalse();
        assertThat(catalog.catalog(ResourceSubTypes.PRACTICE_LISTENING, "student-1")).isEmpty();
    }

    @Test
    void writing_waitsForTeacher_graderSeesGradingKey_studentNever_andRubricIsStoredOpaquely() throws Exception {
        String id = publish("writing-boiler");
        JsonNode content = seed("writing-boiler").get("content");
        AssessmentAttemptResponse started = attempts.startOrResumeSelfStudy(new StartSelfStudyAttemptRequest(id, "default", null, null));
        assertThat(hasKey(started.layout(), "grading")).as("reference facts never reach students").isFalse();
        assertThat(mapper.writeValueAsString(started.layout())).doesNotContain("referenceText");
        assertThat(mapper.writeValueAsString(started.questions())).as("AI grading data never reaches students").doesNotContain("referenceText").doesNotContain("aiRubric");
        String questionId = content.get("questions").get(0).get("questionId").asText();

        attempts.submit(started.attemptId(), new SubmitAssessmentAttemptRequest(null,
                List.of(new AnswerItem(questionId, "{\"text\":\"The diagram shows how a boiler works.\"}")), started.revision(), null));
        // Bài có câu tự luận được chấm bất đồng bộ qua Kafka: chạy worker bằng tay, không có dịch vụ AI nên chuyển sang chấm tay.
        assertThat(results.getResult(started.attemptId(), null).body().gradingStatus()).isEqualTo(AssessmentGradingStatus.PENDING);
        gradingService.gradeAttempt(started.attemptId());
        AssessmentAttemptResultResponse pending = results.getResult(started.attemptId(), null).body();
        assertThat(pending.gradingStatus()).isEqualTo(AssessmentGradingStatus.MANUAL_GRADING);

        var detail = grading.detail(started.attemptId());
        assertThat(detail.layout()).as("graders see the layout").isNotNull();
        when(redisLockService.isHeldBy(any(), any(), any())).thenReturn(true);
        ObjectNode rubric = mapper.createObjectNode().put("bandScore", 6.5).put("feedback", "Clear overview");
        rubric.putArray("criteria").addObject().put("id", "task").put("bandScore", 7);
        grading.save(started.attemptId(), new SaveAssessmentManualGradingRequest("token", List.of(
                new SaveAssessmentManualGradingRequest.Item(detail.answers().get(0).answerId(), BigDecimal.valueOf(6.5), "Clear overview", rubric))));

        AssessmentAttemptResultResponse graded = results.getResult(started.attemptId(), null).body();
        assertThat(graded.gradingStatus()).isEqualTo(AssessmentGradingStatus.GRADED);
        assertThat(graded.earnedPoints()).isEqualByComparingTo("6.5");
        assertThat(graded.totalPoints()).isEqualByComparingTo("9");
        assertThat(graded.questions().get(0).rubricScores().get("criteria").get(0).get("bandScore").asInt()).isEqualTo(7);
        assertThat(hasKey(graded.layout(), "grading")).isFalse();
        verify(notificationPublisher, org.mockito.Mockito.never()).publish(any());
    }

    private static QuizQuestion.GradingCriterion criterion(String label, Double maxPoints) {
        return QuizQuestion.GradingCriterion.builder().label(label).maxPoints(maxPoints).build();
    }

    // Tạo bài từ seed writing với tiêu chí chấm đặt cho câu đầu (điểm câu = 9).
    private String publishWritingWithCriteria(List<QuizQuestion.GradingCriterion> criteria) throws Exception {
        JsonNode seed = seed("writing-boiler");
        QuizContent content = mapper.treeToValue(seed.get("content"), QuizContent.class);
        content.getQuestions().get(0).setGradingCriteria(criteria);
        return resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.ASSESSMENT, content, true, true, null, ResourceSubTypes.PRACTICE_WRITING, List.of())).getId();
    }

    @Test
    void gradingCriteria_areStoredAndValidated_graderSeesThem_studentNever() throws Exception {
        // Điểm tối đa là tuỳ chọn: tiêu chí "Trình bày" không đặt điểm vẫn hợp lệ.
        var criteria = List.of(criterion("Nội dung", 4.0), criterion("Ngữ pháp", 3.0), criterion("Từ vựng", 2.0), criterion("Trình bày", null));
        String id = publishWritingWithCriteria(criteria);

        // Lưu và đọc lại nguyên vẹn.
        QuizContent stored = (QuizContent) resources.getResourceResponse(id).content();
        assertThat(stored.getQuestions().get(0).getGradingCriteria()).extracting("label").containsExactly("Nội dung", "Ngữ pháp", "Từ vựng", "Trình bày");

        // Không hợp lệ: tổng vượt điểm câu, tên trống, điểm 0, quá 20 tiêu chí.
        var tooMany = new ArrayList<QuizQuestion.GradingCriterion>();
        for (int i = 0; i < 21; i++) tooMany.add(criterion("c" + i, 0.1));
        for (var invalid : List.of(
                List.of(criterion("A", 5.0), criterion("B", 5.0)),
                List.of(criterion(" ", 1.0)),
                List.of(criterion(null, 1.0)),
                List.of(criterion("A", 0.0)),
                tooMany)) {
            org.junit.jupiter.api.Assertions.assertThrows(base.co.common.exception.ApiException.class, () -> publishWritingWithCriteria(invalid));
        }

        // Học viên không nhận tiêu chí ở bất kỳ dạng nào của câu hỏi.
        QuizQuestion question = stored.getQuestions().get(0);
        assertThat(mapper.writeValueAsString(QuestionContent.from(question))).doesNotContain("gradingCriteria");
        assertThat(mapper.writeValueAsString(QuestionPublicContent.from(question))).doesNotContain("gradingCriteria");

        AssessmentAttemptResponse started = attempts.startOrResumeSelfStudy(new StartSelfStudyAttemptRequest(id, "default", null, null));
        assertThat(mapper.writeValueAsString(started.questions())).doesNotContain("gradingCriteria");
        attempts.submit(started.attemptId(), new SubmitAssessmentAttemptRequest(null,
                List.of(new AnswerItem(question.getQuestionId(), "{\"text\":\"The diagram shows how a boiler works.\"}")), started.revision(), null));
        gradingService.gradeAttempt(started.attemptId());

        // Người chấm thấy tiêu chí ở chi tiết chấm bài.
        var detail = grading.detail(started.attemptId());
        assertThat(detail.answers().get(0).gradingCriteria()).extracting("label").containsExactly("Nội dung", "Ngữ pháp", "Từ vựng", "Trình bày");

        // Sau khi chấm xong học viên xem được câu hỏi đầy đủ nhưng vẫn không có tiêu chí.
        when(redisLockService.isHeldBy(any(), any(), any())).thenReturn(true);
        grading.save(started.attemptId(), new SaveAssessmentManualGradingRequest("token", List.of(
                new SaveAssessmentManualGradingRequest.Item(detail.answers().get(0).answerId(), BigDecimal.valueOf(6), "Ok", null))));
        AssessmentAttemptResultResponse graded = results.getResult(started.attemptId(), null).body();
        assertThat(mapper.writeValueAsString(graded.questions())).doesNotContain("gradingCriteria");
    }

    @Test
    void speaking_submitsAudioAnswersToManualGrading_andClassTimeModesAreIndependentOfSkill() throws Exception {
        String id = publish("speaking-day-off");
        JsonNode content = seed("speaking-day-off").get("content");
        AssessmentAttemptResponse started = attempts.startOrResumeSelfStudy(new StartSelfStudyAttemptRequest(id, "default", null, null));
        assertThat(started.endsAt()).as("speaking has a deadline like every other skill").isNotNull();
        String first = content.get("questions").get(0).get("questionId").asText();
        String audio = "{\"audio\":{\"fileId\":\"f1\",\"mimeType\":\"audio/webm\",\"sizeBytes\":10,\"durationSeconds\":12}}";
        AssessmentAttemptResponse saved = attempts.saveDraft(started.attemptId(), new SaveAttemptDraftRequest(started.revision(), Map.of(first, audio), null));
        attempts.submit(started.attemptId(), new SubmitAssessmentAttemptRequest(null, List.of(), saved.revision(), null));
        gradingService.gradeAttempt(started.attemptId());
        assertThat(results.getResult(started.attemptId(), null).body().gradingStatus()).isEqualTo(AssessmentGradingStatus.MANUAL_GRADING);
        assertThat(attemptRepository.findById(started.attemptId()).orElseThrow().getSubmittedAt()).isNotNull();
    }

    @Test
    void classificationAndTagFiltersWork_andCopiesInheritTheLabel() throws Exception {
        String id = publish("listening-section-1");
        // Lọc theo nhãn/tag trong Kho dùng truy vấn native của PostgreSQL (kiểm ở E2E); ở đây kiểm truy vấn danh mục theo nhãn.
        assertThat(resourceRepository.findByTypeAndInLibraryTrueAndSubTypeAndPublishedVersionIdIsNotNullAndDeletedFalseOrderByIdAsc(
                LearningResourceType.ASSESSMENT, ResourceSubTypes.PRACTICE_LISTENING)).extracting("id").contains(id);
        assertThat(resourceRepository.findByTypeAndInLibraryTrueAndSubTypeAndPublishedVersionIdIsNotNullAndDeletedFalseOrderByIdAsc(
                LearningResourceType.ASSESSMENT, ResourceSubTypes.PRACTICE_WRITING)).extracting("id").doesNotContain(id);
        resources.updateClassification(id, ResourceSubTypes.PRACTICE_LISTENING, List.of("  Actual   Tests ", "Section 1"));
        assertThat(resources.getResource(id).getTags()).containsExactlyInAnyOrder("Actual Tests", "Section 1");
        // Đổi sang loại khác bị từ chối và không đụng tới loại đang lưu.
        org.junit.jupiter.api.Assertions.assertThrows(base.co.common.exception.ApiException.class,
                () -> resources.updateClassification(id, ResourceSubTypes.PRACTICE_READING, null));
        assertThat(resources.getResource(id).getSubType()).isEqualTo(ResourceSubTypes.PRACTICE_LISTENING);
        var copy = resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.ASSESSMENT, mapper.treeToValue(seed("listening-section-1").get("content"), QuizContent.class), true, false, id));
        assertThat(copy.getSubType()).isEqualTo(ResourceSubTypes.PRACTICE_LISTENING);
        assertThat(copy.getTags()).containsExactlyInAnyOrder("Actual Tests", "Section 1");
    }

    @Test
    void tags_workOnAnyResourceType_reuseExistingSpelling_andCanBeRenamedMergedAndDeleted() {
        var grammar = resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.GRAMMAR, null, null, true, null, null, List.of("Present  Simple", "B1")));
        assertThat(grammar.getTags()).containsExactlyInAnyOrder("Present Simple", "B1");
        assertThat(grammar.getSubType()).as("only assessments carry a label").isNull();

        // Cùng tag viết khác hoa/thường dùng lại cách viết đã có.
        var slide = resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.SLIDE, null, null, true, null, null, List.of("present simple", "Week 1")));
        assertThat(slide.getTags()).containsExactlyInAnyOrder("Present Simple", "Week 1");

        var all = resources.listTags(null, true);
        assertThat(all).extracting("tag").contains("Present Simple", "B1", "Week 1");
        assertThat(all.stream().filter(c -> c.tag().equals("Present Simple")).findFirst().orElseThrow().count()).isEqualTo(2);
        assertThat(resources.listTags(LearningResourceType.SLIDE, true)).extracting("tag").containsExactlyInAnyOrder("Present Simple", "Week 1");

        // Gộp "Week 1" vào "B1": resource giữ một tag duy nhất.
        resources.updateClassification(slide.getId(), null, List.of("Present Simple", "Week 1", "B1"));
        assertThat(resources.renameTag("week 1", "B1")).isGreaterThan(0);
        assertThat(resources.getResource(slide.getId()).getTags()).containsExactlyInAnyOrder("Present Simple", "B1");
        assertThat(resources.listTags(null, true)).extracting("tag").doesNotContain("Week 1");

        assertThat(resources.deleteTag("b1")).isEqualTo(2);
        assertThat(resources.getResource(grammar.getId()).getTags()).containsExactly("Present Simple");
        org.junit.jupiter.api.Assertions.assertThrows(base.co.common.exception.ApiException.class,
                () -> resources.updateClassification(grammar.getId(), ResourceSubTypes.PRACTICE_READING, null));
    }

    @Test
    void aNewResourceIsNeverInsertedWithUnfilledSearchColumns() {
        // Không có nội dung, không có tag: cột là chuỗi rỗng (đã điền), không phải null (chưa điền).
        var bare = resources.createResource(LearningResourceType.GRAMMAR);
        assertThat(bare.getSearchTitle()).isNotNull().isEmpty();
        assertThat(bare.getSearchText()).isNotNull();
        assertThat(bare.getSearchTags()).isNotNull();

        // Chỉ có tag: tag đã có trong cột ngay khi tạo.
        var tagged = resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.SLIDE, null, null, true, null, null, List.of("Tuần 1")));
        assertThat(tagged.getSearchTags()).isEqualTo("tuan 1");
        assertThat(resourceRepository.findById(tagged.getId()).orElseThrow().getSearchTags()).isEqualTo("tuan 1");
    }

    @Test
    void searchColumns_followContentTagsAndPublishing_onEveryWritePath() {
        var created = resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.VOCABULARY,
                Map.of("word", "Sustainable", "cefrLevel", "B2", "definitions", List.of(Map.of("meaningVi", "Bền vững"))),
                false, true, null, null, List.of("Đề thi")));
        String id = created.getId();

        // Mới tạo (bản nháp): cột lấy từ bản nháp và tag.
        var draft = resources.getResource(id);
        assertThat(draft.getSearchTitle()).isEqualTo("sustainable");
        assertThat(draft.getSearchText()).contains("ben vung");
        assertThat(draft.getSearchTags()).isEqualTo("de thi");
        assertThat(draft.getWordKey()).isEqualTo("sustainable");
        assertThat(draft.getCefrLevel()).isEqualTo("B2");

        // Sửa bản nháp hiện hành: cột đổi theo.
        resources.updateDraftVersion(id, draft.getDraftVersionId(),
                Map.of("word", "Sustainable", "definitions", List.of(Map.of("meaningVi", "Lâu dài"))));
        assertThat(resources.getResource(id).getSearchText()).contains("lau dai").doesNotContain("ben vung");

        // Xuất bản rồi tạo bản nháp mới: cột vẫn theo bản đã xuất bản, chỉ đổi khi xuất bản bản mới.
        var v1 = resources.getResource(id).getDraftVersionId();
        resources.publishVersion(id, v1);
        var v2 = resources.createDraftVersion(id, Map.of("word", "Sustainable", "definitions", List.of(Map.of("meaningVi", "Mới"))));
        assertThat(resources.getResource(id).getSearchText()).contains("lau dai").doesNotContain("moi");
        resources.publishVersion(id, v2.getId());
        assertThat(resources.getResource(id).getSearchText()).contains("moi");

        // Tag: đổi tên, gộp và xoá đều làm mới search_tags.
        resources.renameTag("đề thi", "Kiểm tra");
        assertThat(resources.getResource(id).getSearchTags()).isEqualTo("kiem tra");
        resources.updateClassification(id, null, List.of("Kiểm tra", "IELTS"));
        assertThat(resources.getResource(id).getSearchTags()).isEqualTo("kiem tra ielts");
        resources.deleteTag("ielts");
        assertThat(resources.getResource(id).getSearchTags()).isEqualTo("kiem tra");
    }

    private String vocab(String word, String meaningVi, List<String> collocationWords, String cefr, List<String> tags) {
        var content = new java.util.LinkedHashMap<String, Object>();
        content.put("word", word);
        content.put("cefrLevel", cefr);
        content.put("definitions", List.of(Map.of("meaningVi", meaningVi)));
        if (!collocationWords.isEmpty()) content.put("collocations", List.of(Map.of("pattern", "NOUN", "words", collocationWords)));
        return resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.VOCABULARY, content, true, true, null, null, tags)).getId();
    }

    private List<String> search(String keyword, String cefr, String tag) {
        return resources.listResourceResponses(LearningResourceType.VOCABULARY, keyword, null, cefr, null, true, false, null, tag, 0, 20)
                .getItems().stream().map(r -> r.id()).toList();
    }

    @Test
    void search_ignoresAccentsAndCase_ranksTitleFirst_andFindsMeaningCollocationAndTag() {
        String bank = vocab("Bank", "Ngân hàng", List.of("deposit", "account"), "A2", List.of("Đề thi"));
        String bankrupt = vocab("bankrupt", "Phá sản", List.of(), "C1", List.of());
        String river = vocab("river", "Bờ sông (river bank)", List.of(), "A2", List.of());
        String unrelated = vocab("zebra", "Ngựa vằn", List.of(), "B1", List.of());

        // Khớp đúng tiêu đề trước, rồi đầu tiêu đề, rồi chỉ khớp ở nghĩa.
        assertThat(search("bank", null, null)).containsExactly(bank, bankrupt, river);
        // Không dấu, khác hoa/thường, nghĩa tiếng Việt, collocation, tag.
        assertThat(search("NGAN HANG", null, null)).containsExactly(bank);
        assertThat(search("sông", null, null)).containsExactly(river);
        assertThat(search("deposit", null, null)).containsExactly(bank);
        assertThat(search("de thi", null, null)).containsExactly(bank);
        // Từ khoá ngắn (< 3 ký tự) chỉ khớp đầu tiêu đề: "ba" không kéo theo bản ghi chỉ khớp ở nghĩa.
        assertThat(search("ba", null, null)).containsExactlyInAnyOrder(bank, bankrupt);
        // Ký tự đặc biệt của LIKE không phải ký tự đại diện.
        assertThat(search("%", null, null)).isEmpty();
        // Lọc cấp độ và tag độc lập với từ khoá.
        assertThat(search(null, "a2", null)).containsExactlyInAnyOrder(bank, river);
        assertThat(search("bank", "C1", null)).containsExactly(bankrupt);
        assertThat(search(null, null, "Đề thi")).containsExactly(bank);
        assertThat(search("zebra", null, null)).containsExactly(unrelated);
    }

    @Test
    void dictionary_searchesPublishedWordsInTheDatabase_withFiltersAndPaging() {
        String a = vocab("alpha", "Chữ cái đầu", List.of(), "A1", List.of());
        String b = vocab("beta", "Chữ cái thứ hai", List.of(), "A1", List.of());
        var draftOnly = resources.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.VOCABULARY, Map.of("word", "gamma", "definitions", List.of(Map.of("meaningVi", "Nháp"))), false, true));

        var all = resources.searchVocabulary(null, null, null, 0, 1);
        assertThat(all.getTotalElements()).as("drafts are not part of the dictionary").isEqualTo(2);
        assertThat(all.getItems()).extracting(r -> r.id()).containsExactly(a);                  // sắp theo chữ cái, trang 1 chỉ có 1 từ
        assertThat(resources.searchVocabulary(null, null, null, 1, 1).getItems()).extracting(r -> r.id()).containsExactly(b);
        assertThat(resources.searchVocabulary("chu cai thu hai", null, null, 0, 10).getItems()).extracting(r -> r.id()).containsExactly(b);
        assertThat(resources.searchVocabulary(null, null, "a1", 0, 10).getTotalElements()).isEqualTo(2);
        assertThat(resources.searchVocabulary(null, "Chưa phân loại", null, 0, 10).getTotalElements()).as("no topic set").isEqualTo(2);
        assertThat(resources.searchVocabulary("gamma", null, null, 0, 10).getItems()).isEmpty();
        assertThat(draftOnly.getId()).isNotNull();
    }

    @Test
    void existingLibraryWords_matchesByCaseAndWhitespaceButKeepsAccents() {
        String resume = vocab("résumé", "Sơ yếu lý lịch", List.of(), "B2", List.of());
        String plain = vocab("resume", "Tiếp tục", List.of(), "B2", List.of());

        var found = resources.existingLibraryWords(List.of("  RÉSUMÉ ", "Resume", "absent"));
        assertThat(found).containsEntry("résumé", resume).containsEntry("resume", plain).doesNotContainKey("absent");
    }

    @Test
    void bulkCreateQuizzes_createsEveryItemIntoTheLibrary_evenWhenTitlesRepeat() {
        java.util.function.Function<String, Map<String, Object>> quiz = title -> {
            var question = new java.util.LinkedHashMap<String, Object>();
            question.put("questionId", base.co.common.util.UlidGenerator.nextUlid());
            question.put("questionType", "MULTIPLE_CHOICE");
            question.put("questionText", "<p>2 + 2 = ?</p>");
            question.put("points", 1);
            question.put("options", List.of(
                    Map.of("optionIndex", 0, "content", "3", "correct", false),
                    Map.of("optionIndex", 1, "content", "4", "correct", true)));
            var content = new java.util.LinkedHashMap<String, Object>();
            content.put("title", title);
            content.put("questions", List.of(question));
            return content;
        };
        var items = List.of(
                new pl.co.lms.dto.request.BulkCreateLearningResourcesRequest.Item(quiz.apply("Bài giống nhau"), null),
                new pl.co.lms.dto.request.BulkCreateLearningResourcesRequest.Item(quiz.apply("Bài giống nhau"), null, "PRACTICE"));

        var result = resources.bulkCreateLibraryResources(new pl.co.lms.dto.request.BulkCreateLearningResourcesRequest(
                LearningResourceType.ASSESSMENT, items, true, null));

        assertThat(result.created()).isEqualTo(2);
        assertThat(result.skipped()).isZero();
        String id = result.results().get(0).resourceId();
        assertThat(resources.getResource(id).isInLibrary()).isTrue();
        assertThat(resources.getResource(id).getSubType()).isEqualTo(ResourceSubTypes.QUIZ);
        assertThat(resources.getResource(id).getSkill()).isNull();
        assertThat(resources.getResource(result.results().get(1).resourceId()).getSkill()).isEqualTo("PRACTICE");

        // skill sai định dạng: mục bị báo lỗi và không để lại học liệu rỗng nào
        long before = resources.listResourceResponses(LearningResourceType.ASSESSMENT, null, null, null, 0, 1000).getTotalElements();
        var bad = resources.bulkCreateLibraryResources(new pl.co.lms.dto.request.BulkCreateLearningResourcesRequest(LearningResourceType.ASSESSMENT,
                List.of(new pl.co.lms.dto.request.BulkCreateLearningResourcesRequest.Item(quiz.apply("Kỹ năng sai"), null, "practice skill")), true, null));
        assertThat(bad.failed()).isEqualTo(1);
        assertThat(resources.listResourceResponses(LearningResourceType.ASSESSMENT, null, null, null, 0, 1000).getTotalElements()).isEqualTo(before);
    }

    @Test
    void bulkCreate_savesValidItems_reportsInvalidOnesWithoutLeavingPartialResources() {
        var word = new java.util.LinkedHashMap<String, Object>();
        word.put("word", "sustainable");
        word.put("partOfSpeech", "adjective");
        word.put("definitions", List.of(Map.of("meaningVi", "bền vững", "definitionEn", "able to continue")));
        word.put("collocations", List.of(Map.of("pattern", "ADJ", "words", List.of("environmental", "green"))));

        var badWord = Map.<String, Object>of("word", "  ");                                // thiếu từ
        var badCollocation = Map.<String, Object>of("word", "broken", "collocations", List.of(Map.of("pattern", "ADJ")));  // thiếu từ đi kèm
        long before = resourceRepository.findByTypeAndDeletedFalseOrderByCreatedAtDesc(LearningResourceType.VOCABULARY).size();

        // ExistingPolicy.CREATE: câu truy vấn từ đã có chỉ chạy trên Postgres (SKIP/OVERWRITE được kiểm chứng ở môi trường dev).
        var response = resources.bulkCreateLibraryResources(new pl.co.lms.dto.request.BulkCreateLearningResourcesRequest(
                LearningResourceType.VOCABULARY,
                List.of(new pl.co.lms.dto.request.BulkCreateLearningResourcesRequest.Item(word, List.of("Figma demo")),
                        new pl.co.lms.dto.request.BulkCreateLearningResourcesRequest.Item(badWord, null),
                        new pl.co.lms.dto.request.BulkCreateLearningResourcesRequest.Item(badCollocation, null)),
                true, pl.co.lms.dto.request.BulkCreateLearningResourcesRequest.ExistingPolicy.CREATE));

        assertThat(response.created()).isEqualTo(1);
        assertThat(response.failed()).isEqualTo(2);
        assertThat(response.results()).extracting("index").containsExactly(0, 1, 2);
        assertThat(response.results().get(1).message()).contains("word");
        assertThat(response.results().get(2).message()).contains("Collocation 1");

        var saved = resources.getResource(response.results().get(0).resourceId());
        assertThat(saved.isInLibrary()).isTrue();
        assertThat(saved.getPublishedVersionId()).isNotNull();
        assertThat(saved.getTags()).containsExactly("Figma demo");
        assertThat(resourceRepository.findByTypeAndDeletedFalseOrderByCreatedAtDesc(LearningResourceType.VOCABULARY))
                .as("failed items must not leave half-created resources").hasSize((int) before + 1);
    }
}