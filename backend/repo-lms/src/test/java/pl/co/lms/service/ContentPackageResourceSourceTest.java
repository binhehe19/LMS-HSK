package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pl.co.lms.dto.response.ContentPackageVersionResourceResponse;
import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.repository.ContentPackageRepository;
import pl.co.lms.repository.ContentPackageVersionRepository;
import pl.co.lms.repository.ContentPackageVersionResourceRepository;
import pl.co.lms.repository.ContentPackageVersionTopicRepository;
import pl.co.lms.repository.LearningResourceRepository;
import pl.co.lms.repository.LearningResourceVersionRepository;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

/** Danh sách bài trong học phần chỉ trả id gốc khi bản sao lấy từ Kho, để giao diện chặn sửa tại chỗ và dẫn sang Kho. */
@ExtendWith(MockitoExtension.class)
class ContentPackageResourceSourceTest {

    @Mock private ContentPackageVersionResourceRepository linkRepository;
    @Mock private ContentPackageVersionRepository packageVersionRepository;
    @Mock private ContentPackageRepository packageRepository;
    @Mock private LearningResourceRepository resourceRepository;
    @Mock private LearningResourceVersionRepository resourceVersionRepository;
    @Mock private LearningResourceService learningResourceService;
    @Mock private ContentPackageVersionTopicRepository topicRepository;

    private static ContentPackageVersionResource link(String id, String resourceId, int order) {
        ContentPackageVersionResource link = ContentPackageVersionResource.builder()
                .contentPackageVersionId("v1").learningResourceId(resourceId).learningResourceVersionId("rv-" + resourceId)
                .sessionNo(1).displayOrder(order).build();
        link.setId(id);
        return link;
    }

    private static LearningResource resource(String id, String sourceId, boolean inLibrary) {
        LearningResource resource = LearningResource.builder().type(LearningResourceType.VOCABULARY).inLibrary(inLibrary).sourceResourceId(sourceId).build();
        resource.setId(id);
        return resource;
    }

    @Test
    void banSaoTuKhoTraIdGoc_baiTaoTrongHocPhanVaBanChepTuHocPhanKhacTraNull() {
        var service = new ContentPackageVersionResourceService(linkRepository, packageVersionRepository, packageRepository,
                resourceRepository, resourceVersionRepository, learningResourceService, new ObjectMapper(), topicRepository);
        when(linkRepository.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc("v1"))
                .thenReturn(List.of(link("l1", "copy", 0), link("l2", "own", 1), link("l3", "fromPackage", 2)));
        List<LearningResource> all = List.of(resource("copy", "dict-word", false), resource("own", null, false),
                resource("fromPackage", "other-package-item", false),
                resource("dict-word", null, true), resource("other-package-item", null, false));
        when(resourceRepository.findAllById(anyList())).thenAnswer(call -> {
            List<String> ids = call.getArgument(0);
            return all.stream().filter(r -> ids.contains(r.getId())).toList();
        });
        when(resourceVersionRepository.findByIdInAndDeletedFalse(anyList())).thenReturn(List.of());

        List<ContentPackageVersionResourceResponse> rows = service.listResourceResponses("v1", null);

        assertThat(rows).extracting(ContentPackageVersionResourceResponse::learningResourceId, ContentPackageVersionResourceResponse::sourceResourceId)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("copy", "dict-word"), org.assertj.core.groups.Tuple.tuple("own", null),
                        org.assertj.core.groups.Tuple.tuple("fromPackage", null));
    }

    @Test
    void baiTaoTrongHocPhanKhongCanIdGoc() {
        var service = new ContentPackageVersionResourceService(linkRepository, packageVersionRepository, packageRepository,
                resourceRepository, resourceVersionRepository, learningResourceService, new ObjectMapper(), topicRepository);
        when(linkRepository.findByContentPackageVersionIdAndDeletedFalseOrderBySessionNoAscDisplayOrderAsc("v1"))
                .thenReturn(List.of(link("l1", "own", 0)));
        when(resourceRepository.findAllById(List.of("own"))).thenReturn(List.of(resource("own", null, false)));
        when(resourceVersionRepository.findByIdInAndDeletedFalse(anyList())).thenReturn(List.of());

        assertThat(service.listResourceResponses("v1", null)).singleElement()
                .satisfies(row -> {
                    assertThat(row.learningResourceId()).isEqualTo("own");
                    assertThat(row.sourceResourceId()).isNull();
                });
    }
}
