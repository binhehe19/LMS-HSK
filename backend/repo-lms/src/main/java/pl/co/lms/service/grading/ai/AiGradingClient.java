package pl.co.lms.service.grading.ai;

import com.fasterxml.jackson.databind.JsonNode;
import pl.co.lms.entity.json.QuestionContent;

import java.math.BigDecimal;

// Cổng kết nối tới dịch vụ chấm AI. Mỗi client khai báo câu nào nó chấm được (theo loại câu và cấu hình chấm nằm ngay trên câu);
// câu không có client nào hỗ trợ đi chấm tay. Không có bean nào implement thì mọi câu tự luận chuyển sang chấm tay.
public interface AiGradingClient {

    /** Client này có chấm được câu hỏi này không (chỉ dựa vào chính câu hỏi, không đọc bố cục đề). */
    boolean supports(QuestionContent question);

    // Ném exception khi lỗi hoặc quá thời gian; AssessmentAiGradingService tự retry rồi chuyển câu sang chấm tay.
    Result grade(Request request);

    record Request(QuestionContent question, String answerJson, BigDecimal maxPoints) {}

    /** rubric: điểm theo tiêu chí (JSON mờ với backend, null với câu chấm theo điểm thường); score là điểm của câu theo thang maxPoints. */
    record Result(BigDecimal score, String feedback, JsonNode rubric) {
        public Result(BigDecimal score, String feedback) {
            this(score, feedback, null);
        }
    }
}
