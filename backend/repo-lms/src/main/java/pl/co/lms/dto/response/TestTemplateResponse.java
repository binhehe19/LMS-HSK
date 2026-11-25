package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsTestTemplate;

public record TestTemplateResponse(
        String id,
        String midtermFormat,
        String finalFormat,
        String notes
) {
    public static TestTemplateResponse from(CmsTestTemplate t) {
        if (t == null) return null;
        return new TestTemplateResponse(t.getId(), t.getMidtermFormat(), t.getFinalFormat(), t.getNotes());
    }
}
