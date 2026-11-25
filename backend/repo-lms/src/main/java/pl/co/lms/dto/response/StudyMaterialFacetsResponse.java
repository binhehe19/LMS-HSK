package pl.co.lms.dto.response;

import java.util.List;

public record StudyMaterialFacetsResponse(
        List<String> topics, List<String> bands, List<String> sources, List<String> skills
) {}
