package pl.co.lms.service;
import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.*;
import pl.co.lms.client.CmsClient;
import pl.co.lms.client.dto.CmsMyClass;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class StudentCourseReadServiceTest {
 @Test void catalogIsAnAllowlistNotARawCmsProxy() throws Exception {
  var mapper=new ObjectMapper();var value=mapper.readValue("{\"id\":\"course\",\"name\":\"A\",\"banner_url\":\"https://cms.test/image\",\"teacher_materials\":[\"SECRET\"]}",pl.co.lms.dto.response.CourseCatalogResponse.class);
  assertThat(mapper.writeValueAsString(value)).contains("banner_url").doesNotContain("SECRET","teacher_materials");
 }
 @Test void convertsCmsPlanToSafeCamelCaseAndChecksMembership() throws Exception {
  var cms=mock(CmsClient.class);var mapper=new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,false);
  var service=new StudentCourseReadService(cms,mapper);var cls=new CmsMyClass();cls.setId("c");when(cms.getMyClasses(null)).thenReturn(List.of(cls));
  when(cms.getStudentLearningPlan("c")).thenReturn(mapper.readTree("""
   {"class_id":"c","syllabus_version_id":"v1","course_banner_url":"https://cms.test/banner","schedule":[{"id":"row","session_no":2,"topic":"Class v1","student_tasks":"Practice","student_materials":[{"material_title":"Book","material_link":"https://cms.test/file","file_id":"file"}],"teacher_tasks":"SECRET"}]}
   """));
  var plan=service.plan("c");assertThat(plan.syllabusVersionId()).isEqualTo("v1");assertThat(plan.schedule().getFirst().studentMaterials().getFirst().materialLink()).isEqualTo("https://cms.test/file");
  String json=mapper.writeValueAsString(plan);assertThat(json).contains("studentTasks","courseBannerUrl").doesNotContain("SECRET","teacherTasks");
  assertThatThrownBy(()->service.plan("other")).isInstanceOf(base.co.common.exception.ApiException.class);verify(cms,never()).getStudentLearningPlan("other");
 }
}
