package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsSyllabusSummary;

// KHÔNG trả thẳng CmsSyllabusSummary ra FE - class đó có @JsonNaming(SnakeCaseStrategy) để
// deserialize đúng từ CMS (snake_case), nếu serialize thẳng ra ngoài FE cũng sẽ nhận
// snake_case (sai hợp đồng, FE cần camelCase). Tách response riêng theo đúng pattern
// MaterialResponse.from(Material) đã dùng cho các entity khác.
public record SyllabusSummaryResponse(
        String id,
        String name,
        String code,
        String educationLevelId,
        String educationLevelCode,
        String educationLevelName,
        String type,
        String author,
        Integer latestVersionNo,
        String createdAt
) {
    public static SyllabusSummaryResponse from(CmsSyllabusSummary s) {
        return new SyllabusSummaryResponse(
                s.getId(), s.getName(), s.getCode(),
                s.getEducationLevelId(), s.getEducationLevelCode(), s.getEducationLevelName(),
                s.getType(), s.getAuthor(), s.getLatestVersionNo(), s.getCreatedAt());
    }
}
