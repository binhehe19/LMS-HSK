package pl.co.lms.dto.response;


public record StudyMaterialPersonalResponse(
        boolean saved, String note, StudyMaterialProgressResponse progress
) {}
