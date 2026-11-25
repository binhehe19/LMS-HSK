package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsTeacherSummary;

import java.util.List;

public record TeacherSummaryResponse(
        String id,
        String fullName,
        String email,
        String avatarUrl,
        String status,
        List<String> roles,
        List<String> tags
) {
    public static TeacherSummaryResponse from(CmsTeacherSummary t) {
        if (t == null) return null;
        return new TeacherSummaryResponse(
                t.getId(), t.getFullName(), t.getEmail(), t.getAvatarUrl(), t.getStatus(),
                t.getRoles() == null ? List.of() : t.getRoles(),
                t.getTags() == null ? List.of() : t.getTags());
    }
}
