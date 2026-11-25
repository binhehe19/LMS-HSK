package pl.co.lms.dto.response;

import pl.co.lms.entity.json.PlacementSettings;

import java.util.List;

// Mọi bài tập trong các học phần của một giáo trình kèm điều kiện đặt bài - nguồn cho khối "Tính điểm" ở màn giáo trình.
public record SyllabusGradingSummaryResponse(List<Item> assignments) {
    public record Item(
            String packageId,
            String packageTitle,
            String resourceId,
            String resourceTitle,
            int sessionNo,
            PlacementSettings settings
    ) {}
}
