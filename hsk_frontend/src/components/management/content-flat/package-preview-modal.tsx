"use client";

import { Modal, Spin } from "antd";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { packageLinks, packageResourceTitle } from "@/lib/api/package-management-client";
import type { ContentPackage } from "@/types/content";
import styles from "./content-catalog.module.css";

export function PackagePreviewModal({ pkg, syllabusName, onClose }: {
  pkg: ContentPackage;
  syllabusName?: string;
  onClose: () => void;
}) {
  const resources = useKeyedFetch(`catalog-preview:${pkg.id}`, () => packageLinks(pkg.id));
  const { state } = resources;

  return (
    <Modal open centered title={pkg.name || pkg.id} onCancel={onClose} footer={null}>
      <p className={styles.summary}>{syllabusName ? `Giáo trình: ${syllabusName}` : "Học phần tự do"}</p>
      {pkg.description && <p>{pkg.description}</p>}
      <h3 className="h6">Học liệu theo buổi</h3>
      {state.kind === "ok" && (state.data.length > 0 ? (
        <ul className="list-group" style={{ maxHeight: 320, overflowY: "auto" }}>
          {state.data.map(row => (
            <li key={row.id} className="list-group-item">
              <span className="text-muted">Buổi {row.sessionNo} · </span>{packageResourceTitle(row)}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted mb-0">Chưa có học liệu.</p>)}
      {state.kind === "loading" && <div role="status" className="d-flex align-items-center gap-2 text-muted"><Spin size="small" /> Đang tải học liệu…</div>}
      <FetchStateNotice state={state} waitingText="Chưa kết nối được API học liệu." onRetry={resources.reload} />
    </Modal>
  );
}
