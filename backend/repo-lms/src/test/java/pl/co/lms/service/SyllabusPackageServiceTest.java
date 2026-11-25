package pl.co.lms.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pl.co.lms.dto.response.ContentPackageResponse;
import pl.co.lms.dto.response.ContentPackageVersionResourceResponse;
import pl.co.lms.dto.response.ContentPackageVersionResponse;
import pl.co.lms.dto.response.SessionResourceGroupResponse;
import pl.co.lms.dto.response.SyllabusSessionResourcesResponse;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SyllabusPackageServiceTest {

    private static final String SYLLABUS = "syl-1";

    @Mock private ContentPackageRepository packageRepository;
    @Mock private ContentPackageVersionRepository versionRepository;
    @Mock private ContentPackageService packageService;
    @Mock private ContentPackageVersionResourceService resourceService;

    private SyllabusPackageService service;
    private final List<ContentPackage> packages = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new SyllabusPackageService(packageRepository, versionRepository, packageService, resourceService);
        lenient().when(packageRepository.findBySyllabusIdAndDeletedFalse(SYLLABUS)).thenReturn(packages);
    }

    // Học phần (loại `type`) của giáo trình với các resource cho buổi 1; version luôn PUBLISHED.
    private void attach(ContentPackageType type, ContentPackageVersionResourceResponse... resources) {
        String pkgId = "pkg-" + type;
        String versionId = "ver-" + type;

        ContentPackage pkg = mock(ContentPackage.class);
        lenient().when(pkg.getId()).thenReturn(pkgId);
        lenient().when(pkg.getType()).thenReturn(type);
        lenient().when(pkg.getSyllabusId()).thenReturn(SYLLABUS);
        lenient().when(pkg.getPublishedVersionId()).thenReturn(versionId);
        packages.add(pkg);

        ContentPackageVersion version = mock(ContentPackageVersion.class);
        lenient().when(version.getStatus()).thenReturn(ContentPackageVersionStatus.PUBLISHED);
        lenient().when(version.getId()).thenReturn(versionId);
        lenient().when(versionRepository.findByIdAndDeletedFalse(versionId)).thenReturn(Optional.of(version));
        lenient().when(resourceService.listResourceResponses(versionId, 1)).thenReturn(List.of(resources));
    }

    private static ContentPackageVersionResourceResponse res(ContentPackageType in, String id, LearningResourceType type) {
        return new ContentPackageVersionResourceResponse(
                "link-" + id, "ver-" + in, id, "rv-" + id, 1, 0, type, null, Instant.now());
    }

    private static List<String> ids(SessionResourceGroupResponse group) {
        return group.freeResources().stream().map(ContentPackageVersionResourceResponse::learningResourceId).toList();
    }

    // Mỗi tab của học viên chỉ lấy đúng cặp (loại học phần, loại resource); resource nằm ở cụm bị ẩn thì không hiện.
    @Test
    void getSessionResources_RoutesByPackageTypeAndResourceType() {
        attach(ContentPackageType.VOCABULARY,
                res(ContentPackageType.VOCABULARY, "word", LearningResourceType.VOCABULARY),
                res(ContentPackageType.VOCABULARY, "vocab-quiz", LearningResourceType.ASSESSMENT),
                res(ContentPackageType.VOCABULARY, "hidden-slide-in-vocab", LearningResourceType.SLIDE));
        attach(ContentPackageType.GRAMMAR,
                res(ContentPackageType.GRAMMAR, "point", LearningResourceType.GRAMMAR),
                res(ContentPackageType.GRAMMAR, "grammar-quiz", LearningResourceType.ASSESSMENT),
                res(ContentPackageType.GRAMMAR, "hidden-word-in-grammar", LearningResourceType.VOCABULARY));
        attach(ContentPackageType.ASSESSMENT,
                res(ContentPackageType.ASSESSMENT, "quick-quiz", LearningResourceType.ASSESSMENT),
                res(ContentPackageType.ASSESSMENT, "hidden-grammar-in-quiz", LearningResourceType.GRAMMAR));
        attach(ContentPackageType.SLIDE,
                res(ContentPackageType.SLIDE, "slide", LearningResourceType.SLIDE),
                res(ContentPackageType.SLIDE, "hidden-quiz-in-slide", LearningResourceType.ASSESSMENT));
        attach(ContentPackageType.MATERIAL,
                res(ContentPackageType.MATERIAL, "doc", LearningResourceType.MATERIAL),
                res(ContentPackageType.MATERIAL, "hidden-quiz-in-material", LearningResourceType.ASSESSMENT));

        SyllabusSessionResourcesResponse r = service.getSessionResources(SYLLABUS, 1);

        assertThat(ids(r.vocabulary())).containsExactly("word");
        assertThat(ids(r.vocabularyQuiz())).containsExactly("vocab-quiz");
        assertThat(ids(r.grammar())).containsExactly("point");
        assertThat(ids(r.grammarQuiz())).containsExactly("grammar-quiz");
        assertThat(ids(r.quiz())).containsExactly("quick-quiz");
        assertThat(ids(r.slide())).containsExactly("slide");
        assertThat(ids(r.material())).containsExactly("doc");
    }

    // Học phần mới tạo (chưa publish) thuộc giáo trình nhưng học sinh chưa thấy gì.
    @Test
    void getSessionResources_DraftOnlyPackageIsHiddenFromStudents() {
        ContentPackage draft = mock(ContentPackage.class);
        lenient().when(draft.getId()).thenReturn("pkg-draft");
        lenient().when(draft.getType()).thenReturn(ContentPackageType.ASSESSMENT);
        lenient().when(draft.getPublishedVersionId()).thenReturn(null);
        lenient().when(draft.getDraftVersionId()).thenReturn("ver-draft");
        packages.add(draft);

        SyllabusSessionResourcesResponse seen = service.getSessionResources(SYLLABUS, 1);

        assertThat(seen.quiz().freeResources()).isEmpty();
        assertThat(seen.vocabulary().freeResources()).isEmpty();
        assertThat(seen.slide().freeResources()).isEmpty();
    }

    // Giáo trình không có học phần nào: trả về rỗng.
    @Test
    void getSessionResources_NoPackages_ReturnsEmpty() {
        assertThat(service.getSessionResources("other-syllabus", 1)).isSameAs(SyllabusSessionResourcesResponse.EMPTY);
    }

    // Kiểm tra trước khi cho học sinh bắt đầu bài: phiên bản phải thuộc giáo trình và loại học phần mở bài tập.
    @Test
    void isQuizAssignedToSyllabus_RequiresPublishedVersionAndQuizAllowedPackageType() {
        attach(ContentPackageType.ASSESSMENT);
        attach(ContentPackageType.VOCABULARY);
        attach(ContentPackageType.SLIDE);

        assertThat(service.isQuizAssignedToSyllabus(SYLLABUS, "ver-" + ContentPackageType.ASSESSMENT)).isTrue();
        assertThat(service.isQuizAssignedToSyllabus(SYLLABUS, "ver-" + ContentPackageType.VOCABULARY)).isTrue();
        assertThat(service.isQuizAssignedToSyllabus(SYLLABUS, "ver-" + ContentPackageType.SLIDE)).isFalse();
        assertThat(service.isQuizAssignedToSyllabus(SYLLABUS, "ver-not-mapped")).isFalse();
        // Chỉ bản đang publish của học phần mới hợp lệ; bản cũ hơn bị từ chối.
        assertThat(service.isQuizAssignedToSyllabus(SYLLABUS, "ver-old")).isFalse();
        assertThat(service.isQuizAssignedToSyllabus("other-syllabus", "ver-" + ContentPackageType.ASSESSMENT)).isFalse();
    }

    // Bài tập không lộ nội dung cho học viên (chỉ lấy qua POST /assessment-attempts).
    @Test
    void getSessionResources_QuizResourcesCarryNoContent() {
        ContentPackageVersionResourceResponse quiz = new ContentPackageVersionResourceResponse(
                "link-q", "ver-QUIZ", "q", "rv-q", 1, 0, LearningResourceType.ASSESSMENT, "secret-answers", Instant.now());
        attach(ContentPackageType.ASSESSMENT, quiz);

        SyllabusSessionResourcesResponse r = service.getSessionResources(SYLLABUS, 1);

        assertThat(r.quiz().freeResources()).singleElement()
                .satisfies(item -> assertThat(item.resourceContent()).isNull());
    }

    // Tóm tắt: học phần nháp (chưa từng publish) có status DRAFT; học phần đã publish và đang sửa dở có cờ thay đổi chưa xuất bản.
    @Test
    void getSyllabusPackageSummaries_FlagsDraftAndUnpublishedChanges() {
        ContentPackage never = mock(ContentPackage.class);
        lenient().when(never.getId()).thenReturn("pkg-never");
        lenient().when(never.getSyllabusId()).thenReturn(SYLLABUS);
        ContentPackage editing = mock(ContentPackage.class);
        lenient().when(editing.getId()).thenReturn("pkg-editing");
        lenient().when(editing.getSyllabusId()).thenReturn(SYLLABUS);
        when(packageRepository.findBySyllabusIdInAndDeletedFalse(anyList())).thenReturn(List.of(never, editing));

        ContentPackageResponse neverResponse = new ContentPackageResponse(
                "pkg-never", ContentPackageType.ASSESSMENT, SYLLABUS, "sv-1", "d1", null, 0, 0,
                version("d1", ContentPackageVersionStatus.DRAFT), null, Instant.now(), Instant.now());
        ContentPackageResponse editingResponse = new ContentPackageResponse(
                "pkg-editing", ContentPackageType.ASSESSMENT, SYLLABUS, "sv-1", "d2", "p2", 0, 0,
                version("d2", ContentPackageVersionStatus.DRAFT), version("p2", ContentPackageVersionStatus.PUBLISHED),
                Instant.now(), Instant.now());
        when(packageService.listPackageResponsesByIds(anyList())).thenReturn(List.of(neverResponse, editingResponse));

        var items = service.getSyllabusPackageSummaries(List.of(SYLLABUS)).get(0).packages();

        assertThat(items).hasSize(2);
        assertThat(items.get(0).status()).isEqualTo("DRAFT");
        assertThat(items.get(0).hasUnpublishedChanges()).isFalse();
        assertThat(items.get(1).status()).isEqualTo("PUBLISHED");
        assertThat(items.get(1).hasUnpublishedChanges()).isTrue();
    }

    // Đóng dấu phiên bản mới chỉ lên các học phần còn lệch.
    @Test
    void acknowledgeSyllabusVersion_ReturnsUpdatedCount() {
        when(packageRepository.acknowledgeSyllabusVersion(org.mockito.ArgumentMatchers.eq(SYLLABUS),
                org.mockito.ArgumentMatchers.eq("sv-new"), org.mockito.ArgumentMatchers.any(Instant.class))).thenReturn(1);

        assertThat(service.acknowledgeSyllabusVersion(SYLLABUS, "sv-new")).isEqualTo(1);
    }

    // Khối Tính điểm: lấy bài tập (không lấy loại khác) của phiên bản đang dùng của từng học phần, kèm điều kiện đặt bài.
    @Test
    void getGradingSummary_ListsAssessmentsWithSettingsFromActiveVersion() {
        ContentPackage pkg = mock(ContentPackage.class);
        lenient().when(pkg.getId()).thenReturn("pkg-1");
        when(packageRepository.findBySyllabusIdAndDeletedFalse(SYLLABUS)).thenReturn(List.of(pkg));
        ContentPackageResponse response = new ContentPackageResponse(
                "pkg-1", ContentPackageType.ASSESSMENT, SYLLABUS, "sv-1", "d1", null, 0, 0,
                version("d1", ContentPackageVersionStatus.DRAFT), null, Instant.now(), Instant.now());
        when(packageService.listPackageResponsesByIds(anyList())).thenReturn(List.of(response));

        var settings = pl.co.lms.entity.json.PlacementSettings.builder().maxAttempts(2)
                .gradingItem(new pl.co.lms.entity.json.PlacementSettings.GradingItemRef("LMS", 0)).build();
        var quiz = pl.co.lms.entity.json.QuizContent.builder().title("Bài 1").build();
        when(resourceService.listResourceResponses("d1", null)).thenReturn(List.of(
                new ContentPackageVersionResourceResponse("l1", "d1", "res-1", "rv-1", 3, 0, LearningResourceType.ASSESSMENT, quiz, Instant.now(), settings),
                new ContentPackageVersionResourceResponse("l2", "d1", "res-2", "rv-2", 3, 1, LearningResourceType.VOCABULARY, null, Instant.now(), null)));

        var items = service.getGradingSummary(SYLLABUS).assignments();

        assertThat(items).singleElement().satisfies(i -> {
            assertThat(i.resourceId()).isEqualTo("res-1");
            assertThat(i.resourceTitle()).isEqualTo("Bài 1");
            assertThat(i.sessionNo()).isEqualTo(3);
            assertThat(i.packageTitle()).isEqualTo("Tên d1");
            assertThat(i.settings().getGradingItem().getName()).isEqualTo("LMS");
        });
    }
    private static ContentPackageVersionResponse version(String id, ContentPackageVersionStatus status) {
        return new ContentPackageVersionResponse(id, "pkg", 1, status, "Tên " + id, "", null, null, null, Instant.now(), Instant.now());
    }
}
