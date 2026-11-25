package pl.co.lms.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.*;
import pl.co.lms.client.CmsClient;
import pl.co.lms.dto.response.*;
import base.co.common.exception.*;

@Service
@RequiredArgsConstructor
public class StudentCourseReadService {

    private final CmsClient cms;

    private final ObjectMapper mapper;

    public StudentLearningPlanResponse plan(String classId) {
        if (cms.getMyClasses(null).stream().noneMatch(c -> classId.equals(c.getId())))
            throw new ApiException(ErrorCode.FORBIDDEN, "You do not belong to this class");
        return mapper.copy()
            .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .convertValue(cms.getStudentLearningPlan(classId), StudentLearningPlanResponse.class);
    }

}
