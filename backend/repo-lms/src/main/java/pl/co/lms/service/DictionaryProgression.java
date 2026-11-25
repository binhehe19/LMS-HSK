package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import pl.co.lms.dto.request.DictionarySessionData;
import pl.co.lms.dto.response.*;
import pl.co.lms.repository.DictionaryRoadmapWord;
import pl.co.lms.repository.DictionarySessionRepository;
import java.util.*;

/** One authoritative ordered roadmap for both navigation and writes. */
final class DictionaryProgression {
    private final LearningResourceService resources;
    private final DictionarySessionRepository sessions;
    private final ObjectMapper mapper;
    DictionaryProgression(LearningResourceService resources,
            DictionarySessionRepository sessions, ObjectMapper mapper) {
        this.resources=resources; this.sessions=sessions; this.mapper=mapper;
    }
    List<DictionaryLessonResponse> roadmap(String user, String level, String topic) {
        // Words come ordered like the /dictionary list (search_title, id); each topic is split on its own, five words a lesson.
        var groups = new LinkedHashMap<String,List<DictionaryRoadmapWord>>();
        for (var w : resources.dictionaryRoadmapWords()) {
            if (text(w.title()).isEmpty() || !inScope(w,level,topic)) continue;
            groups.computeIfAbsent(text(w.topic()), k -> new ArrayList<>()).add(w);
        }
        var chunks = new ArrayList<List<DictionaryRoadmapWord>>();
        for (var group : groups.values()) for (int offset=0; offset<group.size(); offset+=5) chunks.add(group.subList(offset,Math.min(offset+5,group.size())));
        var saved=new HashMap<String,pl.co.lms.entity.DictionarySession>();
        // shortcut: one IN list with a lesson per five words; PostgreSQL allows 32,767 bind parameters, so batch this beyond ~150,000 words.
        if (!chunks.isEmpty()) sessions.findByUserIdAndReviewFalseAndDeletedFalseAndLessonIdIn(user,chunks.stream().map(c -> c.getFirst().id()).toList())
                .forEach(s -> saved.put(s.getLessonId(),s));
        var result = new ArrayList<DictionaryLessonResponse>();
        boolean unlocked = true;
        for (var words : chunks) {
            var ids=words.stream().map(DictionaryRoadmapWord::id).toList();
            var versions=new TreeMap<String,String>(); words.forEach(w -> versions.put(w.id(),w.versionId()));
            var row=saved.get(ids.getFirst());
            DictionarySessionData data=null;
            try {
                if (row != null && mapper.readTree(row.getSourceVersions()).equals(mapper.valueToTree(versions))) {
                    var candidate=mapper.readValue(row.getContent(),DictionarySessionData.class);
                    if (candidate.ids().equals(ids)) data=candidate;
                }
            } catch (Exception e) { throw new ApiException(ErrorCode.E280,"Không đọc được lộ trình học"); }
            boolean done=data != null && (data.lessonPass() != null || data.completed() && attempted(data));
            String title=text(words.getFirst().topic());
            result.add(new DictionaryLessonResponse(ids.getFirst(),result.size()+1,title.isBlank() ? "Khám phá từ vựng" : title,
                    ids,words.stream().map(w -> w.wordKey() != null ? w.wordKey() : w.title()).toList(),versions,done,unlocked,done ? data.lessonPass() == null ? "study" : data.lessonPass().method() : null));
            unlocked &= done;
        }
        return result;
    }
    /** Same rules as the dictionary scope: the level is stored upper-cased, a blank level or topic counts as "Chưa phân loại"; the topic matches exactly. */
    private static boolean inScope(DictionaryRoadmapWord w, String level, String topic) {
        String cefr=text(w.cefrLevel());
        return (level == null || level.isBlank() || level.equals(cefr) || level.equals("Chưa phân loại") && cefr.isEmpty())
                && (topic == null || topic.isBlank() || topic.equals(label(w.topic())));
    }
    DictionaryLessonResponse requireAccess(String user, String id, String level, String topic) {
        var lesson=roadmap(user,level,topic).stream().filter(l -> l.id().equals(id)).findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.E200,"Bài học không thuộc lộ trình này"));
        if (!lesson.unlocked()) throw new ApiException(ErrorCode.E200,"Hãy hoàn thành hoặc vượt qua kiểm tra nhảy cóc bài trước để mở bài này.");
        return lesson;
    }
    static boolean attempted(DictionarySessionData data) {
        return data.ids().stream().allMatch(id -> data.known().contains(id) ||
                List.of(data.probe(),data.assemble(),data.communicate()).stream().allMatch(stage -> {
                    var answer=stage.get(id); return answer != null && !answer.skipped() && !answer.text().isBlank();
                }));
    }
    private static String text(String value) { return value == null ? "" : value.trim(); }
    private static String label(String value) { return text(value).isBlank() ? "Chưa phân loại" : text(value); }
}
