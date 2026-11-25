package pl.co.lms.dto.request;

import jakarta.validation.constraints.Size;

/** Chuỗi rỗng hợp lệ để frontend lưu thao tác xoá textarea. */
public record SaveDictationAnswerRequest(
        @Size(max = 5000) String answerText
) {}
