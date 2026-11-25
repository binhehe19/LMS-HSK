package pl.co.lms.dto.request;

public record CreateContentPackageVersionRequest(
        String title,
        String description,
        String level,
        String topic
) {}
