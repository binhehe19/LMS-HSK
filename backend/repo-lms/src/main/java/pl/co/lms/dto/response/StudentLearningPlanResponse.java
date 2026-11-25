package pl.co.lms.dto.response;
import java.util.List;
@com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown=true)
public record StudentLearningPlanResponse(String classId,String courseId,String courseName,String courseBannerUrl,String syllabusId,String syllabusVersionId,Integer syllabusVersionNo,String syllabusName,List<StudentScheduleResponse> schedule){}
