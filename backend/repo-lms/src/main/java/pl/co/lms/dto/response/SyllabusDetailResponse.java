package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsSyllabusDetail;

import java.util.List;

public record SyllabusDetailResponse(
        String id,
        String name,
        String code,
        String status,
        String educationLevelId,
        String educationLevelCode,
        String educationLevelName,
        Integer latestVersionNo,
        String createdAt,
        String updatedAt,
        String documentType,
        String trainingProgram,
        String prerequisite,
        String type,
        String distributionHours,
        String author,
        String teachingMethods,
        String learningTools,
        String minimumPassingScore,
        String scoreRange,
        String description,
        String studentResponsibilities,
        String notes,
        List<CloResponse> clo,
        List<SyllabusMaterialResponse> materials,
        List<ScheduleEntryResponse> schedule,
        List<GradingItemResponse> gradingStructure,
        TestTemplateResponse testTemplate,
        List<SyllabusVersionSummaryResponse> versions
) {
    public static SyllabusDetailResponse from(CmsSyllabusDetail d) {
        return new SyllabusDetailResponse(
                d.getId(), d.getName(), d.getCode(), d.getStatus(),
                d.getEducationLevelId(), d.getEducationLevelCode(), d.getEducationLevelName(),
                d.getLatestVersionNo(), d.getCreatedAt(), d.getUpdatedAt(),
                d.getDocumentType(), d.getTrainingProgram(), d.getPrerequisite(), d.getType(),
                d.getDistributionHours(), d.getAuthor(), d.getTeachingMethods(), d.getLearningTools(),
                d.getMinimumPassingScore(), d.getScoreRange(), d.getDescription(),
                d.getStudentResponsibilities(), d.getNotes(),
                d.getClo() == null ? List.of() : d.getClo().stream().map(CloResponse::from).toList(),
                d.getMaterials() == null ? List.of() : d.getMaterials().stream().map(SyllabusMaterialResponse::from).toList(),
                d.getSchedule() == null ? List.of() : d.getSchedule().stream().map(ScheduleEntryResponse::from).toList(),
                d.getGradingStructure() == null ? List.of() : d.getGradingStructure().stream().map(GradingItemResponse::from).toList(),
                TestTemplateResponse.from(d.getTestTemplate()),
                d.getVersions() == null ? List.of() : d.getVersions().stream().map(SyllabusVersionSummaryResponse::from).toList());
    }
}
