"use client";

// /hanzi/manage/create-package — HanziCreatePackage (create-package.tsx) của HSK cũ: form tạo gói độc lập, thành công => toast "Tạo gói thành công!" rồi về
// màn quản lý. Dùng client generic content-tree (POST /writing/packages) qua write gate "content" + quyền ticket WRITING (bản cũ không kiểm quyền ở trang này).
// Khác bản cũ có chủ đích: `?type=` chọn trước loại gói (từ trang chọn loại); sau khi tạo mở thẳng gói vừa tạo trong cây (bản cũ về gốc); lỗi API là toast
// với thông điệp máy chủ, không "thành công giả".
import { Alert } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { HanziCreatePackageForm } from "@/components/management/content-hanzi/hanzi-create-package-form";
import { HANZI_MANAGE_PATH, resolveWritingPackageType, WRITING_CONFIG, WRITING_PACKAGE_TYPES } from "@/components/management/content-hanzi/hanzi-config";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { useContentAccess } from "@/hooks/use-content-access";
import { useWriteGate } from "@/hooks/use-write-gate";
import { createPackage } from "@/lib/api/content-tree-client";
import { packageLocation, treeHref } from "@/lib/content/content-tree-params";
import { normalizePackageInput, validatePackageInput, writeErrorMessage } from "@/lib/content/content-tree-validate";
import type { ContentPackageInput } from "@/types/content";

const TARGET = { apiPrefix: WRITING_CONFIG.apiPrefix, itemsPath: WRITING_CONFIG.itemsPath };

export function HanziCreatePackagePageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const access = useContentAccess(WRITING_CONFIG.module);
  const { enabled: writeEnabled, demo } = useWriteGate("content");
  const canWrite = access.canManage && writeEnabled;
  const [values, setValues] = useState<ContentPackageInput>(() => ({ name: "", type: resolveWritingPackageType(params.get("type")), description: "" }));
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!canWrite || submitting) return;
    const invalid = validatePackageInput(values);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setSubmitting(true);
    try {
      const created = await createPackage(TARGET, normalizePackageInput(values), demo);
      toast.success("Tạo gói thành công!");
      router.push(created?.id ? treeHref(HANZI_MANAGE_PATH, packageLocation(created.id)) : HANZI_MANAGE_PATH);
    } catch (error) {
      toast.error(writeErrorMessage(error, "Không thể tạo gói"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ManagementPageFrame contentClassName="manage-hanzi-page content-tree-page">
      {access.status !== "loading" && !access.canManage && (
        <div className="mb-3">
          <Alert message="Chế độ Xem duy nhất" description="Bạn hiện không có Ticket được cấp cho Module này. Bạn vẫn có thể xem các nội dung nhưng không thể Thêm, Sửa hoặc Xóa." type="warning" showIcon className="rounded-3 border-warning bg-soft-warning" data-testid="content-readonly-alert" />
        </div>
      )}
      {access.canManage && !writeEnabled && (
        <div className="mb-3">
          <WriteLockedNotice what="Tạo gói luyện viết" />
        </div>
      )}
      <HanziCreatePackageForm values={values} types={WRITING_PACKAGE_TYPES} disabled={!canWrite} submitting={submitting} cancelHref={HANZI_MANAGE_PATH} onChange={setValues} onSubmit={() => void submit()} />
    </ManagementPageFrame>
  );
}
