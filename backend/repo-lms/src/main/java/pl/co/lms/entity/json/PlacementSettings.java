package pl.co.lms.entity.json;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.List;

/**
 * Điều kiện của một bài tập khi đặt vào học phần (lưu ở dòng đặt bài, cạnh sessionNo). Bản hiện tại chỉ lưu và hiển thị,
 * chưa áp dụng khi học viên làm bài.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PlacementSettings {

    public enum AssignmentType { HOMEWORK, SPACED_REVIEW, DIAGNOSTIC_QUIZ, REMEDIAL, EXTENSION, PROGRESS_TEST, MOCK_TEST, EXIT_TEST }

    public enum ShowAnswer { AFTER_SUBMIT, AFTER_DUE, NEVER }

    private AssignmentType assignmentType;
    /** Số lần làm tối đa (1–3); null = không giới hạn. */
    private Integer maxAttempts;
    private ShowAnswer showAnswer;
    /** Ngưỡng đạt (%), 0–100. */
    private Integer passThresholdPct;
    /** Mở / hạn nộp: giờ sau khi session của lớp kết thúc. */
    private Integer releaseOffsetH;
    private Integer dueOffsetH;
    /** Mã CLO của syllabus mà bài phục vụ; không giới hạn số lượng. */
    private List<String> cloCodes;
    /** Hạng mục tính điểm của syllabus (tab Tiêu chí): chỉ lưu tên và vị trí, tỷ trọng đọc từ syllabus khi hiển thị. */
    private GradingItemRef gradingItem;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class GradingItemRef {
        private String name;
        private Integer position;
    }

    private static final int MAX_CLO_CODE_LENGTH = 50;
    private static final int MAX_ITEM_NAME_LENGTH = 200;

    public void validate() {
        if (maxAttempts != null && (maxAttempts < 1 || maxAttempts > 3)) fail("Số lần làm tối đa phải từ 1 đến 3");
        if (passThresholdPct != null && (passThresholdPct < 0 || passThresholdPct > 100)) fail("Ngưỡng đạt phải từ 0 đến 100");
        if (releaseOffsetH != null && releaseOffsetH < 0) fail("Giờ mở bài không được âm");
        if (dueOffsetH != null && dueOffsetH < 0) fail("Hạn nộp không được âm");
        if (releaseOffsetH != null && dueOffsetH != null && dueOffsetH < releaseOffsetH) fail("Hạn nộp phải sau giờ mở bài");
        if (cloCodes != null) {
            var seen = new HashSet<String>();
            for (String code : cloCodes) {
                if (code == null || code.isBlank()) fail("Mã CLO không được để trống");
                if (code.length() > MAX_CLO_CODE_LENGTH) fail("Mã CLO quá dài: " + code);
                if (!seen.add(code.trim())) fail("Mã CLO bị trùng: " + code);
            }
        }
        if (gradingItem != null) {
            if (gradingItem.getName() == null || gradingItem.getName().isBlank()) fail("Hạng mục tính điểm cần có tên");
            if (gradingItem.getName().length() > MAX_ITEM_NAME_LENGTH) fail("Tên hạng mục quá dài");
            if (gradingItem.getPosition() != null && gradingItem.getPosition() < 0) fail("Vị trí hạng mục không hợp lệ");
        }
    }

    private static void fail(String message) {
        throw new ApiException(ErrorCode.E200, message);
    }
}
