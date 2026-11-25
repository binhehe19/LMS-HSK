package pl.co.lms.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

// "student" (thông tin học viên) trong response thật luôn null (chưa thấy CMS trả field này
// có dữ liệu) - không map, FE tự đối chiếu studentId với danh sách học viên (tab "Học viên")
// để hiển thị tên.
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CmsFeedbackStudent {
    private String studentId;
    private List<CmsFeedbackEntry> feedbacks;
}
