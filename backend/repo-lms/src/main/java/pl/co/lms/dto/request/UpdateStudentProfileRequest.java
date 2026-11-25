package pl.co.lms.dto.request;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record UpdateStudentProfileRequest(
        @Size(max = 60, message = "Tên hiển thị tối đa 60 ký tự") String publicName,
        @DecimalMin(value = "0.0", message = "Band mục tiêu phải từ 0 đến 9") @DecimalMax(value = "9.0", message = "Band mục tiêu phải từ 0 đến 9") BigDecimal targetBand,
        LocalDate targetDate,
        @Min(value = 15, message = "Thời lượng học tối thiểu 15 phút mỗi tuần") @Max(value = 2520, message = "Thời lượng học tối đa 2520 phút mỗi tuần") int weeklyMinutes,
        boolean leaderboardVisible) {}
