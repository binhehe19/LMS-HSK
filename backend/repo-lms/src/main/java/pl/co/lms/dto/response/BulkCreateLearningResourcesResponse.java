package pl.co.lms.dto.response;

import java.util.List;

/** Kết quả từng mục (theo thứ tự gửi lên); mục lỗi không làm hỏng các mục còn lại. */
public record BulkCreateLearningResourcesResponse(int created, int overwritten, int skipped, int failed, List<Result> results) {

    public enum Status { CREATED, OVERWRITTEN, SKIPPED, FAILED }

    /** index tính từ 0 theo thứ tự gửi; resourceId có khi CREATED/OVERWRITTEN; message giải thích khi SKIPPED/FAILED. */
    public record Result(int index, Status status, String resourceId, String message) {}
}
