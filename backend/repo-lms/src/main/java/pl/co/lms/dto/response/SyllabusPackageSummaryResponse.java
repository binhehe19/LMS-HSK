package pl.co.lms.dto.response;

import pl.co.lms.entity.ContentPackageType;

import java.util.List;

// Tóm tắt package đã gắn theo từng syllabus - dùng cho màn danh sách Giáo trình để hiển thị
// ngay các package theo từng loại (Từ vựng/Ngữ pháp/...) mà không cần bấm vào mới tải.
public record SyllabusPackageSummaryResponse(
        String syllabusId,
        List<Item> packages
) {
    /** status = trạng thái bản đang hiển thị (DRAFT nghĩa là chưa từng publish); hasUnpublishedChanges = đã publish nhưng còn bản nháp chưa publish. */
    public record Item(String packageId, ContentPackageType type, String title, String level, String status, boolean hasUnpublishedChanges) {}
}
