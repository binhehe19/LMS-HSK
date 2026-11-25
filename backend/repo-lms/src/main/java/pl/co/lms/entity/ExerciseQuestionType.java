package pl.co.lms.entity;

/** Exercise interactions supported by the shared learner engine. */
public enum ExerciseQuestionType {
    MULTIPLE_CHOICE,
    MULTIPLE_SELECT,
    /**
     * Nối: danh sách lựa chọn chung ({@code options}, gồm cả đáp án nhiễu) và các dòng cần nối ({@code matchingPairs}); mỗi dòng
     * là một ý, chấm từng ý theo chỉ số lựa chọn ({@code answerOptionIndex}), không theo chữ. Gồm True/False/Not Given, nối tiêu đề, nối thông tin, nhãn sơ đồ… (nhãn dạng nằm ở {@code variant}).
     */
    MATCHING,
    /** Điền chỗ trống: mỗi chỗ trống ({@code blanks}) là một ý, chấm từng ý; có thể kèm ngân hàng từ ({@code options}). */
    FILL_IN_BLANK,
    SENTENCE_BUILDER,
    AUDIO_RESPONSE,
    ESSAY,
    FILE_UPLOAD;

    /** Accept the previous MATCHING_PAIRS name; serialize using the current MATCHING contract. */
    @com.fasterxml.jackson.annotation.JsonCreator
    public static ExerciseQuestionType fromJson(String value) {
        if ("MATCHING_PAIRS".equals(value)) return MATCHING;
        return ExerciseQuestionType.valueOf(value);
    }
}
