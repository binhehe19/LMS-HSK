package pl.co.lms.dto;

import org.junit.jupiter.api.Test;
import pl.co.lms.dto.response.LearningResourceResponse;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;

import static org.assertj.core.api.Assertions.assertThat;

/** Bản sao trả về học liệu nguồn của nó để FE biết chuỗi nguồn (bản sao của bản sao vẫn truy về bản gốc ở Kho). */
class LearningResourceResponseTest {

    @Test
    void exposesTheSourceResourceOfACopy() {
        LearningResource copy = LearningResource.builder().type(LearningResourceType.VOCABULARY).sourceResourceId("master-1").build();
        copy.setId("copy-1");

        LearningResourceResponse response = LearningResourceResponse.from(copy, null, null);

        assertThat(response.sourceResourceId()).isEqualTo("master-1");
        assertThat(response.inLibrary()).isFalse();
    }

    @Test
    void sourceIsNullForAResourceWithoutOne() {
        LearningResource master = LearningResource.builder().type(LearningResourceType.VOCABULARY).inLibrary(true).build();
        master.setId("master-1");

        assertThat(LearningResourceResponse.from(master, null, null).sourceResourceId()).isNull();
    }
}
