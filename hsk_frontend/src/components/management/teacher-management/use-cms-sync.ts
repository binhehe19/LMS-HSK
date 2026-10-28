"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WRITE_NOT_INTEGRATED_MESSAGE } from "@/components/management/teacher-management/use-teacher-management";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { fetchTeacherJobStatus, syncTeachersFromCms } from "@/lib/api/teacher-management-client";
import { WriteDisabledError } from "@/lib/api/write-gate";

export type SyncPhase = "idle" | "running" | "success" | "error";

export interface CmsSyncState {
  phase: SyncPhase;
  progress: number;
  message: string;
}

export const SYNC_IDLE_MESSAGE = "Hệ thống sẽ lấy dữ liệu giảng viên mới nhất từ CMS.";
const IDLE: CmsSyncState = { phase: "idle", progress: 0, message: SYNC_IDLE_MESSAGE };
const MAX_POLLS = 120; // ~2 phút với pollMs mặc định; quá hạn coi là lỗi thay vì quay vô hạn

/** Bước tiến của thanh tiến trình mỗi lần hỏi trạng thái (nhịp như setInterval 300ms cũ: nhanh lúc đầu, chậm dần, dừng ở 90 chờ máy chủ). */
export function nextSyncProgress(progress: number): number {
  if (progress >= 90) return progress;
  const step = progress < 40 ? 8 : progress < 70 ? 5 : 2;
  return Math.min(90, progress + step);
}

export interface CmsSyncOptions {
  /** Chu kỳ hỏi `/import/status` trong lúc đồng bộ (ms). */
  pollMs?: number;
  /** Tự đóng modal sau khi thành công (ms), như setTimeout 1800 của bản cũ. */
  autoCloseMs?: number;
}

/**
 * Máy trạng thái của modal "Đồng bộ dữ liệu từ CMS". Bản cũ: POST /sync đồng bộ + thanh tiến trình chạy bằng timer "cho đẹp".
 * Khác có chủ đích: POST /sync trả jobId, màn hình hỏi `/import/status` cho tới DONE/FAILED (tiến trình thật của máy chủ quyết định kết quả);
 * thanh tiến trình chỉ là chỉ báo (dừng ở 90% cho tới khi máy chủ báo xong). Đi qua write gate: công tắc đóng => lỗi "chưa tích hợp", không giả thành công.
 */
export function useCmsSync(demoActive: boolean, onSynced: () => void, { pollMs = 1000, autoCloseMs = 1800 }: CmsSyncOptions = {}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CmsSyncState>(IDLE);
  const timers = useRef<number[]>([]);
  const alive = useRef(true);
  const running = useRef(false);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimers();
    };
  }, []);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      timers.current.push(window.setTimeout(resolve, ms));
    });

  const openModal = () => {
    clearTimers();
    setState(IDLE);
    setOpen(true);
  };

  /** Đóng khi không đang chạy (maskClosable/closable của bản cũ cũng khoá lúc chạy). */
  const close = () => {
    if (running.current) return;
    clearTimers();
    setOpen(false);
    setState(IDLE);
  };

  const finish = (message?: string | null) => {
    setState({ phase: "success", progress: 100, message: message || "Đồng bộ thành công. Danh sách giảng viên đã được cập nhật." });
    toast.success("Đồng bộ CMS thành công", { id: "teacher-sync" });
    onSynced();
    timers.current.push(
      window.setTimeout(() => {
        if (!alive.current) return;
        setOpen(false);
        setState(IDLE);
      }, autoCloseMs),
    );
  };

  const failWith = (message: string) => {
    setState((prev) => ({ phase: "error", progress: Math.max(prev.progress, 25), message }));
    toast.error(message, { id: "teacher-sync" });
  };

  const start = async () => {
    if (running.current) return;
    running.current = true;
    setState({ phase: "running", progress: 8, message: "Đang kết nối CMS và đồng bộ dữ liệu..." });
    try {
      const started = await syncTeachersFromCms(demoActive);
      if (!alive.current) return;
      if (started.status === "DONE") {
        finish(started.message);
        return;
      }
      for (let polls = 0; polls < MAX_POLLS; polls++) {
        await wait(pollMs);
        if (!alive.current) return;
        const status = await fetchTeacherJobStatus();
        if (!alive.current) return;
        if (status.status === "FAILED") {
          failWith(status.message || "Không thể đồng bộ dữ liệu CMS.");
          return;
        }
        if (status.status === "DONE" || !status.inProgress) {
          finish(status.message);
          return;
        }
        setState((prev) => ({ ...prev, progress: nextSyncProgress(prev.progress) }));
      }
      failWith("Đồng bộ CMS quá lâu chưa hoàn tất. Hãy kiểm tra lại sau hoặc thử lại.");
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof WriteDisabledError || error instanceof ApiNotConfiguredError) failWith(WRITE_NOT_INTEGRATED_MESSAGE);
      else failWith(error instanceof ApiError ? error.message : "Không thể đồng bộ dữ liệu CMS.");
    } finally {
      running.current = false;
    }
  };

  return { open, state, syncing: state.phase === "running", openModal, close, start };
}
