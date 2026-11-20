"use client";

import { Button } from "antd";
import type { ReactNode } from "react";
import styles from "./content-catalog.module.css";

export function CatalogToolbar({ label, heading, icon, description, actions, onReload, onClearFilters, loading, children }: {
  label: string;
  heading: string;
  icon: string;
  description: string;
  actions?: ReactNode;
  onReload: () => void;
  onClearFilters: () => void;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel} aria-label={label}>
      <div className={`${styles.bar} ${styles.header} ${styles.banner}`}>
        <div className={styles.heading}>
          <span className={styles.headingIcon} aria-hidden="true"><i className={`isax ${icon}`} /></span>
          <div>
            <h1 className={styles.title}>{heading}</h1>
            <p className={styles.description}>{description}</p>
          </div>
        </div>
        <div className={styles.actions}>
          {actions}
          <button type="button" className={`btn btn-light rounded-pill ${styles.reloadButton}`} onClick={onReload} disabled={loading}>
            <i className="isax isax-refresh" aria-hidden="true" />Tải lại
          </button>
        </div>
      </div>
      <div className={`${styles.bar} ${styles.filters}`}>
        {children}
        <Button
          aria-label="Xóa bộ lọc"
          title="Xóa bộ lọc"
          icon={<i className="isax isax-eraser-1" aria-hidden="true" />}
          onClick={onClearFilters}
        />
      </div>
    </section>
  );
}
