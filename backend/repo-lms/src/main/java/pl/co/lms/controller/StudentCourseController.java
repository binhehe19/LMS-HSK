package pl.co.lms.controller;

import base.co.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;
import com.fasterxml.jackson.databind.ObjectMapper;
import pl.co.lms.dto.response.CourseCatalogResponse;
import pl.co.lms.dto.response.CourseCatalogPageResponse;
import pl.co.lms.client.CmsClient;

@RestController
@RequestMapping("/course-catalog")
@RequiredArgsConstructor
public class StudentCourseController {

    private final CmsClient cms;
    private final ObjectMapper mapper;

    @GetMapping
    public ApiResponse<CourseCatalogPageResponse> list(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String classType,
            @RequestParam(required = false) java.math.BigDecimal maxPrice,
            @RequestParam(defaultValue = "newest") String sort) {
        var query = UriComponentsBuilder.newInstance()
            .queryParam("page", Math.max(0, page))
            .queryParam("size", Math.min(100, Math.max(1, size)));
        if (keyword != null && !keyword.isBlank())
            query.queryParam("keyword", keyword);
        query.queryParam("sort", sort);
        if (classType != null)
            query.queryParam("classType", classType);
        if (maxPrice != null)
            query.queryParam("maxPrice", maxPrice);
        return ApiResponse.ok(mapper.convertValue(cms.getCourseCatalog(query.build().encode().toUriString()), CourseCatalogPageResponse.class));
    }

    @GetMapping("/{id}")
    public ApiResponse<CourseCatalogResponse> detail(@PathVariable String id) {
        return ApiResponse.ok(mapper.convertValue(cms.getCourseCatalog("/" + UriComponentsBuilder.fromPath(id).build().encode().toUriString()), CourseCatalogResponse.class));
    }

}
