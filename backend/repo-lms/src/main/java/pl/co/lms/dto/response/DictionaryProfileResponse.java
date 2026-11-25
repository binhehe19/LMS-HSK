package pl.co.lms.dto.response;

import java.util.List;
import java.util.Map;

public record DictionaryProfileResponse(List<String> recent, int goal, List<Activity> activity, Map<String,String> reminders) {
    public record Activity(String id, String at) {}
    public static DictionaryProfileResponse empty() {
        return new DictionaryProfileResponse(List.of(), 30, List.of(), Map.of());
    }
}
