package pl.co.lms.service.progress;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import pl.co.lms.dto.response.SessionResourceGroupResponse;
import pl.co.lms.dto.response.SyllabusSessionResourcesResponse;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.service.SyllabusPackageService;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// Danh sách bài và từ của một buổi, cache trong bộ nhớ theo (syllabusId, sessionNo). Lý do cache: dựng danh sách phải
// gọi getSessionResources (nạp và phân tích nội dung mọi resource của buổi), trong khi kết quả giống nhau cho mọi học sinh
// cùng giáo trình và version PUBLISHED bất biến. TTL ngắn (mặc định 5 phút) để việc gắn thêm/gỡ package vào giáo trình
// có hiệu lực sớm. Cache theo từng instance, không cần đồng bộ giữa các instance.
@Component
@RequiredArgsConstructor
public class SessionUnitsProvider {

    private static final int MAX_ENTRIES = 5000;

    private record Entry(SessionUnits units, long expiresAtMillis) {}

    private final SyllabusPackageService mappingService;
    private final ConcurrentHashMap<String, Entry> cache = new ConcurrentHashMap<>();

    @Value("${homework.progress.units-cache-seconds:300}")
    private long ttlSeconds;

    public SessionUnits get(String syllabusId, int sessionNo) {
        String key = syllabusId + ":" + sessionNo;
        long now = System.currentTimeMillis();
        Entry cached = cache.get(key);
        if (cached != null && cached.expiresAtMillis() > now) {
            return cached.units();
        }
        SessionUnits units = load(syllabusId, sessionNo);
        if (cache.size() >= MAX_ENTRIES) {
            cache.clear();
        }
        cache.put(key, new Entry(units, now + ttlSeconds * 1000));
        return units;
    }

    private SessionUnits load(String syllabusId, int sessionNo) {
        SyllabusSessionResourcesResponse r = mappingService.getSessionResources(syllabusId, sessionNo);
        return new SessionUnits(
                unitResourceIds(r.grammarQuiz()),
                unitResourceIds(r.vocabularyQuiz()),
                unitResourceIds(r.quiz()),
                wordResourceIds(r.vocabulary()));
    }

    // Mỗi resource QUIZ gắn vào buổi là 1 bài; khoá bài là learningResourceId (nhiều bài có thể nằm cùng 1 học phần).
    private List<String> unitResourceIds(SessionResourceGroupResponse group) {
        Set<String> ids = new LinkedHashSet<>();
        group.freeResources().forEach(res -> ids.add(res.learningResourceId()));
        return List.copyOf(ids);
    }

    private List<String> wordResourceIds(SessionResourceGroupResponse group) {
        Set<String> ids = new LinkedHashSet<>();
        group.freeResources().stream()
                .filter(res -> res.resourceType() == LearningResourceType.VOCABULARY)
                .forEach(res -> ids.add(res.learningResourceId()));
        return List.copyOf(ids);
    }
}
