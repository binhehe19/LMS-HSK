package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import pl.co.lms.entity.LearningResourceType;

import java.util.List;

/** Tạo nhiều tài nguyên cùng loại vào Kho trong một lần gọi (nhập từ tệp Excel). */
public record BulkCreateLearningResourcesRequest(
        @NotNull(message = "Resource type is required")
        LearningResourceType type,
        @NotEmpty(message = "Danh sách rỗng")
        @Size(max = 500, message = "Tối đa 500 mục mỗi lần")
        List<Item> items,
        /** Mặc định true: xuất bản ngay để dùng được trong từ điển/Kho. */
        Boolean publishImmediately,
        /** Cách xử lý mục đã có trong Kho (hiện chỉ áp dụng cho từ vựng: cùng từ, không phân biệt hoa thường); mặc định SKIP. */
        ExistingPolicy existing
) {
    /** skill: kỹ năng của học liệu (token tự do, tùy chọn), như khi tạo từng học liệu. */
    public record Item(Object content, List<String> tags, String skill) {
        public Item(Object content, List<String> tags) {
            this(content, tags, null);
        }
    }

    public enum ExistingPolicy {
        /** Bỏ qua mục đã có. */
        SKIP,
        /** Ghi đè nội dung mục đã có bằng một phiên bản mới (lịch sử phiên bản được giữ). */
        OVERWRITE,
        /** Không kiểm tra trùng, luôn tạo mới. */
        CREATE
    }
}
