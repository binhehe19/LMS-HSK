package pl.co.lms.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;

/** Client progress is a practice record. Correctness is recomputed from published content. */
public record DictionarySessionData(
        @NotNull @Min(1) @Max(1) Integer version,
        @NotNull @Size(min = 1, max = 5) List<@NotBlank @Size(max = 26) String> ids,
        @NotNull @Size(max = 200000) String content,
        @Min(0) @Max(4) int stage,
        @Min(0) @Max(4) int index,
        @NotNull @Size(max = 5) List<@NotBlank @Size(max = 26) String> known,
        @NotNull @Size(max = 5) Map<@NotBlank @Size(max = 26) String, @NotNull @Valid Answer> probe,
        @NotNull @Size(max = 5) Map<@NotBlank @Size(max = 26) String, @NotNull @Valid Answer> assemble,
        @NotNull @Size(max = 5) Map<@NotBlank @Size(max = 26) String, @NotNull @Valid Answer> communicate,
        boolean completed,
        @NotBlank @Size(max = 50) String startedAt,
        @Size(max = 5) List<@NotBlank @Size(max = 26) String> practiceIds,
        @Size(max = 50) String completedAt,
        LessonPass lessonPass) {
    /** Only the server can award this milestone. It survives practice replays. */
    public record LessonPass(String method, int correct, int total, String at) {}
    public DictionarySessionData(Integer version, List<String> ids, String content, int stage, int index,
            List<String> known, Map<String,Answer> probe, Map<String,Answer> assemble, Map<String,Answer> communicate,
            boolean completed, String startedAt, List<String> practiceIds, String completedAt) {
        this(version,ids,content,stage,index,known,probe,assemble,communicate,completed,startedAt,practiceIds,completedAt,null);
    }
    public record Answer(@NotNull @Size(max = 2000) String text, boolean correct, boolean skipped, boolean firstCorrect) {}
}
