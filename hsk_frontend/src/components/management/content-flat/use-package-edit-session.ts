"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { packageEditSessionClient, type PackageDraftFields } from "@/lib/api/package-edit-session-client";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";

export const PACKAGE_HEARTBEAT_MS = 20_000;
export const PACKAGE_IDLE_MS = 5 * 60_000;
const LOCK_TTL_MS = 60_000;

type Api = ReturnType<typeof packageEditSessionClient>;
type Draft = Awaited<ReturnType<Api["draft"]>>;
type Lease = {
  packageId: string;
  api: Api;
  expiresAt: number;
  draft?: Draft;
  flight?: Promise<unknown>;
};
type Status = "checking" | "ready" | "denied" | "lost" | "error" | "finished";
type State = { packageId: string; status: Status; draft?: Draft; message?: string };

export function usePackageEditSession(packageId: string | null) {
  const [state, setState] = useState<State>();
  const [attempt, setAttempt] = useState(0);
  const current = useRef<Lease | null>(null);

  useEffect(() => {
    if (!packageId) return;
    const lease: Lease = { packageId, api: packageEditSessionClient(packageId, crypto.randomUUID()), expiresAt: 0 };
    current.current = lease;
    let timer: number | undefined;
    const report = (status: Status, message?: string) => {
      if (current.current === lease) setState({ packageId, status, draft: lease.draft, message });
    };
    const release = () => {
      lease.expiresAt = 0;
      void Promise.resolve(lease.flight).catch(() => {}).then(() => lease.api.release()).catch(() => {});
    };
    const onPageHide = () => {
      if (lease.flight) release();
      else {
        lease.expiresAt = 0;
        lease.api.releaseOnUnload();
      }
      report("lost");
      current.current = null;
    };

    report("checking");
    lease.flight = Promise.resolve().then(async () => {
      if (current.current !== lease) return; // Strict Mode may dispose of the effect before the request starts.
      const started = Date.now();
      const result = await lease.api.acquire();
      if (current.current !== lease) return;
      if (!result.acquired) { report("denied"); return; }
      lease.expiresAt = started + LOCK_TTL_MS;
      lease.draft = await lease.api.draft();
      if (current.current !== lease) return;
      if (lease.expiresAt <= Date.now()) { report("lost"); return; }
      report("ready");
      timer = window.setInterval(() => {
        if (lease.expiresAt && lease.expiresAt <= Date.now()) {
          lease.expiresAt = 0;
          report("lost");
        }
      }, 1000);
    }).catch(error => {
      report("error", writeErrorMessage(error, "Không thể mở phiên chỉnh sửa."));
      release();
    }).finally(() => { lease.flight = undefined; });
    window.addEventListener("pagehide", onPageHide);

    return () => {
      current.current = null;
      window.clearInterval(timer);
      window.removeEventListener("pagehide", onPageHide);
      release();
    };
  }, [packageId, attempt]);

  const hasLock = useCallback(() => {
    const lease = current.current;
    return !!lease && lease.packageId === packageId && !!lease.draft && lease.expiresAt > Date.now();
  }, [packageId]);
  const run = async (
    fields?: PackageDraftFields,
    afterSave?: () => Promise<unknown>,
    finish?: "publish" | "discard",
    automatic = false,
  ): Promise<boolean> => {
    const lease = current.current;
    if (!lease || !hasLock() || (automatic && lease.flight)) return false;
    if (lease.flight) await lease.flight.catch(() => {});
    if (current.current !== lease || !hasLock() || lease.flight || !lease.draft) return false;
    const { id: versionId } = lease.draft;
    const started = Date.now();
    const work = async () => {
      const result = await lease.api.heartbeat(fields && { ...fields, versionId });
      if (current.current !== lease || !lease.expiresAt) return false;
      if (!result.acquired || started + LOCK_TTL_MS <= Date.now()) {
        lease.expiresAt = 0;
        setState({ packageId: lease.packageId, status: "lost", draft: lease.draft });
        return false;
      }
      lease.expiresAt = started + LOCK_TTL_MS;
      if (fields && !result.saved) throw new Error("Máy chủ chưa xác nhận lưu bản nháp.");
      await afterSave?.();
      if (current.current !== lease || !hasLock()) return false;
      if (finish === "publish") await lease.api.publish(versionId);
      if (finish === "discard") await lease.api.discard();
      if (finish) {
        lease.expiresAt = 0;
        if (current.current === lease) setState({ packageId: lease.packageId, status: "finished", draft: lease.draft });
      }
      return true;
    };
    const flight = work().finally(() => { lease.flight = undefined; });
    lease.flight = flight;
    return flight;
  };

  const active = state?.packageId === packageId ? state : undefined;
  return {
    status: packageId ? active?.status ?? "checking" : null,
    draft: active?.draft,
    message: active?.message,
    retry: () => setAttempt(previous => previous + 1),
    hasLock,
    run,
  };
}
