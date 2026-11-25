package pl.co.lms.dto.response;

import java.util.Map;

/**
 * Tiến độ từ vựng của người dùng trong một phạm vi. known/learning không gồm lịch ôn (nhắc ôn nằm trong hồ sơ từ điển).
 * groups chỉ có khi yêu cầu tách theo cấp độ hoặc chủ đề; khoá là tên nhóm ("Chưa phân loại" khi trống, cùng chuỗi với summary-counts).
 */
public record VocabularyUserSummaryResponse(
        long known,
        long learning,
        long saved,
        Map<String, GroupProgress> groups
) {
    public record GroupProgress(long known, long learning) {}
}
