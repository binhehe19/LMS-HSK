package pl.co.lms.dto.response;

// Nội dung học tập (không phải điểm danh/cá nhân) của 1 buổi học, resolve từ
// content_package_syllabus_mappings + ContentPackageVersionResource theo (syllabusId, sessionNo).
// Dùng cho các tab Slide/Tài liệu/Ngữ pháp/Từ vựng/Quick Test ở màn /classes/session - xem
// SyllabusPackageService#getSessionResources.
//
// 3 nhóm bài tập tách theo LOẠI PACKAGE chứa chúng: quiz = Quick Test tổng hợp (package QUIZ và
// các loại còn lại), grammarQuiz = bài tập gắn vào package ngữ pháp, vocabularyQuiz = bài tập gắn
// vào package từ vựng.
public record SyllabusSessionResourcesResponse(
        SessionResourceGroupResponse slide,
        SessionResourceGroupResponse material,
        SessionResourceGroupResponse grammar,
        SessionResourceGroupResponse vocabulary,
        SessionResourceGroupResponse quiz,
        SessionResourceGroupResponse grammarQuiz,
        SessionResourceGroupResponse vocabularyQuiz
) {
    public static final SyllabusSessionResourcesResponse EMPTY = new SyllabusSessionResourcesResponse(
            SessionResourceGroupResponse.EMPTY,
            SessionResourceGroupResponse.EMPTY,
            SessionResourceGroupResponse.EMPTY,
            SessionResourceGroupResponse.EMPTY,
            SessionResourceGroupResponse.EMPTY,
            SessionResourceGroupResponse.EMPTY,
            SessionResourceGroupResponse.EMPTY);
}
