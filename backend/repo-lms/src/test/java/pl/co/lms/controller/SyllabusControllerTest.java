package pl.co.lms.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import base.co.common.dto.ApiResponse;
import pl.co.lms.client.CmsClient;
import pl.co.lms.client.dto.CmsSyllabusSummary;
import pl.co.lms.client.dto.CmsSyllabusVersionSummary;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SyllabusControllerTest {

    @Mock
    private CmsClient cmsClient;

    @InjectMocks
    private SyllabusController syllabusController;

    @Test
    @DisplayName("listSyllabuses should return list of syllabus summaries")
    void listSyllabuses_ShouldReturnSyllabuses() {
        CmsSyllabusSummary summary = new CmsSyllabusSummary();
        summary.setId("syl-1");
        summary.setCode("IELTS_INTENSIVE");
        summary.setName("IELTS Intensive");
        when(cmsClient.listSyllabuses()).thenReturn(List.of(summary));

        ResponseEntity<ApiResponse<?>> response = syllabusController.listSyllabuses();

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        verify(cmsClient).listSyllabuses();
    }

    @Test
    @DisplayName("listVersions should return list of syllabus version summaries")
    void listVersions_ShouldReturnVersions() {
        CmsSyllabusVersionSummary version = new CmsSyllabusVersionSummary();
        version.setId("ver-1");
        version.setVersionNo(1);
        version.setStatus("PUBLISHED");
        when(cmsClient.listSyllabusVersions("syl-1")).thenReturn(List.of(version));

        ResponseEntity<ApiResponse<?>> response = syllabusController.listVersions("syl-1");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        verify(cmsClient).listSyllabusVersions("syl-1");
    }

    @Test
    @DisplayName("searchSyllabuses clamps page size before it reaches the cache key and maps the page")
    void searchSyllabuses_ClampsSizeAndMapsPage() {
        CmsSyllabusSummary summary = new CmsSyllabusSummary();
        summary.setId("syl-1");
        pl.co.lms.client.dto.CmsSyllabusPage page = new pl.co.lms.client.dto.CmsSyllabusPage();
        page.setItems(List.of(summary));
        page.setTotalElements(31);
        page.setTotalPages(2);
        when(cmsClient.searchSyllabuses("ielts", "lv1", "Online", 0, 100)).thenReturn(page);

        var response = syllabusController.searchSyllabuses("ielts", "lv1", "Online", -3, 5000);

        assertThat(response.getBody().data().getItems()).hasSize(1);
        assertThat(response.getBody().data().getTotalElements()).isEqualTo(31);
        verify(cmsClient).searchSyllabuses("ielts", "lv1", "Online", 0, 100);
    }

    @Test
    @DisplayName("evictCache should call evictAllCmsCache and return success message")
    void evictCache_ShouldEvictAllCmsCache() {
        ResponseEntity<ApiResponse<String>> response = syllabusController.evictCache();

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().success()).isTrue();
        assertThat(response.getBody().data()).isEqualTo("CMS cache cleared successfully");
        verify(cmsClient).evictAllCmsCache();
    }
}
