package pl.co.lms.service;

import base.co.common.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pl.co.lms.client.CmsClient;
import pl.co.lms.dto.response.EditLockResponse;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContentPackageServiceTest {

    @Mock
    private ContentPackageRepository packageRepository;
    @Mock
    private ContentPackageVersionRepository versionRepository;
    @Mock
    private ContentPackageVersionResourceRepository versionResourceRepository;
    @Mock
    private LearningResourceService learningResourceService;
    @Mock
    private RedisSessionLockService redisLockService;
    @Mock
    private pl.co.lms.service.studymaterials.StudyMaterialVocabularyRefreshService studyVocabularyRefresh;
    @Mock
    private pl.co.lms.repository.ContentPackageVersionTopicRepository topicRepository;
    @Mock
    private pl.co.lms.repository.ContentPackageVersionSessionRepository sessionRepository;

    @Mock
    private CmsClient cmsClient;

    private ContentPackageService service;

    @BeforeEach
    void setUp() {
        service = new ContentPackageService(
                packageRepository, versionRepository, versionResourceRepository,
                learningResourceService, redisLockService, studyVocabularyRefresh, topicRepository, sessionRepository, cmsClient);
    }

    @Test
    void createPackage_Success() {
        when(packageRepository.save(any(ContentPackage.class))).thenAnswer(i -> {
            ContentPackage p = i.getArgument(0);
            p.setId("pkg-1");
            return p;
        });

        ContentPackage created = service.createPackage(ContentPackageType.GRAMMAR, "syl-1", "sv-1");
        assertThat(created.getId()).isEqualTo("pkg-1");
        assertThat(created.getSyllabusId()).isEqualTo("syl-1");
        assertThat(created.getType()).isEqualTo(ContentPackageType.GRAMMAR);
    }

    @Test
    void createDraftVersion_IncrementsVersion() {
        ContentPackage pkg = ContentPackage.builder().type(ContentPackageType.VOCABULARY).build();
        pkg.setId("pkg-1");
        when(packageRepository.findByIdAndDeletedFalse("pkg-1")).thenReturn(Optional.of(pkg));

        ContentPackageVersion v1 = ContentPackageVersion.builder().packageId("pkg-1").version(1).build();
        when(versionRepository.findByPackageIdAndDeletedFalseOrderByVersionDesc("pkg-1")).thenReturn(List.of(v1));
        when(versionRepository.save(any(ContentPackageVersion.class))).thenAnswer(i -> {
            ContentPackageVersion v = i.getArgument(0);
            v.setId("ver-2");
            return v;
        });

        ContentPackageVersion draftData = ContentPackageVersion.builder().title("Vocab V2").build();
        ContentPackageVersion created = service.createDraftVersion("pkg-1", draftData);

        assertThat(created.getId()).isEqualTo("ver-2");
        assertThat(created.getVersion()).isEqualTo(2);
        assertThat(created.getStatus()).isEqualTo(ContentPackageVersionStatus.DRAFT);
        assertThat(pkg.getDraftVersionId()).isEqualTo("ver-2");
    }

    private ContentPackageVersion draftForUpdate() {
        ContentPackageVersion ver = ContentPackageVersion.builder()
                .packageId("pkg-1").version(1).status(ContentPackageVersionStatus.DRAFT).build();
        ver.setId("ver-1");
        when(versionRepository.findByIdAndDeletedFalse("ver-1")).thenReturn(Optional.of(ver));
        return ver;
    }

    @Test
    void updateDraftVersion_SavesSessionCountIncludingEmptySessions() {
        ContentPackageVersion ver = draftForUpdate();
        when(versionRepository.save(any(ContentPackageVersion.class))).thenAnswer(i -> i.getArgument(0));

        service.updateDraftVersion("pkg-1", "ver-1",
                new pl.co.lms.dto.request.UpdateContentPackageVersionRequest(null, null, null, null, 7));

        assertThat(ver.getSessionCount()).isEqualTo(7);
    }

    @Test
    void updateDraftVersion_NullSessionCountKeepsExistingValue() {
        ContentPackageVersion ver = draftForUpdate();
        ver.setSessionCount(4);
        when(versionRepository.save(any(ContentPackageVersion.class))).thenAnswer(i -> i.getArgument(0));

        service.updateDraftVersion("pkg-1", "ver-1",
                new pl.co.lms.dto.request.UpdateContentPackageVersionRequest("New title", null, null, null, null));

        assertThat(ver.getSessionCount()).isEqualTo(4);
    }

    @Test
    void updateDraftVersion_SessionCountOutOfRangeThrows() {
        draftForUpdate();

        assertThatThrownBy(() -> service.updateDraftVersion("pkg-1", "ver-1",
                new pl.co.lms.dto.request.UpdateContentPackageVersionRequest(null, null, null, null, 501)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Số buổi");
    }

    @Test
    void publishVersion_Success() {
        ContentPackage pkg = ContentPackage.builder().type(ContentPackageType.VOCABULARY).build();
        pkg.setId("pkg-1");
        pkg.setDraftVersionId("ver-1");

        ContentPackageVersion ver = ContentPackageVersion.builder()
                .packageId("pkg-1")
                .title("Unit 1")
                .version(1)
                .status(ContentPackageVersionStatus.DRAFT)
                .build();
        ver.setId("ver-1");

        when(packageRepository.findByIdAndDeletedFalse("pkg-1")).thenReturn(Optional.of(pkg));
        when(versionRepository.findByIdAndDeletedFalse("ver-1")).thenReturn(Optional.of(ver));
        when(redisLockService.isHeldBy("pkg-edit-lock", "pkg-1", "session-1")).thenReturn(true);
        when(versionResourceRepository.countByContentPackageVersionIdAndDeletedFalse("ver-1")).thenReturn(3L);

        ContentPackageVersion published = service.publishVersion("pkg-1", "ver-1", "session-1");

        assertThat(published.getStatus()).isEqualTo(ContentPackageVersionStatus.PUBLISHED);
        assertThat(pkg.getPublishedVersionId()).isEqualTo("ver-1");
        assertThat(pkg.getDraftVersionId()).isNull();
        org.mockito.Mockito.verify(studyVocabularyRefresh).refreshPackage("pkg-1", "ver-1");
    }

    @Test
    void publishVersion_EmptyPackage_Throws() {
        ContentPackage pkg = ContentPackage.builder().type(ContentPackageType.VOCABULARY).build();
        pkg.setId("pkg-1");
        pkg.setDraftVersionId("ver-1");
        ContentPackageVersion ver = ContentPackageVersion.builder()
                .packageId("pkg-1").title("Unit 1").version(1).status(ContentPackageVersionStatus.DRAFT).build();
        ver.setId("ver-1");
        when(packageRepository.findByIdAndDeletedFalse("pkg-1")).thenReturn(Optional.of(pkg));
        when(versionRepository.findByIdAndDeletedFalse("ver-1")).thenReturn(Optional.of(ver));
        when(redisLockService.isHeldBy("pkg-edit-lock", "pkg-1", "session-1")).thenReturn(true);
        when(versionResourceRepository.countByContentPackageVersionIdAndDeletedFalse("ver-1")).thenReturn(0L);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.publishVersion("pkg-1", "ver-1", "session-1"))
                .hasMessageContaining("chưa có nội dung");
        assertThat(pkg.getPublishedVersionId()).isNull();
    }

    // Học phần tự do: cả hai trống (null hoặc chuỗi trắng) đều hợp lệ và lưu null.
    @Test
    void createPackage_WithoutSyllabus_StoresNulls() {
        when(packageRepository.save(any(ContentPackage.class))).thenAnswer(i -> i.getArgument(0));

        ContentPackage free = service.createPackage(ContentPackageType.GRAMMAR, null, null);
        assertThat(free.getSyllabusId()).isNull();
        assertThat(free.getSyllabusVersionId()).isNull();

        ContentPackage blanks = service.createPackage(ContentPackageType.GRAMMAR, " ", "  ");
        assertThat(blanks.getSyllabusId()).isNull();
        assertThat(blanks.getSyllabusVersionId()).isNull();
    }

    // Có giáo trình thì phải đủ cặp id + phiên bản; thiếu một nửa là lỗi và không lưu gì.
    @Test
    void createPackage_HalfSyllabusPair_Throws() {
        assertThatThrownBy(() -> service.createPackage(ContentPackageType.GRAMMAR, " ", "sv-1"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("syllabusId");
        assertThatThrownBy(() -> service.createPackage(ContentPackageType.GRAMMAR, "syl-1", null))
                .isInstanceOf(ApiException.class);
        org.mockito.Mockito.verify(packageRepository, org.mockito.Mockito.never()).save(any(ContentPackage.class));
    }

    // Đích sao chép phải có giáo trình; kiểm ở đầu hàm, trước khi đọc học phần nguồn.
    @Test
    void copyPackage_WithoutTargetSyllabus_ThrowsBeforeReadingSource() {
        assertThatThrownBy(() -> service.copyPackage("pkg-src", null, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("giáo trình đích");
        assertThatThrownBy(() -> service.copyPackage("pkg-src", "syl-2", " ", null))
                .isInstanceOf(ApiException.class);
        org.mockito.Mockito.verify(packageRepository, org.mockito.Mockito.never()).findByIdAndDeletedFalse(any());
        org.mockito.Mockito.verify(packageRepository, org.mockito.Mockito.never()).save(any(ContentPackage.class));
    }

    @Test
    void attachToSyllabus_MissingPair_ThrowsWithoutWriting() {
        assertThatThrownBy(() -> service.attachToSyllabus("pkg-1", "syl-1", null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.attachToSyllabus("pkg-1", " ", "sv-1")).isInstanceOf(ApiException.class);
        org.mockito.Mockito.verifyNoInteractions(packageRepository);
    }

    @Test
    void deletePackage_SoftDeletes() {
        ContentPackage pkg = ContentPackage.builder().type(ContentPackageType.ASSESSMENT).build();
        pkg.setId("pkg-1");
        when(packageRepository.findByIdAndDeletedFalse("pkg-1")).thenReturn(Optional.of(pkg));

        service.deletePackage("pkg-1");

        assertThat(pkg.isDeleted()).isTrue();
    }

    // Sao chép tạo học phần mới (nháp) ở giáo trình đích, chép dòng đặt bài; học phần gốc không đổi.
    @Test
    void copyPackage_CreatesNewDraftPackageWithClonedLinks() {
        ContentPackage source = ContentPackage.builder().type(ContentPackageType.ASSESSMENT)
                .syllabusId("syl-1").syllabusVersionId("sv-1").publishedVersionId("ver-src").build();
        source.setId("pkg-src");
        ContentPackageVersion from = ContentPackageVersion.builder().packageId("pkg-src").title("Gốc").sessionCount(3).build();
        from.setId("ver-src");
        when(packageRepository.findByIdAndDeletedFalse("pkg-src")).thenReturn(Optional.of(source));
        when(versionRepository.findByIdAndDeletedFalse("ver-src")).thenReturn(Optional.of(from));
        ContentPackage[] copyHolder = new ContentPackage[1];
        when(packageRepository.save(any(ContentPackage.class))).thenAnswer(i -> {
            ContentPackage p = i.getArgument(0);
            if (p.getId() == null) { p.setId("pkg-copy"); copyHolder[0] = p; }
            return p;
        });
        when(packageRepository.findByIdAndDeletedFalse("pkg-copy")).thenAnswer(i -> Optional.of(copyHolder[0]));
        when(versionRepository.save(any(ContentPackageVersion.class))).thenAnswer(i -> {
            ContentPackageVersion v = i.getArgument(0);
            v.setId("ver-copy");
            return v;
        });
        when(versionRepository.findByPackageIdAndDeletedFalseOrderByVersionDesc("pkg-copy")).thenReturn(List.of());
        ContentPackageVersionResource link = ContentPackageVersionResource.builder()
                .contentPackageVersionId("ver-src").learningResourceId("res-1").learningResourceVersionId("rv-1")
                .sessionNo(2).displayOrder(1)
                .settings(pl.co.lms.entity.json.PlacementSettings.builder().maxAttempts(2).passThresholdPct(70)
                        .cloCodes(List.of("CLO1")).gradingItem(new pl.co.lms.entity.json.PlacementSettings.GradingItemRef("LMS", 0)).build())
                .build();
        when(versionResourceRepository.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc("ver-src"))
                .thenReturn(List.of(link));

        ContentPackage copy = service.copyPackage("pkg-src", "syl-2", "sv-9", null);

        assertThat(copy.getId()).isEqualTo("pkg-copy");
        assertThat(copy.getSyllabusId()).isEqualTo("syl-2");
        assertThat(copy.getSyllabusVersionId()).isEqualTo("sv-9");
        assertThat(copy.getType()).isEqualTo(ContentPackageType.ASSESSMENT);
        assertThat(copy.getPublishedVersionId()).isNull();
        assertThat(copy.getDraftVersionId()).isEqualTo("ver-copy");
        org.mockito.ArgumentCaptor<ContentPackageVersionResource> cloned = org.mockito.ArgumentCaptor.forClass(ContentPackageVersionResource.class);
        org.mockito.Mockito.verify(versionResourceRepository).save(cloned.capture());
        assertThat(cloned.getValue().getContentPackageVersionId()).isEqualTo("ver-copy");
        assertThat(cloned.getValue().getLearningResourceVersionId()).isEqualTo("rv-1");
        assertThat(cloned.getValue().getSessionNo()).isEqualTo(2);
        // Sang giáo trình khác: giữ điều kiện chung, bỏ CLO và hạng mục (thuộc syllabus cũ).
        assertThat(cloned.getValue().getSettings().getMaxAttempts()).isEqualTo(2);
        assertThat(cloned.getValue().getSettings().getPassThresholdPct()).isEqualTo(70);
        assertThat(cloned.getValue().getSettings().getCloCodes()).isNull();
        assertThat(cloned.getValue().getSettings().getGradingItem()).isNull();
        assertThat(source.getSyllabusId()).isEqualTo("syl-1");
    }
    @Test
    void publishVersion_WrongSessionToken_Throws() {
        ContentPackage pkg = ContentPackage.builder().type(ContentPackageType.VOCABULARY).build();
        pkg.setId("pkg-1");
        pkg.setDraftVersionId("ver-1");

        when(packageRepository.findByIdAndDeletedFalse("pkg-1")).thenReturn(Optional.of(pkg));
        when(redisLockService.isHeldBy("pkg-edit-lock", "pkg-1", "someone-else")).thenReturn(false);

        assertThatThrownBy(() -> service.publishVersion("pkg-1", "ver-1", "someone-else"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("hết hạn");
    }

    @Test
    void acquireOrRenewLock_Success() {
        when(redisLockService.acquireOrRenew("pkg-edit-lock", "pkg-1", "user1", "tok1", 60L, false))
                .thenReturn(new RedisSessionLockService.LockResult(true, "user1", Instant.now().plusSeconds(60)));

        EditLockResponse response = service.acquireOrRenewLock("pkg-1", "user1", "tok1");

        assertThat(response.acquired()).isTrue();
        assertThat(response.lockedByUserId()).isEqualTo("user1");
    }

    @Test
    void acquireOrRenewLock_Conflict() {
        when(redisLockService.acquireOrRenew("pkg-edit-lock", "pkg-1", "user1", "tok1", 60L, false))
                .thenReturn(new RedisSessionLockService.LockResult(false, "other-user", Instant.now().plusSeconds(30)));

        EditLockResponse response = service.acquireOrRenewLock("pkg-1", "user1", "tok1");

        assertThat(response.acquired()).isFalse();
        assertThat(response.lockedByUserId()).isEqualTo("other-user");
    }
}
