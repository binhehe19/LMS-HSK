package pl.co.lms.dto.response;

import java.util.List;

// 1 bucket nội dung của buổi học (VD "quiz", "grammar") - danh sách resource gắn trực tiếp qua
// ContentPackageVersionResource, xem SyllabusSessionResourcesResponse.
public record SessionResourceGroupResponse(
        List<ContentPackageVersionResourceResponse> freeResources
) {
    public static final SessionResourceGroupResponse EMPTY = new SessionResourceGroupResponse(List.of());
}
