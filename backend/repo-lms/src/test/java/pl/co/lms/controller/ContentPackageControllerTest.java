package pl.co.lms.controller;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContentPackageControllerTest {
    // Draft data must stay admin-only: standalone MockMvc skips method security, so assert the annotation itself.
    @Test void packageReadEndpointsRequireAdmin() throws Exception {
        var methods = List.of(
                ContentPackageController.class.getMethod("listPackages",
                        pl.co.lms.entity.ContentPackageType.class, String.class, boolean.class, String.class, String.class, String.class, int.class, int.class),
                ContentPackageController.class.getMethod("listPackagesByIds", List.class),
                ContentPackageController.class.getMethod("getPackage", String.class),
                // Gắn học phần vào giáo trình là thao tác ghi: cũng chỉ dành cho admin.
                ContentPackageController.class.getMethod("attachToSyllabus", String.class, pl.co.lms.dto.request.AttachPackageToSyllabusRequest.class));
        for (var m : methods) {
            PreAuthorize pre = m.getAnnotation(PreAuthorize.class);
            assertNotNull(pre, m.getName());
            assertTrue(pre.value().contains("ROLE_ADMIN"), m.getName());
        }
    }
}
