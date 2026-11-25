package pl.co.lms.dto.response;

import pl.co.lms.dto.request.DictionarySessionData;

public record DictionarySessionResponse(String lessonId, boolean review, Long revision, DictionarySessionData session) {}
