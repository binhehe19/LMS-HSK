"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OnlineCourseLeadsView, type LeadsDraftFilters } from "@/components/management/online-course-leads/online-course-leads-view";
import { useOnlineCourseLeads } from "@/components/management/online-course-leads/use-online-course-leads";
import { buildLeadsCsv, filterLeadsByStatus, leadsCsvFilename } from "@/lib/online-course/lead-model";

const EMPTY_DRAFT: LeadsDraftFilters = { courseCode: "", range: null, status: "ALL" };

/** Tải một file văn bản phía trình duyệt (CSV); không gọi mạng. */
function downloadTextFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Container màn /learning-path/online-course/leads (HSK cũ: OnlineCourseLeadManagementPage, chỉ ADMIN ở app mới, CHỈ ĐỌC). Bộ lọc nháp (mã khoá,
 * khoảng ngày) chỉ gửi lên máy chủ khi bấm "Lọc" như bản cũ; trạng thái lọc phía client trên trang hiện tại; "Xuất CSV" xuất các dòng đang hiển thị.
 */
export function OnlineCourseLeadsPageContent() {
  const leads = useOnlineCourseLeads();
  const [draft, setDraft] = useState<LeadsDraftFilters>(EMPTY_DRAFT);

  const rows = useMemo(() => filterLeadsByStatus(leads.page?.content ?? [], draft.status), [leads.page, draft.status]);

  const apply = () => {
    const [from, to] = draft.range ?? [null, null];
    leads.applyFilters({ courseCode: draft.courseCode.trim(), from: from && to ? from.format("YYYY-MM-DD") : "", to: from && to ? to.format("YYYY-MM-DD") : "" });
  };

  const reset = () => {
    setDraft(EMPTY_DRAFT);
    leads.applyFilters({ courseCode: "", from: "", to: "" });
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    downloadTextFile(leadsCsvFilename(new Date()), buildLeadsCsv(rows, leads.courseTypes), "text/csv;charset=utf-8");
    toast.success(`Đã xuất CSV ${rows.length} đăng ký đang hiển thị`);
  };

  return (
    <OnlineCourseLeadsView
      state={leads.state}
      rows={rows}
      totalElements={leads.page?.totalElements ?? 0}
      totalPages={leads.page?.totalPages ?? 1}
      page={leads.page?.number ?? leads.query.page}
      refreshing={leads.refreshing}
      courseTypes={leads.courseTypes}
      draft={draft}
      onDraftChange={setDraft}
      onApply={apply}
      onReset={reset}
      onPrev={() => leads.goToPage(leads.query.page - 1)}
      onNext={() => leads.goToPage(leads.query.page + 1)}
      onExport={exportCsv}
      onRetry={leads.reload}
    />
  );
}
