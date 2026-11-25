package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.request.DictionarySessionData;
import pl.co.lms.dto.request.DictionarySessionData.Answer;
import pl.co.lms.dto.request.DictionarySkipTestRequest;
import pl.co.lms.dto.request.SaveDictionarySessionRequest;
import pl.co.lms.dto.request.UpdateVocabularyStateRequest;
import pl.co.lms.dto.response.*;
import pl.co.lms.entity.*;
import pl.co.lms.entity.json.VocabularyEnContent;
import pl.co.lms.repository.*;

import java.text.Normalizer;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.UnaryOperator;
import java.util.regex.Pattern;

@Service @RequiredArgsConstructor @Transactional
public class DictionaryService {
    private final LearningResourceService resources;
    private final LearningResourceStateService states;
    private final LearningResourceRepository resourceRepository;
    private final DictionaryProfileRepository profiles;
    private final DictionarySessionRepository sessions;
    private final ObjectMapper mapper;

    private DictionaryProgression progression() { return new DictionaryProgression(resources,sessions,mapper); }
    @Transactional(readOnly = true)
    public List<DictionaryLessonResponse> roadmap(String user, String level, String topic) {
        requireUser(user); return progression().roadmap(user,level,topic);
    }

    private <T> T read(String value, Class<T> type) {
        try { return mapper.readValue(value, type); }
        catch (Exception e) { throw new ApiException(ErrorCode.E280, "Không đọc được tiến độ từ điển"); }
    }
    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception e) { throw new ApiException(ErrorCode.E280, "Không lưu được tiến độ từ điển"); }
    }
    private static void requireUser(String user) {
        if (user == null || user.isBlank()) throw new ApiException(ErrorCode.UNAUTHORIZED);
    }
    // Existing rows are locked so simultaneous goal/recent/reminder/session writes merge.
    // The unique user constraint protects the first concurrent creation as well.
    private DictionaryProfile lockedProfile(String user) {
        requireUser(user);
        return profiles.findForUpdate(user).orElseGet(() -> {
            var profile = new DictionaryProfile(); profile.setUserId(user);
            profile.setContent(json(DictionaryProfileResponse.empty()));
            return profiles.saveAndFlush(profile);
        });
    }
    private DictionaryProfileResponse profile(DictionaryProfile row) {
        return read(row.getContent(), DictionaryProfileResponse.class);
    }
    private DictionaryProfileResponse writeProfile(DictionaryProfile row, UnaryOperator<DictionaryProfileResponse> change) {
        var value = change.apply(profile(row));
        row.setContent(json(value)); profiles.save(row); return value;
    }
    @Transactional(readOnly = true)
    public DictionaryProfileResponse getProfile(String user) {
        requireUser(user);
        var value = profiles.findByUserIdAndDeletedFalse(user).map(this::profile).orElseGet(DictionaryProfileResponse::empty);
        Set<String> neededIds = new HashSet<>(value.recent());
        neededIds.addAll(value.reminders().keySet());
        value.activity().forEach(a -> neededIds.add(a.id()));
        Set<String> available = neededIds.isEmpty() ? Set.of() : resourceRepository.findExistingPublishedVocabularyIds(neededIds);
        var reminders = new LinkedHashMap<String,String>();
        value.reminders().forEach((id, date) -> { if (available.contains(id)) reminders.put(id,date); });
        return new DictionaryProfileResponse(value.recent().stream().filter(available::contains).toList(), value.goal(),
                value.activity().stream().filter(a -> available.contains(a.id())).toList(), reminders);
    }
    public DictionaryProfileResponse setGoal(String user, int goal) {
        if (goal < 1 || goal > 1000) throw new ApiException(ErrorCode.E200, "Mục tiêu từ 1 đến 1000 từ mỗi tuần");
        return writeProfile(lockedProfile(user), p -> new DictionaryProfileResponse(p.recent(),goal,p.activity(),p.reminders()));
    }
    public DictionaryProfileResponse remember(String user, String id) {
        resources.getDictionaryWord(id);
        return writeProfile(lockedProfile(user), p -> {
            var recent = new ArrayList<String>(); recent.add(id);
            p.recent().stream().filter(item -> !item.equals(id)).limit(7).forEach(recent::add);
            return new DictionaryProfileResponse(recent,p.goal(),p.activity(),p.reminders());
        });
    }
    public DictionaryProfileResponse remind(String user, String id, Instant at) {
        resources.getDictionaryWord(id);
        if (at == null || at.isBefore(Instant.now()) || at.isAfter(Instant.now().plus(366, ChronoUnit.DAYS)))
            throw new ApiException(ErrorCode.E200, "Lịch ôn phải nằm trong 366 ngày tới");
        return writeProfile(lockedProfile(user), p -> {
            var reminders = new LinkedHashMap<>(p.reminders());
            if (!reminders.containsKey(id) && reminders.size() >= 2000) throw new ApiException(ErrorCode.E200,"Lịch ôn đã đầy");
            reminders.put(id,at.toString());
            return new DictionaryProfileResponse(p.recent(),p.goal(),p.activity(),reminders);
        });
    }
    private void recordActivity(DictionaryProfile row, String id) {
        var now = Instant.now(); var cutoff = now.minus(90, ChronoUnit.DAYS);
        writeProfile(row, p -> {
            var activity = new ArrayList<>(p.activity().stream().filter(a -> Instant.parse(a.at()).isAfter(cutoff))
                    .filter(a -> !a.id().equals(id) || !Instant.parse(a.at()).truncatedTo(ChronoUnit.HOURS).equals(now.truncatedTo(ChronoUnit.HOURS)))
                    .toList());
            activity.add(new DictionaryProfileResponse.Activity(id,now.toString()));
            if (activity.size() > 10000) activity = new ArrayList<>(activity.subList(activity.size()-10000,activity.size()));
            var reminders = new LinkedHashMap<>(p.reminders()); reminders.remove(id);
            return new DictionaryProfileResponse(p.recent(),p.goal(),activity,reminders);
        });
    }
    public LearningResourceStateResponse updateWord(String user, String id, UpdateVocabularyStateRequest patch) {
        resources.getDictionaryWord(id);
        if (patch.note() != null && patch.note().length() > 10000) throw new ApiException(ErrorCode.E200,"Ghi chú tối đa 10000 ký tự");
        var profile = lockedProfile(user);
        var state = states.updateVocabularyState(user,id,patch.saved(),patch.note(),patch.comprehensionLevel());
        if (patch.comprehensionLevel() != null && patch.comprehensionLevel() != VocabularyComprehensionLevel.UNKNOWN) {
            recordActivity(profile,id);
        }
        return LearningResourceStateResponse.from(state);
    }
    public LearningResourceStateResponse startWord(String user, String id) {
        resources.getDictionaryWord(id);
        lockedProfile(user);
        return LearningResourceStateResponse.from(states.startVocabularyLearning(user,id));
    }
    /** Reconcile legacy in-progress lessons whose word states used to be written only at completion. */
    public void syncLearningProgress(String user) {
        lockedProfile(user);
        for (int page = 0; ; page++) {
            var rows = sessions.findByUserIdAndDeletedFalseOrderByUpdatedAtDesc(user, PageRequest.of(page,100));
            for (var row : rows) {
                var data = response(row).session();
                if (data == null || data.completed() || data.stage() == 0) continue;
                for (String id : data.ids()) {
                    if (!data.known().contains(id) && (data.practiceIds() == null || data.practiceIds().contains(id)))
                        states.startVocabularyLearning(user,id);
                }
            }
            if (rows.size() < 100) break;
        }
        states.scheduleMissingVocabularyReviews(user);
    }
    private Map<String,LearningResourceResponse> sources(List<String> ids) {
        var values = new LinkedHashMap<String,LearningResourceResponse>();
        for (String id : ids) values.put(id,resources.getDictionaryWord(id));
        return values;
    }
    private String sourceVersions(Map<String,LearningResourceResponse> sources) {
        var versions = new TreeMap<String,String>(); sources.forEach((id,word) -> versions.put(id,word.publishedVersionId()));
        return json(versions);
    }
    private DictionarySessionResponse response(DictionarySession row) {
        var data = read(row.getContent(),DictionarySessionData.class);
        // Không dùng sources()/getDictionaryWord ở đây: từ đã bị xoá làm getDictionaryWord ném lỗi qua ranh giới giao dịch, đánh dấu giao dịch
        // chỉ-đọc bên ngoài là rollback-only và cả danh sách phiên trả 500. Dò theo lô, thiếu từ nào thì phiên coi như không còn hợp lệ.
        var wanted = new LinkedHashSet<>(data.ids());
        var found = resources.getDictionaryWordsByIds(List.copyOf(wanted));
        var versions = new TreeMap<String,String>();
        found.forEach(word -> versions.put(word.id(),word.publishedVersionId()));
        if (found.size() != wanted.size() || !row.getSourceVersions().equals(json(versions))) data = null;
        return new DictionarySessionResponse(row.getLessonId(),row.isReview(),row.getRevision(),data);
    }
    @Transactional(readOnly = true)
    public DictionarySessionResponse getSession(String user, String lessonId, boolean review) {
        return getSession(user,lessonId,review,null,null);
    }
    @Transactional(readOnly = true)
    public DictionarySessionResponse getSession(String user, String lessonId, boolean review, String level, String topic) {
        requireUser(user);
        progression().requireAccess(user,lessonId,level,topic);
        return sessions.findByUserIdAndLessonIdAndReviewAndDeletedFalse(user,lessonId,review).map(this::response)
                .orElseGet(() -> new DictionarySessionResponse(lessonId,review,null,null));
    }
    @Transactional(readOnly = true)
    public List<DictionarySessionResponse> completedSessions(String user) {
        requireUser(user);
        return sessions.findByUserIdAndCompletedTrueAndDeletedFalseOrderByUpdatedAtDesc(user,PageRequest.of(0,100))
                .stream().map(this::response).filter(s -> s.session() != null).toList();
    }
    @Transactional(readOnly = true)
    public List<DictionarySessionResponse> recentSessions(String user) {
        requireUser(user);
        return sessions.findByUserIdAndDeletedFalseOrderByUpdatedAtDesc(user,PageRequest.of(0,100))
                .stream().map(this::response).filter(s -> s.session() != null).toList();
    }
    public DictionarySessionResponse saveSession(String user, String lessonId, boolean review, SaveDictionarySessionRequest request) {
        return saveSession(user,lessonId,review,request,null,null);
    }
    public DictionarySessionResponse saveSession(String user, String lessonId, boolean review, SaveDictionarySessionRequest request, String level, String topic) {
        var profile = lockedProfile(user);
        var lesson = progression().requireAccess(user,lessonId,level,topic);
        var data = request.session();
        if (!lesson.wordIds().equals(data.ids())) throw new ApiException(ErrorCode.E200,"Danh sách từ không khớp bài học trong lộ trình");
        if (new HashSet<>(data.ids()).size() != data.ids().size() || !lessonId.equals(data.ids().getFirst()) || data.index() >= data.ids().size())
            throw new ApiException(ErrorCode.E200,"Danh sách từ hoặc vị trí bài học không hợp lệ");
        if (!data.ids().containsAll(data.known()) || (data.practiceIds() != null && !data.ids().containsAll(data.practiceIds())))
            throw new ApiException(ErrorCode.E200,"Từ không thuộc bài học");
        var words = sources(data.ids());
        if (words.values().stream().map(w -> Optional.ofNullable(((VocabularyEnContent) w.content()).getTopic()).orElse("").trim()).distinct().count() > 1)
            throw new ApiException(ErrorCode.E200,"Các từ phải thuộc cùng chủ đề");
        var row = sessions.findForUpdate(user,lessonId,review).orElse(null);
        if (row != null && !Objects.equals(row.getRevision(),request.revision()) || row == null && request.revision() != null)
            throw new ApiException(ErrorCode.CONFLICT,"Bài học đã thay đổi trên thiết bị khác. Tải lại để học tiếp.");
        var stored = row == null || !row.getSourceVersions().equals(sourceVersions(words)) ? null : read(row.getContent(),DictionarySessionData.class);
        var previous = request.reset() ? null : stored;
        if (previous != null && (!previous.ids().equals(data.ids()) || !previous.startedAt().equals(data.startedAt())))
            throw new ApiException(ErrorCode.CONFLICT,"Cần bắt đầu lượt học mới trước khi thay đổi bài học");
        if (row == null) { row = new DictionarySession(); row.setUserId(user); row.setLessonId(lessonId); row.setReview(review); }
        try { Instant.parse(data.startedAt()); }
        catch (Exception e) { throw new ApiException(ErrorCode.E200,"Thời điểm bắt đầu không hợp lệ"); }
        var probe = grade(data.probe(),previous == null ? Map.of() : previous.probe(),words,"probe");
        var assemble = grade(data.assemble(),previous == null ? Map.of() : previous.assemble(),words,"assemble");
        var communicate = grade(data.communicate(),previous == null ? Map.of() : previous.communicate(),words,"communicate");
        if (data.completed() && data.stage() != 4) throw new ApiException(ErrorCode.E200,"Chỉ hoàn thành ở bước xem lại kết quả");
        String completedAt = data.completed() ? (previous != null && previous.completed() ? previous.completedAt() : Instant.now().toString()) : null;
        var verifiedKnown = data.known().stream().distinct().filter(id -> correct(probe.get(id)) ||
                states.getState(user,id).map(s -> s.getComprehensionLevel() == VocabularyComprehensionLevel.KNOWN ||
                        s.getComprehensionLevel() == null && s.getStatus() == FlashcardStatus.LEARNED).orElse(false)).toList();
        var pass = stored == null ? null : stored.lessonPass();
        if (pass == null && stored != null && stored.completed() && DictionaryProgression.attempted(stored))
            pass = new DictionarySessionData.LessonPass("study",0,0,stored.completedAt());
        var result = new DictionarySessionData(1,data.ids(),data.content(),data.stage(),data.index(),verifiedKnown,
                probe,assemble,communicate,data.completed(),data.startedAt(),data.practiceIds(),completedAt,pass);
        if (!review && result.completed() && DictionaryProgression.attempted(result) && pass == null)
            result = new DictionarySessionData(1,result.ids(),result.content(),4,result.index(),result.known(),probe,assemble,communicate,
                    true,result.startedAt(),result.practiceIds(),completedAt,new DictionarySessionData.LessonPass("study",0,0,completedAt));
        if (result.stage() > 0 && !result.completed()) {
            for (String id : result.ids()) {
                if (!result.known().contains(id) && (result.practiceIds() == null || result.practiceIds().contains(id)))
                    states.startVocabularyLearning(user, id);
            }
        }
        if (result.completed() && (previous == null || !previous.completed())) {
            for (String id : result.ids()) {
                if (result.practiceIds() != null && !result.practiceIds().contains(id)) continue;
                boolean known = result.known().contains(id) || correct(probe.get(id)) && correct(assemble.get(id)) && correct(communicate.get(id));
                states.updateVocabularyState(user,id,true,null,known ? VocabularyComprehensionLevel.KNOWN : VocabularyComprehensionLevel.LEARNING);
                recordActivity(profile,id);
            }
        }
        row.setCompleted(result.completed()); row.setContent(json(result)); row.setSourceVersions(sourceVersions(words));
        sessions.saveAndFlush(row);
        return new DictionarySessionResponse(lessonId,review,row.getRevision(),result);
    }
    public record SkipTestResult(int correct, int total, int mistakes, double percentage, boolean passed) {}
    public static SkipTestResult skipTestScore(int correct, int total) {
        if (total < 1 || correct < 0 || correct > total) throw new ApiException(ErrorCode.E200,"Điểm kiểm tra không hợp lệ");
        int mistakes=total-correct;
        return new SkipTestResult(correct,total,mistakes,100.0*correct/total,correct*100L >= total*80L && mistakes <= 5);
    }
    public SkipTestResult submitSkipTest(String user, String lessonId, String level, String topic, DictionarySkipTestRequest request) {
        var profile=lockedProfile(user);
        var lesson=progression().requireAccess(user,lessonId,level,topic);
        if (!lesson.versions().equals(request.versions())) throw new ApiException(ErrorCode.CONFLICT,"Nội dung bài đã thay đổi. Hãy tải lại bài kiểm tra.");
        var words=sources(lesson.wordIds());
        var expected=new HashSet<String>();
        for (int i=0;i<lesson.wordIds().size();i++) expected.add((i%2 == 0 ? "probe:" : "assemble:")+lesson.wordIds().get(i));
        if (!expected.containsAll(request.answers().keySet())) throw new ApiException(ErrorCode.E200,"Câu trả lời không thuộc bài kiểm tra");
        int correct=0;
        for (int i=0;i<lesson.wordIds().size();i++) {
            String id=lesson.wordIds().get(i);
            var word=(VocabularyEnContent)words.get(id).content();
            if (i%2 == 0) { if (matchesMeaning(word,request.answers().getOrDefault("probe:"+id,""))) correct++; }
            else {
                String answer=key(request.answers().getOrDefault("assemble:"+id,""));
                if (!answer.isBlank() && key(word.getWord()).equals(answer)) correct++;
            }
        }
        var score=skipTestScore(correct,expected.size());
        if (score.passed() && !lesson.completed()) {
            var row=sessions.findForUpdate(user,lessonId,false).orElse(null);
            if (row == null) { row=new DictionarySession(); row.setUserId(user); row.setLessonId(lessonId); row.setReview(false); }
            var now=Instant.now().toString();
            var result=new DictionarySessionData(1,lesson.wordIds(),"skip-test",4,0,List.of(),Map.of(),Map.of(),Map.of(),true,now,null,now,
                    new DictionarySessionData.LessonPass("test",score.correct(),score.total(),now));
            row.setContent(json(result)); row.setCompleted(true); row.setSourceVersions(sourceVersions(words)); sessions.saveAndFlush(row);
            for (String id : lesson.wordIds()) recordActivity(profile,id);
        }
        return score;
    }
    private static boolean correct(Answer answer) { return answer != null && answer.correct() && !answer.skipped(); }
    private Map<String,Answer> grade(Map<String,Answer> incoming, Map<String,Answer> previous,
                                    Map<String,LearningResourceResponse> words, String stage) {
        var result = new LinkedHashMap<String,Answer>(previous);
        incoming.forEach((id,answer) -> {
            if (!words.containsKey(id)) throw new ApiException(ErrorCode.E200,"Câu trả lời không thuộc bài học");
            var word = (VocabularyEnContent) words.get(id).content();
            boolean valid = !answer.skipped() && switch(stage) {
                case "probe" -> matchesMeaning(word,answer.text());
                case "assemble" -> !key(answer.text()).isEmpty() && key(word.getWord()).equals(key(answer.text()));
                default -> usesWord(word.getWord(),answer.text());
            };
            result.put(id,new Answer(answer.text(),valid,answer.skipped(),previous.containsKey(id) ? previous.get(id).firstCorrect() : valid));
        });
        return result;
    }
    private static String key(String text) {
        return Normalizer.normalize(text == null ? "" : text.trim().toLowerCase(Locale.ROOT),Normalizer.Form.NFD)
                .replaceAll("\\p{M}","").replace('đ','d').replaceAll("[.,!?\"“”'’()]", "").replaceAll("\\s+"," ").trim();
    }
    public static boolean matchesMeaning(VocabularyEnContent word, String answer) {
        var meanings = new ArrayList<String>();
        meanings.add(word.getCommonMeaning());
        if (word.getDefinitions() != null) word.getDefinitions().stream().filter(Objects::nonNull)
                .map(d -> d.getMeaningVi() == null || d.getMeaningVi().isBlank() ? d.getDefinitionEn() : d.getMeaningVi())
                .forEach(meanings::add);
        return VocabularyMeaningMatcher.matches(meanings, answer);
    }
    public static boolean usesWord(String word, String answer) {
        return word != null && !word.isBlank() && answer != null
                && Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(word) + "(?![\\p{L}\\p{N}])",Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(answer).find()
                && answer.trim().split("\\s+").length > word.trim().split("\\s+").length;
    }
}
