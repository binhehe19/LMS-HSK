package pl.co.lms.dto.request;

public record UpdateContentPackageVersionRequest(
        String title,
        String description,
        String level,
        String topic,
        /** Số buổi của học phần (bao gồm cả buổi trống). Null = không đổi. */
        Integer sessionCount
) {}
