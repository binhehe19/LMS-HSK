package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotNull;
import pl.co.lms.entity.LanguagePracticeMode;

/** restart=true sẽ bỏ lượt đang làm dở (nếu có) và tạo lượt mới cùng resource version/mode. */
public record StartLanguagePracticeAttemptRequest(
        @NotNull LanguagePracticeMode mode,
        Boolean restart
) {}
