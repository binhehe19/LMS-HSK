"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";

/**
 * Trạng thái một lần tải. `waiting` = dịch vụ chưa cấu hình (WAITING FOR BACKEND), khác `error` (đã gọi nhưng thất bại).
 * Không có dữ liệu mẫu thay thế khi chưa có/lỗi.
 */
export type FetchState<T> = { kind: "loading" } | { kind: "ok"; data: T } | { kind: "waiting" } | { kind: "error"; message: string };

type Settled<T> = { token: string } & ({ kind: "ok"; data: T } | { kind: "waiting" } | { kind: "error"; message: string });

/**
 * Tải dữ liệu theo một khoá (trang + bộ lọc...). Khoá đổi => tải lại; phản hồi của khoá cũ bị bỏ; `key = null` => không tải (vd. modal đóng).
 * "Đang tải" được SUY RA (chưa có kết quả cho khoá hiện tại) nên không cần setState đồng bộ trong effect.
 * `lastData` = kết quả thành công gần nhất (kể cả của khoá trước) để giữ ổn định các phần không thuộc danh sách khi đang tải trang khác (vd. thanh phân trang không biến mất).
 * `reload()` tải lại cùng khoá. Lỗi/thiếu cấu hình được phân loại; việc báo toast do hàm `load` của người gọi quyết định.
 */
export function useKeyedFetch<T>(key: string | null, load: () => Promise<T>, { keepDataOnReload = false } = {}): { state: FetchState<T>; reload: () => void; lastData: T | null } {
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [lastData, setLastData] = useState<T | null>(null);
  const run = useEffectEvent(load);
  const token = key === null ? null : `${key}#${tick}`;

  useEffect(() => {
    if (token === null) return;
    let cancelled = false;
    run().then(
      (data) => {
        if (cancelled) return;
        setSettled({ token, kind: "ok", data });
        setLastData(data);
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiNotConfiguredError) setSettled({ token, kind: "waiting" });
        else setSettled({ token, kind: "error", message: error instanceof ApiError ? error.message : "Không tải được dữ liệu." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const retained = keepDataOnReload && key !== null && settled?.kind === "ok"
    && settled.token.slice(0, settled.token.lastIndexOf("#")) === key;
  const state: FetchState<T> = settled !== null && (settled.token === token || retained) ? settled : { kind: "loading" };
  return { state, reload, lastData };
}
