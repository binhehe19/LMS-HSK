package pl.co.lms.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.util.Map;

// Lưu nháp của lượt tự luyện trong một giao dịch: đáp án + trạng thái giao diện, theo khoá lạc quan revision.
// answers: questionId → answerJson. null = không đụng tới đáp án; có giá trị = thay toàn bộ (câu vắng mặt bị xoá đáp án).
// clientState: null = giữ nguyên trạng thái giao diện hiện có.
public record SaveAttemptDraftRequest(
        @NotNull @PositiveOrZero Long revision,
        Map<String, String> answers,
        JsonNode clientState
) {}