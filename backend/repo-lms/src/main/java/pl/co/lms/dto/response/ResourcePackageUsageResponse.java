package pl.co.lms.dto.response;

import pl.co.lms.entity.ContentPackageType;
import pl.co.lms.entity.ContentPackageVersionStatus;

// Một chỗ mà bản sao của tài nguyên Kho đang được dùng trong học phần (bản nháp hoặc bản đang publish).
public record ResourcePackageUsageResponse(
        String linkId,
        String packageId,
        ContentPackageType packageType,
        String packageTitle,
        String packageVersionId,
        ContentPackageVersionStatus versionStatus,
        int sessionNo,
        String copyResourceId,
        /** true = nội dung bản sao đã trùng với bản mới nhất của Kho. */
        boolean upToDate
) {}
