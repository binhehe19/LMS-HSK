package pl.co.lms.dto.request;

import jakarta.validation.constraints.*;

public record UpdateStudyMaterialStateRequest(
        Boolean saved, @Size(max = 300) String note
) {}
