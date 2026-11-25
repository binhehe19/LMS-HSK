package pl.co.lms.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chốt chặn cho các cột tìm kiếm của learning_resources (ResourceSearchColumns): chúng chỉ đúng nếu MỌI lần ghi resource/phiên bản đi qua
 * LearningResourceService (nơi tính lại cột). Test quét mã nguồn để một đường ghi mới bên ngoài service (gọi save/delete trực tiếp trên repository
 * của resource hoặc của phiên bản, hoặc UPDATE bằng SQL) bị phát hiện ngay thay vì làm lệch dữ liệu tìm kiếm một cách âm thầm.
 * Nếu test này đỏ: đưa đường ghi đó vào LearningResourceService (gọi refreshSearchColumns), đừng nới test.
 */
class ResourceWritePathsGuardTest {

    private static final Path MAIN = Path.of("src", "main", "java");
    private static final Pattern REPOSITORY_FIELD = Pattern.compile("\\b(LearningResourceRepository|LearningResourceVersionRepository)\\s+(\\w+)\\s*[;=,)]");

    private static List<Path> mainSources() throws IOException {
        try (Stream<Path> files = Files.walk(MAIN)) {
            return files.filter(p -> p.toString().endsWith(".java")).toList();
        }
    }

    @Test
    void onlyLearningResourceServiceWritesResourcesAndVersions() throws IOException {
        List<String> violations = new ArrayList<>();
        for (Path file : mainSources()) {
            String name = file.getFileName().toString();
            if (name.equals("LearningResourceService.java") || name.endsWith("Repository.java")) continue;
            String text = Files.readString(file);
            Matcher fields = REPOSITORY_FIELD.matcher(text);
            while (fields.find()) {
                String variable = fields.group(2);
                Matcher write = Pattern.compile("\\b" + variable + "\\s*\\.\\s*(save|saveAll|saveAndFlush|delete\\w*|flush)\\s*\\(").matcher(text);
                if (write.find()) violations.add(name + ": " + variable + "." + write.group(1) + "(...)");
            }
        }
        assertThat(violations)
                .as("resources/versions must only be written by LearningResourceService, which keeps the search columns in sync")
                .isEmpty();
    }

    @Test
    void sqlThatModifiesRowsOfResourcesOrVersionsDoesNotExistOutsideTheTagTable() throws IOException {
        List<String> violations = new ArrayList<>();
        Pattern sql = Pattern.compile("(?is)(UPDATE|DELETE\\s+FROM|INSERT\\s+INTO)\\s+(learning_resources|learning_resource_versions)\\b");
        for (Path file : mainSources()) {
            Matcher m = sql.matcher(Files.readString(file));
            while (m.find()) violations.add(file.getFileName() + ": " + m.group().replaceAll("\\s+", " "));
        }
        assertThat(violations).as("direct SQL writes would bypass the search columns").isEmpty();
    }
}
