package pl.co.lms.dto.response;

import java.util.List;

public record StudyMaterialVocabularyPackageResponse(String packageId, String packageVersionId, String title, List<Unit> units) {
    public record Unit(int sessionNo) {}
}
