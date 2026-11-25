package pl.co.lms.dto.response;

/**
 * Một ý của câu nối / câu điền chỗ trống: {@code index} là pairIndex / blankIndex của câu (hoặc vị trí khi thiếu),
 * {@code correct} là đúng hay sai theo đáp án hệ thống. Tính lúc đọc từ bài làm, không lưu.
 */
public record PartResult(int index, boolean correct) {}
