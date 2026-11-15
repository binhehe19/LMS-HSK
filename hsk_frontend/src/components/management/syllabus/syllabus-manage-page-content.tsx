"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AddScheduleModuleModal } from "@/components/management/syllabus/add-schedule-module-modal";
import { SyllabusManageView, type SyllabusManageMode } from "@/components/management/syllabus/syllabus-manage-view";
import type { ScheduleTopicUi } from "@/components/management/syllabus/schedule-topic-ui";
import { movedResourceIdsInTopic, useScheduleResourceActions, useScheduleResources, useScheduleTopics } from "@/components/management/syllabus/use-schedule-resources";
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
  const topics = useScheduleTopics(syllabusId, scheduleIds, sessionNoOf);
  const reloadModules = () => {
    resources.reload();
    topics.reload();
  };
  const actions = useScheduleResourceActions(write.demo, reloadModules);

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
    if (scheduleIds !== null) reloadModules();
  };

  const moveResource = (scheduleId: string, type: ScheduleResourceType, resourceId: string, direction: -1 | 1) => {
    if (syllabusId === null || resources.state.kind !== "ok") return;
    const links = resources.state.data[scheduleId]?.[type] ?? [];
    const ids = movedResourceIdsInTopic(links, resourceId, direction);
    if (ids) void actions.reorder(syllabusId, scheduleId, type, sessionNoOf(scheduleId), ids);
  };
  // Bản cũ xoá ngay không hỏi; ở đây hỏi xác nhận (confirmAction) vì thao tác không hoàn tác được.
  const deleteResource = async (scheduleId: string, type: ScheduleResourceType, resourceId: string) => {
    if (syllabusId === null) return;
    const confirmed = await confirmAction({ title: "Xóa module ôn luyện?", content: "Module sẽ bị gỡ khỏi buổi học này; bộ nội dung trong kho không bị xóa.", okText: "Xóa", danger: true });
    if (confirmed) void actions.remove(syllabusId, scheduleId, type, resourceId);
  };
  const topicData = topics.state.kind === "ok" ? topics.state.data : null;
  const topicUi: ScheduleTopicUi = {
    topics: topicData,
    onCreate: (scheduleId, type, sessionNo, title) => (syllabusId === null ? Promise.resolve(false) : actions.createTopic(syllabusId, scheduleId, type, sessionNo, title)),
    onRename: (scheduleId, type, topicId, title) => (syllabusId === null ? Promise.resolve(false) : actions.renameTopic(syllabusId, scheduleId, type, topicId, title)),
    onDelete: async (scheduleId, type, topicId) => {
      if (syllabusId === null) return;
      const confirmed = await confirmAction({ title: "Xóa chủ đề?", content: "Chủ đề bị xóa; các module trong chủ đề vẫn còn trong buổi và chuyển về \"Chưa phân chủ đề\".", okText: "Xóa", danger: true });
      if (confirmed) void actions.deleteTopic(syllabusId, scheduleId, type, topicId);
    },
    onMove: (scheduleId, type, sessionNo, topicId, direction) => {
      if (syllabusId === null) return;
      const ids = (topicData?.[scheduleId]?.[type] ?? []).map((t) => t.id);
      const from = ids.indexOf(topicId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ids.length) return;
      [ids[from], ids[to]] = [ids[to], ids[from]];
      void actions.reorderTopics(syllabusId, scheduleId, type, sessionNo, ids);
    },
    onAssign: (scheduleId, type, resourceId, topicId) => {
      if (syllabusId !== null) void actions.assignTopic(syllabusId, scheduleId, type, resourceId, topicId);
    },
  };
  const submitAdd = async (type: ScheduleResourceType, sources: { id: string; label: string }[], topicId: string | null) => {
    if (syllabusId === null || addTarget === null) return false;
    const done = await actions.add(syllabusId, addTarget.item.id, type, addTarget.sessionNo, sources, topicId);
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
        topicUi={topicUi}
      />
      {/* `key` theo buổi: mỗi lần mở là một form mới (không cần effect reset state). */}
      <AddScheduleModuleModal
        key={addTarget?.item.id ?? "closed"}
        schedule={addTarget?.item ?? null}
        sessionNo={addTarget?.sessionNo ?? 1}
        busy={addTarget !== null && actions.busyScheduleId === addTarget.item.id}
        topicsOf={(type) => (addTarget ? topicData?.[addTarget.item.id]?.[type] ?? [] : [])}
        onCancel={() => setAddTarget(null)}
        onSubmit={submitAdd}
      />
    </>
  );
}
