"use client";

import { FetchErrorNotice } from "@/components/shared/fetch-state-notice";

import { Avatar, Input, Select, Table, Tag, type TableColumnsType } from "antd";
import { useState } from "react";
import type { ClassListState } from "@/components/management/class-management/use-admin-classes";
import { CatalogPagination } from "@/components/management/content-flat/catalog-pagination";
import { CatalogRowMenu } from "@/components/management/content-flat/catalog-row-menu";
import styles from "@/components/management/content-flat/content-catalog.module.css";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { STATUS_CONFIG, computeShift, computeStatus, display, fmtDate } from "@/lib/class-management/class-display";
import { initials } from "@/lib/class-list/class-list-model";
import { DEFAULT_CATALOG_PAGE_SIZE } from "@/lib/content/catalog-page-sizes";
import { clampPage, paginate } from "@/lib/content/content-tree-model";
import type { GradingClassResponse } from "@/types/grading";

const STATUS_OPTIONS = ["Đang học", "Sắp khai giảng", "Đã kết thúc"].map(value => ({ value, label: value }));
const TEACHER_AVATAR_COLORS = [
  { backgroundColor: "#e0f2fe", color: "#0369a1" },
  { backgroundColor: "#f3e8ff", color: "#6b21a8" },
  { backgroundColor: "#d1fae5", color: "#047857" },
  { backgroundColor: "#fef3c7", color: "#92400e" },
];

interface ClassManagementViewProps {
  state: ClassListState;
  onRetry?: () => void;
  onOpenClass: (cls: GradingClassResponse) => void;
}

const shortTime = (time?: string) => time?.match(/^\d{1,2}:\d{2}/)?.[0] ?? time;
const dayName = (day?: string) => day && /^[2-7]$/.test(day) ? `T${day}` : day;

function ClassSchedule({ cls }: { cls: GradingClassResponse }) {
  const slots = cls.scheduleSlots?.filter(slot => slot.day || slot.startTime || slot.endTime);
  const hasSlots = !!slots?.length;
  const days = (cls.scheduleDays ?? "").split(",").map(day => day.trim()).filter(Boolean);
  const sharedShift = !hasSlots && cls.startTime ? computeShift(cls.startTime, cls.duration) : undefined;

  if (!hasSlots && !days.length && !sharedShift) return "—";

  return (
    <div className="d-flex flex-wrap align-items-start gap-1">
      {hasSlots ? slots.map(({ day, startTime, endTime }, index) => {
        const start = shortTime(startTime);
        const end = shortTime(endTime);
        const time = start || (end && `đến ${end}`);
        const duration = start && end ? `${start} – ${end}` : undefined;
        return (
          <Tag key={index} color="purple" className="m-0" title={duration}>
            {[dayName(day), time].filter(Boolean).join(" ")}
          </Tag>
        );
      }) : days.map(day => <Tag key={day} color="purple" className="m-0">{dayName(day)}</Tag>)}
      {sharedShift && <div className="w-100 text-nowrap text-muted">{sharedShift}</div>}
    </div>
  );
}

export function ClassManagementView({ state, onRetry, onOpenClass }: ClassManagementViewProps) {
  const classes = state.kind === "ok" ? state.classes : [];
  const loading = state.kind === "loading";
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_CATALOG_PAGE_SIZE);
  const query = keyword.trim().toLowerCase();
  const filtered = classes.filter(cls =>
    (!status || computeStatus(cls.startDate, cls.endDate, cls.actualEndDate) === status) &&
    (!query || [cls.classCode, cls.courseName, cls.teacherName].some(text => text?.toLowerCase().includes(query))),
  );
  const currentPage = clampPage(page, filtered.length, size);

  const columns: TableColumnsType<GradingClassResponse> = [
    { title: <span className="text-nowrap">STT</span>, key: "number", width: 56, align: "center", render: (_, _cls, index) => <span className={styles.rowNumber}>{(currentPage - 1) * size + index + 1}</span> },
    {
      title: "Lớp học", key: "code", width: 90,
      render: (_, cls) => <button type="button" className={`btn btn-link p-0 text-start text-nowrap ${styles.name}`} onClick={() => onOpenClass(cls)}>{display(cls.classCode)}</button>,
    },
    {
      title: "Giáo trình / Khóa học", key: "course",
      render: (_, cls) => <span className="d-block text-truncate" title={cls.courseName || undefined}>{display(cls.courseName)}</span>,
    },
    {
      title: "Giáo viên", key: "teacher", width: 208,
      render: (_, cls) => {
        const name = cls.teacherName?.trim();
        if (!name) return <span className="text-muted fst-italic text-nowrap">Chưa phân công</span>;
        const monogram = initials(name);
        const colorIndex = Array.from(name).reduce(
          (index, character) => (index * 31 + character.charCodeAt(0)) % TEACHER_AVATAR_COLORS.length,
          0,
        );
        return (
          <div className="d-flex align-items-center gap-2">
            <Avatar size={28} className="flex-shrink-0 fw-semibold" style={TEACHER_AVATAR_COLORS[colorIndex]} aria-hidden="true">
              {monogram}
            </Avatar>
            <span className="fw-medium text-truncate" title={name}>{name}</span>
          </div>
        );
      },
    },
    {
      title: "Lịch học", key: "schedule", width: 126,
      render: (_, cls) => <ClassSchedule cls={cls} />,
    },
    { title: "Khai giảng", key: "start", width: 108, render: (_, cls) => fmtDate(cls.startDate) },
    {
      title: "Trạng thái", key: "status", width: 126, align: "center",
      render: (_, cls) => {
        const value = computeStatus(cls.startDate, cls.endDate, cls.actualEndDate);
        const { color, bg } = STATUS_CONFIG[value];
        return <span className="acm-status-badge" style={{ color, background: bg }}>{value}</span>;
      },
    },
    {
      title: <span className="text-nowrap">Thao tác</span>, key: "actions", width: 92, align: "center", fixed: "right",
      render: (_, cls) => (
        <CatalogRowMenu label={`Thao tác ${display(cls.classCode)}`} items={[
          { key: "students", label: "Xem học viên", icon: <i className="isax isax-people" aria-hidden="true" />, onClick: () => onOpenClass(cls) },
        ]} />
      ),
    },
  ];

  return (
    <ManagementPageFrame>
      <div className={`${styles.catalog} p-3`}>
        <section className={styles.panel} aria-label="Bộ lọc lớp học">
          <div className={`${styles.header} ${styles.banner} acm-hero mb-0 rounded-0 shadow-none`}>
            <div className="acm-hero-content">
              <i className="isax isax-teacher acm-hero-icon" aria-hidden="true" />
              <div>
                <h1 className="acm-hero-title">Quản lý lớp học</h1>
                <p className="acm-hero-sub">Theo dõi tiến độ, chuyên cần và chất lượng toàn bộ lớp học</p>
              </div>
            </div>
            {onRetry && (
              <button type="button" className={`btn btn-light rounded-pill d-inline-flex align-items-center gap-2 ${styles.reloadButton}`} disabled={loading} onClick={onRetry}>
                <i className="isax isax-refresh" aria-hidden="true" />Tải lại
              </button>
            )}
          </div>
          <div className={`${styles.bar} ${styles.filters}`}>
            <Input className={styles.search} aria-label="Tìm lớp học" placeholder="Mã lớp, khóa học, giáo viên..." prefix={<i className="isax isax-search-normal-1" aria-hidden="true" />} allowClear value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1); }} />
            <Select className={styles.filter} popupClassName="package-select-popup" aria-label="Trạng thái" placeholder="Tất cả trạng thái" allowClear value={status} options={STATUS_OPTIONS} onChange={value => { setStatus(value); setPage(1); }} />
            {(keyword || status) && <button type="button" className="btn btn-sm btn-light" onClick={() => { setKeyword(""); setStatus(undefined); setPage(1); }}>Xóa bộ lọc</button>}
            <button type="button" className={`btn rounded-pill ${styles.refresh}`} disabled title="Chưa hỗ trợ xuất Excel">
              <i className="isax isax-export" aria-hidden="true" />Xuất Excel
            </button>
          </div>
        </section>

        <section className={styles.panel} aria-label="Danh sách lớp học">
          {state.kind === "not-integrated" ? (
            <div className="text-center text-muted p-4" role="status" data-testid={`acm-state-${state.kind}`}>
              <div className="fw-semibold mb-1">Chưa kết nối dữ liệu</div>
              <div className="small">{state.message}</div>
            </div>
          ) : (
            <>
              <Table
                className={styles.table}
                rowClassName="acm-row"
                rowKey="classId"
                columns={columns}
                dataSource={state.kind === "error" ? [] : paginate(filtered, currentPage, size)}
                loading={loading}
                pagination={false}
                tableLayout="fixed"
                scroll={{ x: 960 }}
                locale={{ emptyText: state.kind === "error"
                  ? <FetchErrorNotice title="Không thể tải danh sách lớp học" description={state.message} onRetry={onRetry} testId="acm-state-error" />
                  : "Không tìm thấy lớp học phù hợp" }}
              />
              {state.kind !== "error" && <CatalogPagination page={currentPage} size={size} total={filtered.length} showQuickJumper={false} onChange={(nextPage, nextSize) => { setPage(nextPage); setSize(nextSize); }} />}
            </>
          )}
        </section>
      </div>
    </ManagementPageFrame>
  );
}
