"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
const SEARCH_DELAY_MS = 400;

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
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(DEFAULT_CATALOG_PAGE_SIZE);
  const [preview, setPreview] = useState<ContentPackage>();
  const syllabuses = useKeyedFetch(packages.some(pkg => pkg.syllabusId) ? "catalog-syllabuses" : null, listSyllabuses);
  const syllabusData = syllabuses.state.kind === "ok" ? syllabuses.state.data : null;
  const syllabusesById = useMemo(() => new Map(syllabusData?.map(s => [s.id, s])), [syllabusData]);
  const syllabusName = useCallback((id: string) => {
    const entry = syllabusesById.get(id);
    return entry?.name || entry?.code || id;
  }, [syllabusesById]);

  const { keyword, status, syllabus, level } = filters;
  const query = keyword.trim();
  const searching = query !== appliedKeyword;
  useEffect(() => {
    if (!searching) return;
    const timer = window.setTimeout(() => {
      setAppliedKeyword(query);
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query, searching]);

  const matches = useMemo(() => filterByKeyword(packages, appliedKeyword, pkg => [
    pkg.name, pkg.id, pkg.description, pkg.syllabusId ? syllabusName(pkg.syllabusId) : null,
  ]).filter(pkg =>
    (!status || status === (isPublished(pkg) ? "PUBLISHED" : "DRAFT")) &&
    (!syllabus || syllabus === (pkg.syllabusId ?? UNBOUND_SYLLABUS)) &&
    (!level || level === pkg.level),
  ), [packages, appliedKeyword, syllabusName, status, syllabus, level]);
  const loading = state.kind === "loading";
  const syllabusIds = [...new Set(packages.flatMap(pkg => pkg.syllabusId ? [pkg.syllabusId] : []))];
  const levels = [...new Set(packages.flatMap(pkg => pkg.level ? [pkg.level] : []))].sort();

  return (
    <div className={styles.catalog} data-testid="content-packages">
      <PackageCatalogToolbar
        heading={heading}
        icon={icon}
        filters={filters}
        onFilters={next => {
          setFilters(next);
          if (!next.keyword.trim()) setAppliedKeyword("");
          if (!next.keyword.trim() || next.status !== status || next.syllabus !== syllabus || next.level !== level) setPage(1);
        }}
        syllabuses={[
          { value: UNBOUND_SYLLABUS, label: "Học phần tự do" },
          ...syllabusIds.map(id => ({ value: id, label: syllabusName(id), code: syllabusesById.get(id)?.code })),
        ]}
        levels={levels}
        onCreate={onCreate}
        onReload={onRetry}
        loading={loading}
        busy={actions.busy}
      />
      <section className={styles.panel} aria-label={`Danh sách học phần ${heading.toLowerCase()}`} aria-busy={loading || searching}>
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
            loading={loading || searching}
            syllabusName={syllabusName}
            onPreview={onOpenReadOnly ?? setPreview}
          />
        )}
      </section>
      {preview && <PackagePreviewModal pkg={preview} syllabusName={preview.syllabusId ? syllabusName(preview.syllabusId) : undefined} onClose={() => setPreview(undefined)} />}
    </div>
  );
}
