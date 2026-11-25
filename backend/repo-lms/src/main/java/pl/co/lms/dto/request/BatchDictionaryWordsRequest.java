package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BatchDictionaryWordsRequest(
        @NotNull(message = "ids cannot be null")
        @Size(max = 200, message = "Tối đa 200 từ mỗi lần")
        List<String> ids
) {}
