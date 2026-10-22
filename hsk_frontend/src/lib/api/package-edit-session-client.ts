import { getLmsApiBaseUrl, lmsClient } from "./lms-client";
import { bearerHeaders } from "@/lib/auth/dev-token-session";

type LockResponse = { acquired: boolean; saved: boolean };
export type PackageDraftFields = { title: string; description: string; sessionCount: number };

export function packageEditSessionClient(id: string, sessionToken: string) {
  const path = `/content-packages/${encodeURIComponent(id)}`;
  const query = new URLSearchParams({ sessionToken });
  const lockUrl = `${path}/lock?${query}`;
  return {
    acquire: () => lmsClient.post<LockResponse>(`${path}/lock`, { sessionToken }),
    draft: () => lmsClient.post<{ id: string; title: string | null; description?: string | null; sessionCount?: number | null }>(`${path}/draft`),
    heartbeat: (update?: PackageDraftFields & { versionId: string }) =>
      lmsClient.post<LockResponse>(`${path}/lock/heartbeat`, { sessionToken, ...update }),
    publish: (versionId: string) => lmsClient.post(`${path}/versions/${encodeURIComponent(versionId)}/publish?${query}`),
    discard: () => lmsClient.post(`${path}/discard-draft?${query}`),
    release: () => lmsClient.delete(lockUrl),
    releaseOnUnload: () => {
      void fetch(`${getLmsApiBaseUrl()}${lockUrl}`, {
        method: "DELETE", credentials: "include", headers: bearerHeaders(), keepalive: true,
      }).catch(() => {});
    },
  };
}
