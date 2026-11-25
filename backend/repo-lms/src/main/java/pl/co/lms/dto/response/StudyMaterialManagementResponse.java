package pl.co.lms.dto.response;


public record StudyMaterialManagementResponse(
        LearningResourceResponse resource, LearningResourceVersionResponse draft, LearningResourceVersionResponse published
) {}
