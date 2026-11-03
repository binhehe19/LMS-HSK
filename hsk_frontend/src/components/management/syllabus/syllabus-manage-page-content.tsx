"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AddScheduleModuleModal } from "@/components/management/syllabus/add-schedule-module-modal";
import { SyllabusManageView, type SyllabusManageMode } from "@/components/management/syllabus/syllabus-manage-view";
import { movedResourceIds, useScheduleResourceActions, useScheduleResources } from "@/components/management/syllabus/use-schedule-resources";
import { useSyllabusDetail } from "@/components/management/syllabus/use-syllabus-detail";
import { useSyllabusList } from "@/components/management/syllabus/use-syllabus-list";
import { confirmAction } from "@/components/shared/confirm-action";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ROLES, hasAnyRole } from "@/lib/auth/roles";
import type { ScheduleResourceType } from "@/lib/syllabus/schedule-resource-types";
import { filterSyllabuses } from "@/lib/syllabus/syllabus-model";
import { checkSyllabusId, parseSyllabusTab, type SyllabusTabKey } from "@/lib/syllabus/syllabus-params";
import { useAppSelector } from "@/redux/hooks";
import type { SyllabusScheduleItem } from "@/types/lms";

// Màn "Quản lý Syllabus" (/learning-path/syllabus/manage; HSK cũ: SyllabusManagementPage bọc SyllabusManagementModal chế độ asPage, 4.345 dòng).
// Phạm vi RÚT GỌN có chủ đích (D-UI-3): danh sách + chi tiết giáo trình từ backend chung (chỉ đọc) và module ôn luyện theo buổi. Giáo trình đang xem
// và tab nằm trong URL (?view=&tab=) để tải lại / nút quay lại của trình duyệt về đúng chỗ: mở chi tiết = push (quay lại về danh sách), đổi tab = replace.
// Module ôn luyện theo buổi dùng nguyên /content-packages* + /learning-resources* của repo-lms (cơ chế của IELTS, không phải entity riêng) — MỌI
// endpoint đó chỉ ROLE_ADMIN ở backend, nên quyền sửa ở đây là `isAdmin` thẳng, không qua ticket module OTHER (khác bản đề xuất cũ).
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
  const roles = useAppSelector((state) => state.auth.user?.roles);
  const isAdmin = hasAnyRole(roles, [ROLES.ADMIN]);
  const write = useWriteGate("content");

  // Chỉ tải module khi đang ở tab Lịch trình và đã có chi tiết (như bản cũ); khoá = danh sách id buổi.
  const schedule = useMemo(() => (detail.kind === "ok" ? detail.data.schedule ?? [] : []), [detail]);
  const scheduleIds = useMemo(() => (tab === "schedule" && detail.kind === "ok" ? schedule.map((s) => s.id) : null), [tab, detail, schedule]);
  const sessionNoOf = useMemo(() => {
    const map = new Map(schedule.map((s, i) => [s.id, i + 1]));
    return (scheduleId: string) => map.get(scheduleId) ?? 1;
  }, [schedule]);
  const resources = useScheduleResources(syllabusId, scheduleIds, sessionNoOf);
  const actions = useScheduleResourceActions(write.demo, resources.reload);

  const [keyword, setKeyword] = useState("");
  const items = useMemo(() => (list.state.kind === "ok" ? list.state.data : []), [list.state]);
  const filtered = useMemo(() => filterSyllabuses(items, keyword), [items, keyword]);
  const [addTarget, setAddTarget] = useState<{ item: SyllabusScheduleItem; sessionNo: number } | null>(null);

  const openDetail = (id: string) => router.push(`${pathname}?view=${encodeURIComponent(id)}`);
  const backToList = () => router.push(pathname);
  const changeTab = (key: SyllabusTabKey) => {
    if (syllabusId === null) return;
    router.replace(`${pathname}?view=${encodeURIComponent(syllabusId)}&tab=${key}`, { scroll: false });
  };
  const reloadAll = () => {
    reloadDetail();
    if (scheduleIds !== null) resources.reload();
  };

  const moveResource = (scheduleId: string, type: ScheduleResourceType, resourceId: string, direction: -1 | 1) => {
    if (syllabusId === null || resources.state.kind !== "ok") return;
    const links = resources.state.data[scheduleId]?.[type] ?? [];
    const ids = movedResourceIds(links, resourceId, direction);
    if (ids) void actions.reorder(syllabusId, scheduleId, type, sessionNoOf(scheduleId), ids);
  };
  // Bản cũ xoá ngay không hỏi; ở đây hỏi xác nhận (confirmAction) vì thao tác không hoàn tác được.
  const deleteResource = async (scheduleId: string, type: ScheduleResourceType, resourceId: string) => {
    if (syllabusId === null) return;
    const confirmed = await confirmAction({ title: "Xóa module ôn luyện?", content: "Module sẽ bị gỡ khỏi buổi học này; bộ nội dung trong kho không bị xóa.", okText: "Xóa", danger: true });
    if (confirmed) void actions.remove(syllabusId, scheduleId, type, resourceId);
  };
  const submitAdd = async (type: ScheduleResourceType, sources: { id: string; label: string }[]) => {
    if (syllabusId === null || addTarget === null) return false;
    const done = await actions.add(syllabusId, addTarget.item.id, type, addTarget.sessionNo, sources);
    if (done) setAddTarget(null);
    return done;
  };

  return (
    <>
      <SyllabusManageView
        mode={mode}
        isAdmin={isAdmin}
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
        resourcesState={resources.state}
        busyScheduleId={actions.busyScheduleId}
        onRetryResources={resources.reload}
        onAddModule={(item, sessionNo) => setAddTarget({ item, sessionNo })}
        onMoveResource={moveResource}
        onDeleteResource={(scheduleId, type, resourceId) => void deleteResource(scheduleId, type, resourceId)}
      />
      {/* `key` theo buổi: mỗi lần mở là một form mới (không cần effect reset state). */}
      <AddScheduleModuleModal
        key={addTarget?.item.id ?? "closed"}
        schedule={addTarget?.item ?? null}
        sessionNo={addTarget?.sessionNo ?? 1}
        busy={addTarget !== null && actions.busyScheduleId === addTarget.item.id}
        onCancel={() => setAddTarget(null)}
        onSubmit={submitAdd}
      />
    </>
  );
}
