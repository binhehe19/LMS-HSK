package pl.co.lms.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum StudyMaterialCategory {
    BILINGUAL("song-ngu"), DOCUMENT("tai-lieu"), DIGLOT("diglot"), VIDEO("video");

    private final String path;
    StudyMaterialCategory(String path) { this.path = path; }
    @JsonValue public String path() { return path; }
    @JsonCreator public static StudyMaterialCategory parse(String value) {
        if (value != null) for (var category : values()) {
            if (category.path.equalsIgnoreCase(value) || category.name().equalsIgnoreCase(value)) return category;
        }
        throw new IllegalArgumentException("Loại học liệu không hợp lệ");
    }
}
