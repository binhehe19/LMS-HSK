package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsMaterialRef;

public record MaterialRefResponse(
        String materialTitle,
        String materialLink
) {
    public static MaterialRefResponse from(CmsMaterialRef r) {
        return new MaterialRefResponse(r.getMaterialTitle(), r.getMaterialLink());
    }
}
