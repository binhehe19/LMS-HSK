package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsPracticeModule;

public record PracticeModuleResponse(
        String moduleType,
        String moduleContent
) {
    public static PracticeModuleResponse from(CmsPracticeModule m) {
        return new PracticeModuleResponse(m.getModuleType(), m.getModuleContent());
    }
}
