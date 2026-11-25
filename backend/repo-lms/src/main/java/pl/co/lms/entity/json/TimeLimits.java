package pl.co.lms.entity.json;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Thời lượng làm bài (giây) theo ba chế độ do học viên chọn khi bắt đầu; null = không giới hạn.
 * Mọi chế độ đều khoá cứng khi hết giờ, chỉ khác thời lượng.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.ALWAYS)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TimeLimits {

    @JsonProperty("default")
    private Integer standard;
    private Integer hard;
    private Integer easy;

    /** Thời lượng của một chế độ ({@code default|hard|easy}); chế độ lạ coi như mặc định. */
    public Integer forMode(String mode) {
        if ("hard".equals(mode)) return hard;
        if ("easy".equals(mode)) return easy;
        return standard;
    }
}