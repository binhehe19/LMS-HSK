package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsGradingItem;

import java.util.List;

public record GradingItemResponse(
        String id,
        String item,
        String type,
        Double weight,
        String timing,
        String duration,
        List<String> cloIds,
        String organizationalForm,
        String criteria,
        String contentScope
) {
    public static GradingItemResponse from(CmsGradingItem g) {
        return new GradingItemResponse(
                g.getId(), g.getItem(), g.getType(), g.getWeight(), g.getTiming(), g.getDuration(),
                g.getCloIds() == null ? List.of() : g.getCloIds(),
                g.getOrganizationalForm(), g.getCriteria(), g.getContentScope());
    }
}
