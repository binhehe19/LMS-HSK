"use client";
// Sao chép từ frontend/ (cùng hợp đồng backend); sửa ở một nơi thì sửa nơi kia.

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/api-client";
import type { AssessmentAttemptResponse, AnswerItem, HeartbeatAssessmentAttemptResponse } from "@/lib/api/assessment-attempt-client";
import {
  acquireLock,
  heartbeat,
  releaseLock,
  releaseLockOnUnload,
  submitAttempt,
} from "@/lib/api/assessment-attempt-client";

// checking: đang kết nối; acquired: giữ khoá, được ghi đáp án; denied: tab/thiết bị khác đang giữ khoá;
// error: không kết nối được máy chủ (khác với bị khoá); idle: bài đã nộp, không cần khoá.
export type LockState = "checking" | "acquired" | "denied" | "error" | "idle";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type SubmitStatus = "idle" | "submitting" | "submitted" | "error";

interface AssessmentAttemptSessionState {
  lockState: LockState;
  remainingSeconds: number | null;
  effectiveStatus: "IN_PROGRESS" | "TIME_OUT" | "SUBMITTED";
  saveStatus: SaveStatus;
  submitStatus: SubmitStatus;
  answers: Record<string, string>; // questionId → answerJson
  dirtyQuestionIds: Set<string>;   // câu nào chưa được lưu lên server
  setAnswer: (questionId: string, answerJson: string) => void;
  submitNow: () => Promise<void>;
  /** Giành lại phiên làm bài từ tab/thiết bị khác (tab kia sẽ bị ngắt ở lần lưu kế tiếp). */
  takeOver: () => Promise<void>;
  /** Thử kết nối lại (không ép) sau khi lỗi mạng hoặc khi tab kia đã đóng. */
  retryLock: () => void;
}

const HEARTBEAT_INTERVAL_MS = 20_000;
const DEBOUNCE_MS = 1_500;
// Hết giờ thì tự nộp; nộp lỗi (mạng) thì thử lại vài lần. Quá số lần này job nền vẫn đóng và chấm bài theo đáp án đã lưu.
const AUTO_SUBMIT_RETRY_MS = 5_000;
const AUTO_SUBMIT_MAX_TRIES = 6;
const LOCK_KEY_PREFIX = "quiz-session-token-";
const BACKUP_KEY_PREFIX = "assessment-answers-backup-";

function getOrCreateSessionToken(attemptId: string): string {
  const key = LOCK_KEY_PREFIX + attemptId;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
  } catch {}
  const token = crypto.randomUUID();
  try {
    sessionStorage.setItem(key, token);
  } catch {}
  return token;
}

// Bản sao lưu cục bộ: toàn bộ đáp án + danh sách câu chưa lên server. Khi vào lại bài, chỉ các câu còn "chưa lên server"
// mới được áp lại (các câu khác luôn theo server, tránh đè bản mới hơn từ thiết bị khác).
interface AnswerBackup {
  answers: Record<string, string>;
  dirty: string[];
  savedAt: number;
}

function readBackup(attemptId: string): AnswerBackup | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY_PREFIX + attemptId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AnswerBackup>;
    if (!parsed || typeof parsed.answers !== "object" || !Array.isArray(parsed.dirty)) return null;
    return { answers: parsed.answers ?? {}, dirty: parsed.dirty, savedAt: parsed.savedAt ?? 0 };
  } catch {
    return null;
  }
}

function writeBackup(attemptId: string, answers: Record<string, string>, dirty: string[]) {
  try {
    const backup: AnswerBackup = { answers, dirty, savedAt: Date.now() };
    localStorage.setItem(BACKUP_KEY_PREFIX + attemptId, JSON.stringify(backup));
  } catch {}
}

function clearBackup(attemptId: string) {
  try {
    localStorage.removeItem(BACKUP_KEY_PREFIX + attemptId);
  } catch {}
}

// Đáp án ban đầu = đáp án đã lưu trên server (resume) + các câu trong bản sao lưu cục bộ chưa kịp lên server.
function buildInitialState(attempt: AssessmentAttemptResponse): { answers: Record<string, string>; dirtyIds: string[] } {
  const answers: Record<string, string> = {};
  for (const sa of attempt.savedAnswers) {
    answers[sa.questionId] = sa.answerJson;
  }
  const dirtyIds: string[] = [];
  if (attempt.status === "IN_PROGRESS") {
    const backup = readBackup(attempt.attemptId);
    if (backup) {
      for (const id of backup.dirty) {
        const local = backup.answers[id];
        if (local !== undefined && local !== answers[id]) {
          answers[id] = local;
          dirtyIds.push(id);
        }
      }
    }
  }
  return { answers, dirtyIds };
}

export function useAssessmentAttemptSession(attempt: AssessmentAttemptResponse): AssessmentAttemptSessionState {
  const { attemptId } = attempt;
  const [sessionTokenValue] = useState(() => getOrCreateSessionToken(attemptId));

  const [initial] = useState(() => buildInitialState(attempt));
  const [answers, setAnswers] = useState<Record<string, string>>(initial.answers);
  const answersRef = useRef(answers);

  // Mỗi lần đổi đáp án một câu thì tăng "phiên bản" của câu đó; heartbeat chụp phiên bản lúc gửi và chỉ coi câu đã lưu
  // khi phiên bản vẫn còn khớp — nên câu vừa sửa trong lúc request đang bay không bao giờ bị xoá cờ "chưa lưu" oan.
  const revisionsRef = useRef<Record<string, number>>(Object.fromEntries(initial.dirtyIds.map((id) => [id, 1])));
  const savedRevisionsRef = useRef<Record<string, number>>({});
  const [dirtyQuestionIds, setDirtyQuestionIds] = useState<Set<string>>(() => new Set(initial.dirtyIds));

  const [lockState, setLockState] = useState<LockState>(attempt.status === "SUBMITTED" ? "idle" : "checking");
  const [lockRetry, setLockRetry] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>(
    attempt.status === "SUBMITTED" ? "submitted" : "idle"
  );
  const [effectiveStatus, setEffectiveStatus] = useState<"IN_PROGRESS" | "TIME_OUT" | "SUBMITTED">(
    attempt.status as "IN_PROGRESS" | "TIME_OUT" | "SUBMITTED"
  );

  // Đồng hồ đếm ngược — dùng performance.now() để tránh drift khi tab bị throtlled.
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(attempt.remainingSeconds ?? null);
  const countdownRef = useRef<{ startRemaining: number; startPerf: number } | null>(null);
  useEffect(() => {
    if (attempt.remainingSeconds == null) return;
    countdownRef.current = { startRemaining: attempt.remainingSeconds, startPerf: performance.now() };
    const id = setInterval(() => {
      if (!countdownRef.current) return;
      const elapsed = (performance.now() - countdownRef.current.startPerf) / 1000;
      const remaining = Math.max(0, countdownRef.current.startRemaining - elapsed);
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        setEffectiveStatus((prev) => (prev === "SUBMITTED" ? prev : "TIME_OUT"));
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Theo dõi câu chưa lưu ─────────────────────────────────────────────────

  const computeDirtyIds = useCallback((): string[] => {
    const saved = savedRevisionsRef.current;
    return Object.keys(revisionsRef.current).filter((id) => revisionsRef.current[id] > (saved[id] ?? 0));
  }, []);

  // Cập nhật tập "chưa lưu" hiển thị và bản sao lưu cục bộ theo trạng thái hiện tại.
  const syncDirty = useCallback(() => {
    const ids = computeDirtyIds();
    setDirtyQuestionIds(new Set(ids));
    writeBackup(attemptId, answersRef.current, ids);
  }, [attemptId, computeDirtyIds]);

  // ── Lock lifecycle ────────────────────────────────────────────────────────

  // Kết quả xin khoá: cập nhật trạng thái khoá và đồng hồ theo giờ server (còn lại = endsAt - serverNow, không phụ thuộc
  // giờ máy học sinh). Giữ trong ref để các lời gọi bất đồng bộ luôn dùng bản mới nhất.
  const applyLockResultRef = useRef<(res: { acquired: boolean; endsAt: string | null; serverNow: string }) => void>(
    () => {}
  );
  useEffect(() => {
    applyLockResultRef.current = (res) => {
      setLockState(res.acquired ? "acquired" : "denied");
      if (res.endsAt) {
        const remaining = Math.max(0, (new Date(res.endsAt).getTime() - new Date(res.serverNow).getTime()) / 1000);
        setRemainingSeconds(remaining);
        if (countdownRef.current) {
          countdownRef.current = { startRemaining: remaining, startPerf: performance.now() };
        }
      }
    };
  }, []);

  useEffect(() => {
    if (attempt.status === "SUBMITTED") return;

    let cancelled = false;
    acquireLock(attemptId, sessionTokenValue)
      .then((res) => {
        if (!cancelled) applyLockResultRef.current(res);
      })
      .catch(() => {
        if (!cancelled) setLockState("error");
      });

    return () => {
      cancelled = true;
      // Nhả khóa khi component unmount (chuyển trang trong ứng dụng).
      releaseLock(attemptId, sessionTokenValue).catch(() => {});
    };
  }, [attemptId, sessionTokenValue, attempt.status, lockRetry]);

  // Đóng tab / tải lại trang thì unmount không chạy: nhả khoá bằng request keepalive để lần vào lại không phải chờ hết hạn.
  useEffect(() => {
    function handlePageHide() {
      releaseLockOnUnload(attemptId, sessionTokenValue);
    }
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [attemptId, sessionTokenValue]);

  const takeOver = useCallback(async () => {
    setLockState("checking");
    try {
      applyLockResultRef.current(await acquireLock(attemptId, sessionTokenValue, true));
    } catch {
      setLockState("error");
    }
  }, [attemptId, sessionTokenValue]);

  const retryLock = useCallback(() => {
    setLockState("checking");
    setLockRetry((n) => n + 1);
  }, []);

  // ── Heartbeat + auto-save ─────────────────────────────────────────────────

  // Chụp các câu chưa lưu cùng phiên bản của chúng tại thời điểm gửi.
  const snapshotDirty = useCallback(() => {
    const ids = computeDirtyIds();
    return {
      items: ids.map((id): AnswerItem => ({ questionId: id, answerJson: answersRef.current[id] ?? "" })),
      revisions: ids.map((id) => [id, revisionsRef.current[id]] as const),
    };
  }, [computeDirtyIds]);

  const doHeartbeat = useCallback(async () => {
    if (lockState !== "acquired") return;
    const { items, revisions } = snapshotDirty();
    try {
      setSaveStatus(items.length > 0 ? "saving" : "idle");
      const res: HeartbeatAssessmentAttemptResponse = await heartbeat(attemptId, sessionTokenValue, items);
      if (!res.lockRenewed) {
        setLockState("denied");
        return;
      }
      if (items.length > 0) {
        if (res.savedAnswerIds.length >= items.length) {
          // Server xác nhận đã lưu đủ: chỉ đánh dấu đã lưu đúng phiên bản đã gửi (câu sửa tiếp trong lúc chờ vẫn là "chưa lưu").
          for (const [id, rev] of revisions) {
            savedRevisionsRef.current[id] = Math.max(savedRevisionsRef.current[id] ?? 0, rev);
          }
          syncDirty();
          setSaveStatus(computeDirtyIds().length > 0 ? "saving" : "saved");
        } else {
          setSaveStatus("error");
        }
      }
      if (res.remainingSeconds != null) {
        setRemainingSeconds(res.remainingSeconds);
        countdownRef.current = { startRemaining: res.remainingSeconds, startPerf: performance.now() };
      }
      setEffectiveStatus(res.effectiveStatus as "IN_PROGRESS" | "TIME_OUT" | "SUBMITTED");
    } catch {
      setSaveStatus("error");
    }
  }, [attemptId, sessionTokenValue, lockState, snapshotDirty, syncDirty, computeDirtyIds]);

  // Giữ phiên bản mới nhất của doHeartbeat cho các listener đăng ký một lần.
  const doHeartbeatRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    doHeartbeatRef.current = doHeartbeat;
  }, [doHeartbeat]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Tab bị ẩn thì lưu ngay những gì đang có (có thể là lần cuối trước khi đóng tab).
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") void doHeartbeatRef.current();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Cảnh báo khi có đáp án chưa lưu mà người dùng sắp rời trang.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyQuestionIds.size > 0) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyQuestionIds]);

  // Heartbeat định kỳ 20 giây.
  useEffect(() => {
    if (lockState !== "acquired" || effectiveStatus !== "IN_PROGRESS") return;
    const id = setInterval(doHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [doHeartbeat, lockState, effectiveStatus]);

  // Debounce 1.5s: lưu ngay khi người dùng dừng gõ (không chờ 20s).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerDebounce = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doHeartbeatRef.current();
    }, DEBOUNCE_MS);
  }, []);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────

  const setAnswer = useCallback((questionId: string, answerJson: string) => {
    const next = { ...answersRef.current, [questionId]: answerJson };
    answersRef.current = next;
    setAnswers(next);
    revisionsRef.current[questionId] = (revisionsRef.current[questionId] ?? 0) + 1;
    syncDirty();
    setSaveStatus("saving");
    triggerDebounce();
  }, [syncDirty, triggerDebounce]);

  const markSubmitted = useCallback(() => {
    revisionsRef.current = {};
    savedRevisionsRef.current = {};
    setDirtyQuestionIds(new Set());
    clearBackup(attemptId);
    setSaveStatus("saved");
    setSubmitStatus("submitted");
    setEffectiveStatus("SUBMITTED");
  }, [attemptId]);

  const submitNow = useCallback(async () => {
    setSubmitStatus("submitting");
    try {
      // Gửi TOÀN BỘ đáp án đang có (không chỉ phần "chưa lưu") để không phụ thuộc vào việc theo dõi cờ chưa lưu.
      const all: AnswerItem[] = Object.entries(answersRef.current).map(([questionId, answerJson]) => ({
        questionId,
        answerJson,
      }));
      await submitAttempt(attemptId, sessionTokenValue, all);
      markSubmitted();
    } catch (e: unknown) {
      // 409: đã nộp từ trước (VD tab khác) hoặc bài đã được đóng vì hết giờ — coi như đã nộp.
      if (e instanceof ApiError && e.status === 409) {
        markSubmitted();
        return;
      }
      setSubmitStatus("error");
    }
  }, [attemptId, sessionTokenValue, markSubmitted]);

  // Hết giờ: tự nộp (đáp án đang dở được gửi kèm), lỗi mạng thì thử lại vài lần.
  const autoSubmitTriesRef = useRef(0);
  useEffect(() => {
    if (effectiveStatus !== "TIME_OUT") return;
    if (submitStatus === "submitting" || submitStatus === "submitted") return;
    if (autoSubmitTriesRef.current >= AUTO_SUBMIT_MAX_TRIES) return;
    const delay = autoSubmitTriesRef.current === 0 ? 0 : AUTO_SUBMIT_RETRY_MS;
    const id = setTimeout(() => {
      autoSubmitTriesRef.current += 1;
      void submitNow();
    }, delay);
    return () => clearTimeout(id);
  }, [effectiveStatus, submitStatus, submitNow]);

  return {
    lockState,
    remainingSeconds,
    effectiveStatus,
    saveStatus,
    submitStatus,
    answers,
    dirtyQuestionIds,
    setAnswer,
    submitNow,
    takeOver,
    retryLock,
  };
}
