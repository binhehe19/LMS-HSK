package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsSyllabusFilterOptions;

import java.util.List;

public record SyllabusFilterOptionsResponse(List<Level> educationLevels, List<String> types) {
    public record Level(String id, String code, String name) {}

    public static SyllabusFilterOptionsResponse from(CmsSyllabusFilterOptions o) {
        List<Level> levels = o.getEducationLevels() == null ? List.of()
                : o.getEducationLevels().stream().map(l -> new Level(l.getId(), l.getCode(), l.getName())).toList();
        return new SyllabusFilterOptionsResponse(levels, o.getTypes() == null ? List.of() : o.getTypes());
    }
}
