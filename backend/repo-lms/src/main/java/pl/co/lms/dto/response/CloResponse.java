package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsClo;

public record CloResponse(
        String id,
        String code,
        String name,
        String description
) {
    public static CloResponse from(CmsClo c) {
        return new CloResponse(c.getId(), c.getCode(), c.getName(), c.getDescription());
    }
}
