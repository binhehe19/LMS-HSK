"use client";

import { Dropdown } from "antd";
import { useState } from "react";
import type { StudentClass } from "@/lib/api/student-client";
import { loadTimetableClasses } from "./timetable-source";
import { useTimetableRead } from "./use-timetable-read";

export interface TimetableClassSelection {
  classes: StudentClass[] | null;
  selected: string;
  onSelect: (id: string) => void;
  error: string | null;
  reload: () => void;
}

export function TimetableClassMenu({ userId, selection, onNavigate }: {
  userId?: string;
  selection?: TimetableClassSelection;
  onNavigate: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const request = useTimetableRead(
    open && !selection && userId ? `${encodeURIComponent(userId)}:student:timetable-classes` : null,
    loadTimetableClasses,
    300_000,
  );
  const classes = selection ? selection.classes : request.data;
  const select = selection?.onSelect ?? onNavigate;

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomLeft"
      open={open}
      onOpenChange={setOpen}
      menu={{
        selectable: true,
        selectedKeys: selection ? [selection.selected] : [],
        style: { maxWidth: "min(340px, calc(100vw - 32px))", maxHeight: 300, overflowY: "auto" },
        items: [
          { key: "ALL", label: "Tất cả lớp" },
          ...(classes ?? []).map(course => ({
            key: course.id,
            label: (
              <span className="student-timetable-menu-label">
                <strong>{course.code || course.id}</strong>
                {(course.syllabusName || course.courseName) && <small>{course.syllabusName || course.courseName}</small>}
              </span>
            ),
          })),
          ...((selection ? selection.error : request.error) ? [{ key: "retry", label: "Thử tải lại danh sách" }]
            : !classes ? [{ key: "loading", label: "Đang tải danh sách lớp…", disabled: true }]
            : !classes.length ? [{ key: "empty", label: "Chưa có lớp học", disabled: true }] : []),
        ],
        onClick: ({ key }) => {
          if (key === "retry") {
            (selection?.reload ?? request.reload)();
            return;
          }
          setOpen(false);
          select(key);
        },
      }}
    >
      <button type="button" className={`student-timetable-menu-trigger${selection ? " is-labeled" : ""}`} aria-label="Chọn lớp trong Thời khóa biểu" aria-current={selection ? "page" : undefined} aria-haspopup="menu" aria-expanded={open}>
        {selection && <span>Thời khóa biểu</span>}
        <i className="fa-solid fa-chevron-down" aria-hidden="true" />
      </button>
    </Dropdown>
  );
}
