package pl.co.lms.dto.response;

import java.util.List;
import java.util.Map;

/** terms: the words of the lesson in order, so the roadmap can be drawn without loading every entry. */
public record DictionaryLessonResponse(String id, int number, String title, List<String> wordIds, List<String> terms,
        Map<String,String> versions, boolean completed, boolean unlocked, String method) {}
