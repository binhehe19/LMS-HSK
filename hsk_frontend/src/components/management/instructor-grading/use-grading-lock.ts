"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { acquireGradingLock, releaseGradingLock } from "@/lib/api/assessment-grading-client";

// held: đang giữ khoá chấm (được lưu điểm); denied: người khác đang chấm bài này; error: không kết nối được; checking: đang xin khoá.
export type GradingLockState = "checking" | "held" | "denied" | "error";

const RENEW_MS = 20_000;

/**
 * Khoá chấm của một bài: một người chấm một bài tại một thời điểm (backend `/management/assessment-attempts/{id}/lock`).
 * Xin khoá khi `enabled`, gia hạn định kỳ, nhả khi rời trang. `sessionToken` do hook giữ và dùng cho cả lần lưu điểm.
 */
export function useGradingLock(attemptId: string, enabled = true) {
  const [sessionToken] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<GradingLockState>("checking");
  const [holder, setHolder] = useState<string | null>(null);
  const cancelled = useRef(false);

  const apply = useCallback((res: { acquired: boolean; holderUserId: string | null }) => {
    setState(res.acquired ? "held" : "denied");
    setHolder(res.acquired ? null : res.holderUserId);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    cancelled.current = false;
    const renew = () =>
      acquireGradingLock(attemptId, sessionToken)
        .then((res) => {
          if (!cancelled.current) apply(res);
        })
        .catch(() => {
          if (!cancelled.current) setState("error");
        });
    void renew();
    const id = setInterval(renew, RENEW_MS);
    return () => {
      cancelled.current = true;
      clearInterval(id);
      releaseGradingLock(attemptId, sessionToken).catch(() => {});
    };
  }, [attemptId, sessionToken, enabled, apply]);

  /** Giành quyền chấm từ người đang giữ khoá (họ sẽ bị ngắt ở lần lưu kế tiếp). */
  const takeOver = useCallback(async () => {
    try {
      apply(await acquireGradingLock(attemptId, sessionToken, true));
      return true;
    } catch {
      return false;
    }
  }, [attemptId, sessionToken, apply]);

  return { sessionToken, state, holder, takeOver };
}
