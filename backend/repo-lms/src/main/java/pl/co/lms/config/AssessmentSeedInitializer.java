package pl.co.lms.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import pl.co.lms.dto.request.CreateLearningResourceRequest;
import pl.co.lms.entity.ResourceSubTypes;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.service.LearningResourceService;

import java.util.ArrayList;
import java.util.List;

/**
 * Nạp các bài đánh giá mẫu (Reading/Listening/Writing/Speaking) vào Kho từ {@code seed/assessments/*.json}.
 * Mỗi file có {@code subType}, {@code tags} và {@code content} (QuizContent). Bài đã nạp được nhận ra qua
 * {@code content.layout.meta.key} nên chạy lại không tạo trùng.
 */
@Slf4j
@Component
@Order(100)
@RequiredArgsConstructor
public class AssessmentSeedInitializer implements CommandLineRunner {

    private static final String PATTERN = "classpath*:seed/assessments/*.json";

    private final LearningResourceService resourceService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper mapper;

    @Override
    public void run(String... args) throws Exception {
        for (Resource file : new PathMatchingResourcePatternResolver().getResources(PATTERN)) {
            try {
                seed(mapper.readTree(file.getInputStream()), file.getFilename());
            } catch (Exception e) {
                log.warn("Không nạp được bài mẫu {}: {}", file.getFilename(), e.getMessage());
            }
        }
    }

    private void seed(JsonNode root, String filename) throws Exception {
        QuizContent content = mapper.treeToValue(root.path("content"), QuizContent.class);
        String key = content.getLayout() == null ? null : content.getLayout().path("meta").path("key").asText(null);
        if (key == null || key.isBlank()) {
            log.warn("Bài mẫu {} thiếu layout.meta.key, bỏ qua", filename);
            return;
        }
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM learning_resource_versions WHERE content::jsonb -> 'layout' -> 'meta' ->> 'key' = ?",
                Integer.class, key);
        if (existing != null && existing > 0) return;
        List<String> tags = new ArrayList<>();
        root.path("tags").forEach(t -> tags.add(t.asText()));
        String subType = root.path("subType").asText(ResourceSubTypes.QUIZ);
        resourceService.createResourceWithContent(new CreateLearningResourceRequest(
                LearningResourceType.ASSESSMENT, content, true, true, null, subType, tags));
        log.info("Đã nạp bài mẫu {} ({})", key, subType);
    }
}