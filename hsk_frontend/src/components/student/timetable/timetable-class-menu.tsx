"use client";

import { Dropdown } from "antd";
import { CalendarOutlined, TeamOutlined } from "@ant-design/icons";
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

export function TimetableClassMenu({ userId, selection, current, onNavigate }: {
  userId?: string;
  selection?: TimetableClassSelection;
  current?: "page" | "location";
  onNavigate: (id?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const request = useTimetableRead(
    !selection && userId ? `${encodeURIComponent(userId)}:student:timetable-classes` : null,
    loadTimetableClasses,
    300_000,
  );
  const classes = selection ? selection.classes : request.data;
  const error = selection ? selection.error : request.error;
  const select = selection?.onSelect ?? onNavigate;

  if (classes?.length === 1 || (!error && !classes?.length)) {
    const onlyClass = classes?.[0];
    const loading = !!userId && !classes;
    return (
      <button
        type="button"
        className="student-timetable-menu-trigger"
        aria-current={current}
        aria-busy={loading || undefined}
        disabled={loading}
        onClick={() => onlyClass ? select(onlyClass.id) : onNavigate()}
      >
        Thời khóa biểu
      </button>
    );
  }

  return (
    <Dropdown
      autoFocus
      trigger={["click"]}
      placement="bottomLeft"
      overlayClassName="student-timetable-dropdown"
      open={open}
      onOpenChange={setOpen}
      menu={{
        selectable: true,
        selectedKeys: selection ? [selection.selected] : [],
        items: [
          { key: "ALL", label: <strong>Tất cả lớp</strong>, icon: <CalendarOutlined aria-hidden="true" /> },
          ...(classes?.length ? [{ type: "divider" as const }] : []),
          ...(classes ?? []).map(course => ({
            key: course.id,
            icon: <TeamOutlined aria-hidden="true" />,
            label: (
              <span className="student-timetable-menu-label">
                <strong>{course.code || course.id}</strong>
                {(course.syllabusName || course.courseName) && <small>{course.syllabusName || course.courseName}</small>}
              </span>
            ),
          })),
          ...(error ? [{ key: "retry", label: "Thử tải lại danh sách" }] : []),
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
      <button type="button" className="student-timetable-menu-trigger" aria-current={current} aria-haspopup="menu" aria-expanded={open}>
        <span>Thời khóa biểu</span>
        <i className="fa-solid fa-chevron-down" aria-hidden="true" />
      </button>
    </Dropdown>
  );
}
