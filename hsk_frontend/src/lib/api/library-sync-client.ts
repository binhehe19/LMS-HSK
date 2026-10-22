import { toast } from "sonner";
import { lmsClient } from "@/lib/api/lms-client";

interface PackageUsage {
  linkId: string;
  packageTitle: string;
  upToDate: boolean;
}

type ToastId = string | number;

/**
 * Sau khi xuất bản một mục Kho (từ điển, ngữ pháp): đẩy nội dung mới xuống các bản sao trong học phần còn cũ, từng học phần một để báo tiến độ
 * và đếm được học phần lỗi. Tiến độ/kết quả hiện trên toast `toastId`; lỗi có nút "Thử lại" (chạy lại chỉ với các bản sao còn cũ).
 */
export async function syncPublishedToPackages(resourceId: string, toastId: ToastId, doneText: string): Promise<void> {
  const base = `/learning-resources/${encodeURIComponent(resourceId)}`;
  const retry = { label: "Thử lại", onClick: () => void syncPublishedToPackages(resourceId, toastId, doneText) };
  toast.loading("Đang cập nhật học phần…", { id: toastId });
  let stale: PackageUsage[];
  try {
    stale = (await lmsClient.get<PackageUsage[]>(`${base}/package-usages`)).filter((usage) => !usage.upToDate);
  } catch {
    toast.error("Đã lưu, chưa kiểm tra được các học phần đang dùng mục này.", { id: toastId, duration: Infinity, action: retry });
    return;
  }
  let failed = 0;
  for (const [i, usage] of stale.entries()) {
    toast.loading(`Đang cập nhật học phần (${i + 1}/${stale.length}): ${usage.packageTitle}`, { id: toastId });
    try {
      await lmsClient.post(`${base}/sync-to-packages`, { linkIds: [usage.linkId] });
    } catch {
      failed++;
    }
  }
  if (failed) toast.error(`Đã lưu, chưa đồng bộ được ${failed} học phần.`, { id: toastId, duration: Infinity, action: retry });
  else toast.success(stale.length ? `${doneText} Đã cập nhật ${stale.length} học phần.` : doneText, { id: toastId, duration: 4000 });
}
