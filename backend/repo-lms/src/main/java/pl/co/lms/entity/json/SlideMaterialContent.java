package pl.co.lms.entity.json;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SlideMaterialContent {
    /** Tên hiển thị của tài liệu (vd "第十八课： 科技与世界"); trống thì dùng fileName. */
    private String title;
    private String fileId;
    private String fileName;
    private String mimeType;
    private Long sizeBytes;
    private String status;
}
