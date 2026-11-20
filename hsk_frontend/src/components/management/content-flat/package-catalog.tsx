"use client";

import { useState } from "react";
import { useKeyedFetch, type FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchErrorNotice, FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { listSyllabuses } from "@/lib/api/lms-syllabus-client";
import { clampPage, filterByKeyword, isPublished } from "@/lib/content/content-tree-model";
import type { ContentPackage } from "@/types/content";
import { DEFAULT_CATALOG_PAGE_SIZE } from "@/lib/content/catalog-page-sizes";
import { PackageCatalogTable, type PackageCatalogActions } from "./package-catalog-table";
import { PackageCatalogToolbar, type PackageFilters } from "./package-catalog-toolbar";
import { PackagePreviewModal } from "./package-preview-modal";
import styles from "./content-catalog.module.css";

const UNBOUND_SYLLABUS = "unbound";

export function PackageCatalog({ heading, icon, state, packages, onCreate, onOpenReadOnly, onRetry, ...actions }: PackageCatalogActions & {
  heading: string;
  icon: string;
  state: FetchState<ContentPackage[]>;
  packages: ContentPackage[];
  onCreate?: () => void;
  onOpenReadOnly?: (pkg: ContentPackage) => void;
  onRetry: () => void;
}) {
  const [filters, setFilters] = useState<PackageFilters>({ keyword: "" });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(DEFAULT_CATALOG_PAGE_SIZE);
  const [preview, setPreview] = useState<ContentPackage>();
  const syllabuses = useKeyedFetch(packages.some(pkg => pkg.syllabusId) ? "catalog-syllabuses" : null, listSyllabuses);
  const syllabusesById = new Map((syllabuses.state.kind === "ok" ? syllabuses.state.data : []).map(s => [s.id, s]));
  const syllabusName = (id: string) => {
    const entry = syllabusesById.get(id);
    return entry?.name || entry?.code || id;
  };
  const matches = filterByKeyword(packages, filters.keyword, pkg => [
    pkg.name, pkg.id, pkg.description, pkg.syllabusId ? syllabusName(pkg.syllabusId) : null,
  ]).filter(pkg =>
    (!filters.status || filters.status === (isPublished(pkg) ? "PUBLISHED" : "DRAFT")) &&
    (!filters.syllabus || filters.syllabus === (pkg.syllabusId ?? UNBOUND_SYLLABUS)) &&
    (!filters.level || filters.level === pkg.level),
  );
  const syllabusIds = [...new Set(packages.flatMap(pkg => pkg.syllabusId ? [pkg.syllabusId] : []))];
  const levels = [...new Set(packages.flatMap(pkg => pkg.level ? [pkg.level] : []))].sort();

  return (
    <div className={styles.catalog} data-testid="content-packages">
      <PackageCatalogToolbar
        heading={heading}
        icon={icon}
        filters={filters}
        onFilters={next => { setFilters(next); setPage(1); }}
        syllabuses={[
          { value: UNBOUND_SYLLABUS, label: "Học phần tự do" },
          ...syllabusIds.map(id => ({ value: id, label: syllabusName(id), code: syllabusesById.get(id)?.code })),
        ]}
        levels={levels}
        onCreate={onCreate}
        onReload={onRetry}
        loading={state.kind === "loading"}
        busy={actions.busy}
      />
      <section className={styles.panel} aria-label={`Danh sách học phần ${heading.toLowerCase()}`}>
        {state.kind === "waiting" ? (
          <div className="p-3"><FetchStateNotice state={state} waitingText="Chưa kết nối được API học phần." onRetry={onRetry} testId="content-packages-notice" /></div>
        ) : (
          <PackageCatalogTable
            {...actions}
            heading={heading}
            packages={state.kind === "error" ? [] : matches}
            loadError={state.kind === "error" ? <FetchErrorNotice title="Không thể tải danh sách học phần" description={state.message} onRetry={onRetry} testId="content-packages-notice" /> : undefined}
            page={clampPage(page, matches.length, size)}
            size={size}
            onPageChange={(next, nextSize) => { setPage(next); setSize(nextSize); }}
            loading={state.kind === "loading"}
            syllabusName={syllabusName}
            onPreview={onOpenReadOnly ?? setPreview}
          />
        )}
      </section>
      {preview && <PackagePreviewModal pkg={preview} syllabusName={preview.syllabusId ? syllabusName(preview.syllabusId) : undefined} onClose={() => setPreview(undefined)} />}
    </div>
  );
}
