"use client";

import { useMemo, useState } from "react";
import { OnlineCourseDetailModal } from "@/components/management/online-course-management/online-course-detail-modal";
import { OnlineCourseFormModal } from "@/components/management/online-course-management/online-course-form-modal";
import { OnlineCourseSyncModal } from "@/components/management/online-course-management/online-course-sync-modal";
import { OnlineCourseView } from "@/components/management/online-course-management/online-course-view";
import { useOnlineCourses } from "@/components/management/online-course-management/use-online-courses";
import { confirmAction } from "@/components/shared/confirm-action";
import { courseName, DEFAULT_COURSE_FILTERS, filterCourses, formFromCourse, type CourseFilters, type CourseFormValues } from "@/lib/online-course/online-course-model";
import type { OnlineCourseSummary } from "@/types/online-course";

/**
 * Container màn /learning-path/online-course/manage (HSK cũ: OnlineCourseManagementPage, chỉ ADMIN ở app mới): nối hook dữ liệu với view thuần,
 * bộ lọc phía client (state cục bộ, như bản cũ) và các modal. Xác nhận xoá dùng `confirmAction` (antd Modal.confirm) thay cho modal react-bootstrap.
 */
export function OnlineCourseManagementPageContent() {
  const oc = useOnlineCourses();
  const [filters, setFilters] = useState<CourseFilters>(DEFAULT_COURSE_FILTERS);
  const [editing, setEditing] = useState<{ course: OnlineCourseSummary; key: number } | null>(null);
  const filtered = useMemo(() => filterCourses(oc.courses, filters), [oc.courses, filters]);

  const submitEdit = async (values: CourseFormValues) => {
    if (editing && (await oc.update(editing.course, values))) setEditing(null);
  };

  const remove = async (course: OnlineCourseSummary) => {
    const ok = await confirmAction({
      title: "Xác Nhận Xóa",
      content: (
        <p className="text-muted mb-0">
          Khóa học <strong>&quot;{courseName(course)}&quot;</strong> sẽ bị xóa vĩnh viễn khỏi hệ thống. Thao tác này không thể hoàn tác.
        </p>
      ),
      okText: "Đồng ý xóa",
      cancelText: "Quay lại",
      danger: true,
    });
    if (ok) await oc.remove(course);
  };

  return (
    <>
      <OnlineCourseView
        state={oc.state}
        courses={oc.courses}
        filtered={filtered}
        refreshing={oc.refreshing}
        writeEnabled={oc.writeEnabled}
        busy={oc.busy}
        syncing={oc.syncing}
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={() => setFilters(DEFAULT_COURSE_FILTERS)}
        onSync={() => void oc.startSync()}
        onOpenDetail={oc.openDetail}
        onEdit={(course) => setEditing((prev) => ({ course, key: (prev?.key ?? 0) + 1 }))}
        onDelete={(course) => void remove(course)}
        onRetry={oc.reload}
      />

      <OnlineCourseDetailModal open={oc.detailCourse !== null} state={oc.detailState} onClose={oc.closeDetail} onRetry={oc.retryDetail} />

      {editing && <OnlineCourseFormModal key={editing.key} initialValues={formFromCourse(editing.course)} submitting={oc.busy} onCancel={() => setEditing(null)} onSubmit={(values) => void submitEdit(values)} />}

      <OnlineCourseSyncModal open={oc.syncModalOpen} job={oc.syncJob} syncing={oc.syncing} onClose={oc.closeSyncModal} />
    </>
  );
}
