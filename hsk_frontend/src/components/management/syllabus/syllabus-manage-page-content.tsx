"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AddScheduleModuleModal } from "@/components/management/syllabus/add-schedule-module-modal";
import { SyllabusManageView, type SyllabusManageMode } from "@/components/management/syllabus/syllabus-manage-view";
import { useScheduleModuleActions, useScheduleModules } from "@/components/management/syllabus/use-schedule-modules";
import { useSyllabusDetail } from "@/components/management/syllabus/use-syllabus-detail";
import { useSyllabusList } from "@/components/management/syllabus/use-syllabus-list";
import { confirmAction } from "@/components/shared/confirm-action";
import { useContentAccess } from "@/hooks/use-content-access";
import { useWriteGate } from "@/hooks/use-write-gate";
import { movedIds } from "@/lib/syllabus/schedule-modules-model";
import { filterSyllabuses } from "@/lib/syllabus/syllabus-model";
import { checkSyllabusId, parseSyllabusTab, type SyllabusTabKey } from "@/lib/syllabus/syllabus-params";
import type { SyllabusScheduleItem } from "@/types/lms";
import type { CreateScheduleModuleRequest } from "@/types/syllabus-modules";

// Màn "Quản lý Syllabus" (/learning-path/syllabus/manage; HSK cũ: SyllabusManagementPage bọc SyllabusManagementModal chế độ asPage, 4.345 dòng).
// Phạm vi RÚT GỌN có chủ đích (D-UI-3): danh sách + chi tiết giáo trình từ backend chung (chỉ đọc) và module ôn luyện theo buổi (hợp đồng đề xuất HSK).
// Giáo trình đang xem và tab nằm trong URL (?view=&tab=) để tải lại / nút quay lại của trình duyệt về đúng chỗ: mở chi tiết = push (quay lại về danh sách),
// đổi tab = replace. Quyền sửa module: ticket module OTHER (useContentAccess) + công tắc ghi "content" (useWriteGate).
export function SyllabusManagePageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const viewCheck = checkSyllabusId(params.get("view"));
  const syllabusId = viewCheck.kind === "ok" ? viewCheck.id : null;
  const mode: SyllabusManageMode = viewCheck.kind === "none" ? "list" : viewCheck.kind === "invalid" ? "invalid-id" : "detail";
  const tab = parseSyllabusTab(params.get("tab"));

  const list = useSyllabusList(mode === "list");
  const { detail, versions, reload: reloadDetail } = useSyllabusDetail(syllabusId);
  const access = useContentAccess("OTHER"); // giáo trình thuộc module OTHER của ticket, như HSK cũ (TicketModule.OTHER)
  const write = useWriteGate("content");

  // Chỉ tải module khi đang ở tab Lịch trình và đã có chi tiết (như bản cũ); khoá = danh sách id buổi.
  const scheduleIds = useMemo(() => (tab === "schedule" && detail.kind === "ok" ? (detail.data.schedule ?? []).map((s) => s.id) : null), [tab, detail]);
  const modules = useScheduleModules(scheduleIds);
  const actions = useScheduleModuleActions(write.demo, modules.reload);

  const [keyword, setKeyword] = useState("");
  const items = useMemo(() => (list.state.kind === "ok" ? list.state.data : []), [list.state]);
  const filtered = useMemo(() => filterSyllabuses(items, keyword), [items, keyword]);
  const [addTarget, setAddTarget] = useState<SyllabusScheduleItem | null>(null);

  const openDetail = (id: string) => router.push(`${pathname}?view=${encodeURIComponent(id)}`);
  const backToList = () => router.push(pathname);
  const changeTab = (key: SyllabusTabKey) => {
    if (syllabusId === null) return;
    router.replace(`${pathname}?view=${encodeURIComponent(syllabusId)}&tab=${key}`, { scroll: false });
  };
  const reloadAll = () => {
    reloadDetail();
    if (scheduleIds !== null) modules.reload();
  };

  const moveModule = (scheduleId: string, moduleId: string, direction: -1 | 1) => {
    if (modules.state.kind !== "ok") return;
    const ids = movedIds(modules.state.data[scheduleId] ?? [], moduleId, direction);
    if (ids) void actions.reorder(scheduleId, ids);
  };
  // Bản cũ xoá ngay không hỏi; ở đây hỏi xác nhận (confirmAction) vì thao tác không hoàn tác được.
  const deleteModule = async (scheduleId: string, moduleId: string) => {
    const confirmed = await confirmAction({ title: "Xóa module ôn luyện?", content: "Module sẽ bị gỡ khỏi buổi học này; bộ nội dung trong kho không bị xóa.", okText: "Xóa", danger: true });
    if (confirmed) void actions.remove(scheduleId, moduleId);
  };
  const submitAdd = async (body: CreateScheduleModuleRequest) => {
    const done = await actions.add(body);
    if (done) setAddTarget(null);
    return done;
  };

  return (
    <>
      <SyllabusManageView
        mode={mode}
        access={access}
        writeEnabled={write.enabled}
        listState={list.state}
        keyword={keyword}
        filtered={filtered}
        onKeywordChange={setKeyword}
        onOpen={openDetail}
        onRetryList={list.reload}
        detailState={detail}
        versionsState={versions}
        tab={tab}
        onTabChange={changeTab}
        onBack={backToList}
        onReloadDetail={reloadAll}
        modulesState={modules.state}
        busyScheduleId={actions.busyScheduleId}
        onRetryModules={modules.reload}
        onAddModule={setAddTarget}
        onMoveModule={moveModule}
        onDeleteModule={(scheduleId, moduleId) => void deleteModule(scheduleId, moduleId)}
      />
      {/* `key` theo buổi: mỗi lần mở là một form mới (không cần effect reset state). */}
      <AddScheduleModuleModal key={addTarget?.id ?? "closed"} schedule={addTarget} busy={addTarget !== null && actions.busyScheduleId === addTarget.id} onCancel={() => setAddTarget(null)} onSubmit={submitAdd} />
    </>
  );
}
