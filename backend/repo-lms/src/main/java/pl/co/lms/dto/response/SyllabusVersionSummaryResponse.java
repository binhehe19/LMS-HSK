package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsSyllabusVersionSummary;

// Xem ghi chú ở SyllabusSummaryResponse - tách khỏi CmsSyllabusVersionSummary (client DTO,
// @JsonNaming(SnakeCaseStrategy) để đọc từ CMS) để trả camelCase đúng hợp đồng cho FE.
public record SyllabusVersionSummaryResponse(
        String id,
        Integer versionNo,
        String status,
        String publishedAt,
        String publishedBy,
        String changeNote
) {
    public static SyllabusVersionSummaryResponse from(CmsSyllabusVersionSummary v) {
        return new SyllabusVersionSummaryResponse(v.getId(), v.getVersionNo(), v.getStatus(),
                v.getPublishedAt(), v.getPublishedBy(), v.getChangeNote());
    }
}
