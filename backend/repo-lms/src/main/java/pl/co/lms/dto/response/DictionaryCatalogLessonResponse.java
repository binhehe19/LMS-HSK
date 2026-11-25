package pl.co.lms.dto.response;

import java.util.List;

/**
 * Một bài học từ vựng: tối đa 5 từ liên tiếp (theo chữ cái) trong cùng một chủ đề. id = id của từ đầu tiên;
 * topic = tên chủ đề ('' khi các từ chưa có chủ đề); number = số thứ tự bài trong phạm vi (đánh số từ 1).
 */
public record DictionaryCatalogLessonResponse(
        String id,
        int number,
        String topic,
        List<LearningResourceResponse> words
) {}
