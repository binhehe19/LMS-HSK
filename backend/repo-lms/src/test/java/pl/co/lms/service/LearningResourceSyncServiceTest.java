package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pl.co.lms.dto.response.ResourcePackageUsageResponse;
import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;
import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.ContentPackageVersionStatus;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceVersionRepository;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LearningResourceSyncServiceTest {

    @Mock private LearningResourceRepository resourceRepository;
    @Mock private LearningResourceVersionRepository resourceVersionRepository;
    @Mock private LearningResourceService resourceService;
    @Mock private ContentPackageVersionResourceRepository linkRepository;
    @Mock private ContentPackageVersionRepository packageVersionRepository;
    @Mock private ContentPackageRepository packageRepository;

    private LearningResourceSyncService service;
    private LearningResource source;
    private ContentPackageVersionResource link;

    @BeforeEach
    void setUp() {
        service = new LearningResourceSyncService(resourceRepository, resourceVersionRepository, resourceService,
                linkRepository, packageVersionRepository, packageRepository);
        lenient().when(resourceService.getObjectMapper()).thenReturn(new ObjectMapper());

        source = LearningResource.builder().type(LearningResourceType.VOCABULARY).inLibrary(true).publishedVersionId("sv-1").build();
        source.setId("src");
        lenient().when(resourceService.getResource("src")).thenReturn(source);
        LearningResourceVersion sourceVersion = new LearningResourceVersion();
        sourceVersion.setId("sv-1");
        sourceVersion.setContent("{\"word\":\"new\"}");
        lenient().when(resourceVersionRepository.findByIdAndDeletedFalse("sv-1")).thenReturn(Optional.of(sourceVersion));

        LearningResource copy = LearningResource.builder().type(LearningResourceType.VOCABULARY).sourceResourceId("src").build();
        copy.setId("copy");
        lenient().when(resourceRepository.findBySourceResourceIdAndDeletedFalse("src")).thenReturn(List.of(copy));

        link = ContentPackageVersionResource.builder().contentPackageVersionId("pv-1").learningResourceId("copy")
                .learningResourceVersionId("cv-1").sessionNo(2).displayOrder(0).build();
        link.setId("link-1");
        lenient().when(linkRepository.findByLearningResourceIdInAndDeletedFalse(anyCollection())).thenReturn(List.of(link));
        lenient().when(linkRepository.findById("link-1")).thenReturn(Optional.of(link));

        ContentPackageVersion pv = ContentPackageVersion.builder().packageId("pkg-1").title("Unit 1")
                .status(ContentPackageVersionStatus.PUBLISHED).build();
        pv.setId("pv-1");
        lenient().when(packageVersionRepository.findAllById(anyList())).thenReturn(List.of(pv));
        ContentPackage pkg = ContentPackage.builder().type(ContentPackageType.VOCABULARY).publishedVersionId("pv-1").build();
        pkg.setId("pkg-1");
        lenient().when(packageRepository.findByIdInAndDeletedFalse(anyList())).thenReturn(List.of(pkg));
        LearningResourceVersion copyVersion = new LearningResourceVersion();
        copyVersion.setId("cv-1");
        copyVersion.setContent("{\"word\":\"old\"}");
        lenient().when(resourceVersionRepository.findByIdInAndDeletedFalse(anyList())).thenReturn(List.of(copyVersion));
    }

    @Test
    void listUsages_FlagsStaleCopiesInCurrentPackageVersions() {
        List<ResourcePackageUsageResponse> usages = service.listUsages("src");

        assertThat(usages).singleElement().satisfies(u -> {
            assertThat(u.linkId()).isEqualTo("link-1");
            assertThat(u.packageTitle()).isEqualTo("Unit 1");
            assertThat(u.sessionNo()).isEqualTo(2);
            assertThat(u.upToDate()).isFalse();
        });
    }

    @Test
    void sync_CreatesNewCopyVersionAndRepointsLinkWithoutNewPackageVersion() {
        LearningResourceVersion draft = new LearningResourceVersion();
        draft.setId("cv-draft");
        LearningResourceVersion published = new LearningResourceVersion();
        published.setId("cv-2");
        when(resourceService.createDraftVersion(any(), any())).thenReturn(draft);
        when(resourceService.publishVersion("copy", "cv-draft")).thenReturn(published);

        int synced = service.sync("src", List.of("link-1"));

        assertThat(synced).isEqualTo(1);
        assertThat(link.getLearningResourceVersionId()).isEqualTo("cv-2");
        verify(linkRepository).save(link);
    }

    @Test
    void sync_RejectsLinkThatIsNotACopyOfThisResource() {
        assertThatThrownBy(() -> service.sync("src", List.of("link-other")))
                .hasMessageContaining("không thuộc");
    }
}