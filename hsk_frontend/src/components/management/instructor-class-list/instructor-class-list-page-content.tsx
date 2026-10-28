"use client";

import { useMemo, useState } from "react";
import { InstructorClassListView } from "@/components/management/instructor-class-list/instructor-class-list-view";
import { useTeacherClasses } from "@/components/management/instructor-class-list/use-teacher-classes";
import type { TimeFilterMode } from "@/lib/class-list/class-list-filters";
import {
  CLASS_LIST_PAGE_SIZE,
  EMPTY_FILTERS,
  classOptions,
  courseOptions,
  filterClasses,
  todayInputValue,
  type ClassListFilters,
} from "@/lib/class-list/class-list-model";

// Màn "Quản lý lớp học" của Giảng viên/Cố vấn (HSK cũ: ClassListPage). Lọc/sắp xếp/phân trang làm phía client như bản cũ; state là state cục bộ.
export function InstructorClassListPageContent() {
  const { state, reload } = useTeacherClasses();
  const classes = useMemo(() => (state.kind === "ok" ? state.classes : []), [state]);
  const [filters, setFilters] = useState<ClassListFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const courses = useMemo(() => courseOptions(classes), [classes]);
  const classChoices = useMemo(() => classOptions(classes, filters.course), [classes, filters.course]);
  const filtered = useMemo(() => filterClasses(classes, filters), [classes, filters]);

  // Đổi bất kỳ bộ lọc nào => về trang 1 (bản cũ làm bằng effect). Trang hiện tại luôn nằm trong [1, số trang] kể cả khi dữ liệu tải lại ít hơn.
  const lastPage = Math.max(1, Math.ceil(filtered.length / CLASS_LIST_PAGE_SIZE));
  const currentPage = Math.min(page, lastPage);
  const change = (patch: Partial<ClassListFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  return (
    <InstructorClassListView
      state={state}
      total={classes.length}
      filters={filters}
      courseOptions={courses}
      classOptions={classChoices}
      filtered={filtered}
      page={currentPage}
      onCourseChange={(course) => change({ course, classId: "" })}
      onClassChange={(classId) => change({ classId })}
      onTimeModeChange={(timeMode: TimeFilterMode) => change({ timeMode, ...(timeMode === "EXACT" && !filters.exactDate ? { exactDate: todayInputValue() } : {}) })}
      onExactDateChange={(exactDate) => change({ exactDate })}
      onPageChange={setPage}
      onRetry={reload}
    />
  );
}
