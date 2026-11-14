"use client";
// Sao chép từ frontend/ (cùng hợp đồng backend); sửa ở một nơi thì sửa nơi kia.

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/api-client";
import { getAttemptResult, type AssessmentAttemptResultResponse } from "@/lib/api/assessment-attempt-client";

const MAX_RETRY_DELAY_MS = 30_000;

interface UseAssessmentAttemptResult {
  result: AssessmentAttemptResultResponse | null;
  loading: boolean;
  error: string | null;
}

// Lấy kết quả bài làm và tự cập nhật đến khi chấm xong.
// - Gọi ngay 1 lần khi vào màn (phần chấm tự động thường xong trong vài giây).
// - Các lần sau lặp theo nextPollMs do server trả; nextPollMs = null (đã GRADED hoặc chỉ còn chờ giáo viên) thì dừng.
// - Tab ẩn thì tạm dừng, hiện lại thì gọi ngay. 400/403/404 thì dừng (không có gì để chờ).
// - Lỗi mạng/5xx: giữ kết quả cũ, thử lại với thời gian chờ tăng dần.
export function useAssessmentAttemptResult(attemptId: string): UseAssessmentAttemptResult {
  const [result, setResult] = useState<AssessmentAttemptResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let paused = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    function schedule(delayMs: number) {
      timer = setTimeout(poll, delayMs);
    }

    async function poll() {
      timer = null;
      if (cancelled) return;
      if (document.hidden) {
        paused = true;
        return;
      }
      try {
        const data = await getAttemptResult(attemptId, controller.signal);
        if (cancelled) return;
        failures = 0;
        setResult(data);
        setError(null);
        setLoading(false);
        if (data.nextPollMs != null) schedule(data.nextPollMs);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && [400, 403, 404].includes(e.status)) {
          setError(e.message);
          setLoading(false);
          return;
        }
        failures += 1;
        setError(e instanceof Error ? e.message : "Không tải được kết quả");
        setLoading(false);
        schedule(Math.min(MAX_RETRY_DELAY_MS, 2_000 * 2 ** failures));
      }
    }

    function onVisibilityChange() {
      if (document.hidden || !paused) return;
      paused = false;
      poll();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    poll();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [attemptId]);

  return { result, loading, error };
}
