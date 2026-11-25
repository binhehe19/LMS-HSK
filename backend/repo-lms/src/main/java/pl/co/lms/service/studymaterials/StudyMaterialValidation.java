package pl.co.lms.service.studymaterials;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import pl.co.lms.entity.StudyMaterialCategory;
import pl.co.lms.entity.json.SlideMaterialContent;
import pl.co.lms.entity.json.StudyMaterialContent;
import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Shared by dedicated authoring endpoints and all existing generic resource write paths. */
public final class StudyMaterialValidation {
    private StudyMaterialValidation() {}
    public static void validate(StudyMaterialContent content) {
        require(content != null && content.getCategory() != null, "Loại học liệu là bắt buộc");
        required(content.getTitle(), 300, "Tiêu đề");
        optional(content.getSubtitle(), 500, "Tiêu đề phụ");
        optional(content.getDescription(), 5000, "Mô tả");
        optional(content.getTopic(), 100, "Chủ đề");
        optional(content.getBand(), 40, "Trình độ");
        optional(content.getSource(), 200, "Nguồn");
        if (content.getVocabularyUnit() != null) {
            required(content.getVocabularyUnit().packageVersionId(), 26, "Mã phiên bản gói từ vựng");
            require(content.getVocabularyUnit().sessionNo() > 0 && content.getVocabularyUnit().sessionNo() <= 10000, "Unit từ vựng không hợp lệ");
            require(content.getCategory() == StudyMaterialCategory.DIGLOT, "Chỉ Diglot sử dụng Unit từ vựng");
        }
        require(blank(content.getCefrLevel()) || Set.of("A1", "A2", "B1", "B2", "C1", "C2").contains(content.getCefrLevel()), "CEFR không hợp lệ");
        require(content.getPageCount() == null || content.getPageCount() > 0 && content.getPageCount() <= 10000, "Số trang phải nằm trong 1–10000");
        require(Set.of("free", "pro").contains(content.getTier() == null ? "" : content.getTier()), "Gói học liệu phải là free hoặc pro");
        require(Set.of("Reading", "Listening", "Writing", "Speaking").contains(content.getSkill() == null ? "" : content.getSkill()), "Kỹ năng không hợp lệ");
        require(content.getMinutes() == null || content.getMinutes() > 0 && content.getMinutes() <= 1440, "Thời gian đọc không hợp lệ");
        require(content.getPart() == null || Set.of("1", "2", "3", "full").contains(content.getPart()), "Part không hợp lệ");
        url(content.getImageUrl(), "Ảnh bìa");
        var paragraphs = list(content.getParagraphs());
        require(paragraphs.size() <= 500, "Tối đa 500 đoạn văn");
        int length = 0;
        for (var paragraph : paragraphs) {
            require(paragraph != null, "Đoạn văn không được trống");
            optional(paragraph.en(), 20000, "Đoạn tiếng Anh");
            optional(paragraph.vi(), 20000, "Đoạn tiếng Việt");
            require(!blank(paragraph.en()) || !blank(paragraph.vi()), "Đoạn văn phải có nội dung");
            length += size(paragraph.en()) + size(paragraph.vi());
        }
        require(length <= 200000, "Nội dung bài đọc tối đa 200000 ký tự");
        if (content.getCategory() == StudyMaterialCategory.BILINGUAL || content.getCategory() == StudyMaterialCategory.DIGLOT)
            require(!paragraphs.isEmpty(), "Bài đọc phải có ít nhất một đoạn văn");
        require(list(content.getSections()).size() <= 200, "Tối đa 200 mục tài liệu");
        for (var section : list(content.getSections())) {
            require(section != null, "Mục tài liệu không được trống");
            required(section.title(), 300, "Tên mục"); optional(section.text(), 20000, "Nội dung mục");
            require(section.page() == null || section.page() >= 1 && content.getPageCount() != null && section.page() <= content.getPageCount(), "Trang mục lục không hợp lệ");
        }
        if (content.getCategory() == StudyMaterialCategory.DOCUMENT) {
            file(content.getFile());
            require(content.getPageCount() != null && content.getPageCount() > 0 && content.getPageCount() <= 10000, "Số trang phải nằm trong 1–10000");
        }
        if (content.getCategory() == StudyMaterialCategory.VIDEO) {
            require(content.getVideo() != null || !blank(content.getVideoUrl()), "Video phải có tệp hoặc URL");
            if (content.getVideo() != null) file(content.getVideo());
            url(content.getVideoUrl(), "Video");
            require(content.getDurationSeconds() != null && content.getDurationSeconds() > 0 && content.getDurationSeconds() <= 86400, "Thời lượng video không hợp lệ");
        }
        require(list(content.getChapters()).size() <= 200, "Tối đa 200 mốc video");
        int previous = -1;
        for (var chapter : list(content.getChapters())) {
            require(chapter != null, "Mốc video không được trống"); required(chapter.title(), 300, "Tên mốc video");
            require(chapter.seconds() > previous && chapter.seconds() >= 0 && content.getDurationSeconds() != null && chapter.seconds() < content.getDurationSeconds(), "Mốc video phải tăng dần và nằm trong thời lượng");
            previous = chapter.seconds();
        }
        require(list(content.getVocabularyLinks()).size() <= 500, "Tối đa 500 từ vựng liên kết");
        var ids = new HashSet<String>();
        for (var link : list(content.getVocabularyLinks())) {
            require(link != null, "Liên kết từ vựng không được trống"); required(link.resourceId(), 26, "Mã từ");
            require(ids.add(link.resourceId()), "Mỗi từ chỉ được liên kết một lần");
            require(list(link.variants()).size() <= 30, "Tối đa 30 biến thể mỗi từ");
            for (var variant : list(link.variants())) required(variant, 200, "Biến thể từ");
        }
    }
    private static void file(SlideMaterialContent file) {
        require(file != null, "Tệp học liệu là bắt buộc"); required(file.getFileId(), 128, "Mã tệp");
        required(file.getFileName(), 500, "Tên tệp"); optional(file.getMimeType(), 200, "Định dạng tệp");
        require(file.getSizeBytes() == null || file.getSizeBytes() >= 0, "Dung lượng tệp không hợp lệ");
    }
    private static void url(String value, String label) {
        if (blank(value)) return;
        require(value.length() <= 2000 && !value.contains("\\"), label + " không hợp lệ");
        try {
            URI uri = URI.create(value);
            require(value.startsWith("/") && !value.startsWith("//") || "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null, label + " phải là đường dẫn nội bộ hoặc HTTPS");
        } catch (IllegalArgumentException e) { throw new ApiException(ErrorCode.E200, label + " không hợp lệ"); }
    }
    public static void require(boolean condition, String message) { if (!condition) throw new ApiException(ErrorCode.E200, message); }
    private static void required(String value, int max, String label) { require(!blank(value), label + " là bắt buộc"); optional(value, max, label); }
    private static void optional(String value, int max, String label) { require(value == null || value.length() <= max, label + " quá dài"); }
    private static boolean blank(String value) { return value == null || value.isBlank(); }
    private static int size(String value) { return value == null ? 0 : value.length(); }
    public static <T> List<T> list(List<T> values) { return values == null ? List.of() : values; }
}
