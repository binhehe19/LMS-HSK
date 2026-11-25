package pl.co.lms.service;

import com.fasterxml.jackson.databind.JsonNode;
import pl.co.lms.entity.ExerciseQuestionType;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Kiểm tra khi lưu đề những điều bộ chấm và màn học viên dựa vào: đáp án của câu nối nằm trong danh sách lựa chọn, chỗ trống {@code {{n}}}
 * khớp {@code blanks[]}, và tệp/audio chỉ là đường dẫn nội bộ của storage (không URL tuyệt đối, không {@code javascript:}/{@code data:}).
 * Trả danh sách lỗi tiếng Việt, rỗng nghĩa là hợp lệ.
 */
public final class QuizContentChecks {

    /** Đường dẫn tệp đã tải lên storage; đây là dạng duy nhất được lưu trong files[] và media[]. */
    private static final Pattern STORAGE_PATH = Pattern.compile("^/api/storage/file/[A-Za-z0-9_-]{1,100}$");
    private static final Pattern BLANK_MARKER = Pattern.compile("\\{\\{(\\d{1,6})}}");
    private static final int MAX_ASSETS = 50;
    private static final int MAX_TRANSCRIPT_TURNS = 5000;
    private static final int MAX_JSON_CHARS = 500_000;

    private QuizContentChecks() {}

    public static List<String> problems(QuizContent quiz) {
        List<String> out = new ArrayList<>();
        if (quiz.getQuestions() != null) {
            for (QuizQuestion q : quiz.getQuestions()) checkQuestion(q, out);
        }
        JsonNode sections = quiz.getLayout() == null ? null : quiz.getLayout().path("sections");
        if (sections != null && sections.isArray()) {
            for (JsonNode section : sections) {
                String where = "Phần " + section.path("id").asText("");
                checkFiles(section.path("files"), where, out);
                checkMedia(section.path("media"), where, out);
            }
        }
        return out;
    }

    private static void checkQuestion(QuizQuestion q, List<String> out) {
        String where = "Câu " + q.getQuestionId();
        if (q.getQuestionType() == ExerciseQuestionType.MATCHING) checkMatching(q, where, out);
        if (q.getQuestionType() == ExerciseQuestionType.FILL_IN_BLANK) checkBlanks(q, where, out);
        checkFiles(q.getFiles(), where, out);
        checkMedia(q.getMedia(), where, out);
        List<String> images = new ArrayList<>();
        if (q.getOptions() != null) q.getOptions().stream().filter(o -> o != null).forEach(o -> images.add(o.getMediaUrl()));
        if (q.getMatchingPairs() != null) q.getMatchingPairs().stream().filter(p -> p != null).forEach(p -> images.add(p.getPromptMediaUrl()));
        if (images.stream().anyMatch(url -> url != null && !STORAGE_PATH.matcher(url).matches())) {
            out.add(where + ": ảnh của lựa chọn/dòng nối phải là đường dẫn nội bộ /api/storage/file/<mã tệp>");
        }
        if (q.getHints() != null && q.getHints().toString().length() > MAX_JSON_CHARS) out.add(where + ": gợi ý quá dài");
    }

    // Mỗi dòng cần đáp án là chỉ số (answerOptionIndex) của một lựa chọn trong danh sách chung (gồm cả đáp án nhiễu); chỉ số lựa chọn
    // không được trùng. Chấm theo chỉ số nên hai lựa chọn trùng chữ (khác ảnh) vẫn phân biệt được.
    private static void checkMatching(QuizQuestion q, String where, List<String> out) {
        List<QuestionContent.QuizMatchingPairItem> pairs = q.getMatchingPairs();
        List<QuestionContent.QuizOptionItem> options = q.getOptions();
        if (pairs == null || pairs.isEmpty()) {
            out.add(where + ": câu nối cần ít nhất một dòng");
            return;
        }
        if (options == null || options.isEmpty()) {
            out.add(where + ": câu nối cần danh sách lựa chọn");
            return;
        }
        List<Integer> optionKeys = QuestionContent.optionKeys(options);
        if (new HashSet<>(optionKeys).size() != optionKeys.size()) out.add(where + ": chỉ số lựa chọn (optionIndex) bị trùng");
        Set<Integer> seen = new HashSet<>();
        for (int i = 0; i < pairs.size(); i++) {
            QuestionContent.QuizMatchingPairItem pair = pairs.get(i);
            if (pair == null) {
                out.add(where + ": dòng " + (i + 1) + " bị trống");
                continue;
            }
            int index = pair.getPairIndex() != null ? pair.getPairIndex() : i;
            if (index < 0 || !seen.add(index)) out.add(where + ": dòng " + (i + 1) + " có chỉ số bị âm hoặc trùng");
            if (pair.getAnswerOptionIndex() == null || !optionKeys.contains(pair.getAnswerOptionIndex())) {
                out.add(where + ": dòng " + (i + 1) + " có đáp án không nằm trong danh sách lựa chọn");
            }
        }
    }

    // {{n}} trong questionText (n từ 1) phải khớp đúng các chỗ trống: không thiếu, không thừa, không trùng.
    private static void checkBlanks(QuizQuestion q, String where, List<String> out) {
        List<QuestionContent.QuizBlankItem> blanks = q.getBlanks();
        if (blanks == null || blanks.isEmpty()) {
            out.add(where + ": câu điền chỗ trống cần ít nhất một chỗ trống");
            return;
        }
        Set<Integer> expected = new HashSet<>();
        boolean badIndex = false;
        for (int i = 0; i < blanks.size(); i++) {
            QuestionContent.QuizBlankItem blank = blanks.get(i);
            int index = blank == null || blank.getBlankIndex() == null ? i : blank.getBlankIndex();
            badIndex |= blank == null || index < 0 || !expected.add(index + 1);
        }
        List<Integer> found = new ArrayList<>();
        Matcher m = BLANK_MARKER.matcher(q.getQuestionText() == null ? "" : q.getQuestionText());
        while (m.find()) found.add(Integer.parseInt(m.group(1)));
        if (badIndex || found.size() != new HashSet<>(found).size() || !new HashSet<>(found).equals(expected)) {
            out.add(where + ": chỗ trống {{n}} trong đề không khớp với danh sách đáp án (" + blanks.size() + " chỗ trống)");
        }
    }

    private static void checkFiles(JsonNode files, String where, List<String> out) {
        if (files == null || files.isNull() || files.isMissingNode()) return;
        if (!files.isArray() || files.size() > MAX_ASSETS) {
            out.add(where + ": danh sách tệp không hợp lệ (tối đa " + MAX_ASSETS + " tệp)");
            return;
        }
        for (JsonNode file : files) {
            if (!file.isObject() || !isStoragePath(file.path("url"))) out.add(where + ": tệp phải là đường dẫn nội bộ /api/storage/file/<mã tệp>");
        }
    }

    private static void checkMedia(JsonNode media, String where, List<String> out) {
        if (media == null || media.isNull() || media.isMissingNode()) return;
        if (!media.isArray() || media.size() > MAX_ASSETS) {
            out.add(where + ": danh sách audio/video không hợp lệ (tối đa " + MAX_ASSETS + " tệp)");
            return;
        }
        for (JsonNode item : media) {
            String kind = item.path("kind").asText("");
            if (!item.isObject() || !isStoragePath(item.path("url")) || !(kind.equals("audio") || kind.equals("video"))) {
                out.add(where + ": audio/video phải có kind audio|video và đường dẫn nội bộ /api/storage/file/<mã tệp>");
            } else if (item.has("transcript") && (!item.path("transcript").isArray() || item.path("transcript").size() > MAX_TRANSCRIPT_TURNS
                    || item.path("transcript").toString().length() > MAX_JSON_CHARS)) {
                out.add(where + ": transcript không hợp lệ hoặc quá dài");
            }
        }
    }

    private static boolean isStoragePath(JsonNode url) {
        return url.isTextual() && STORAGE_PATH.matcher(url.asText()).matches();
    }
}
