"use client";

import { EllipsisOutlined } from "@ant-design/icons";
import { Dropdown, type MenuProps } from "antd";
import styles from "./content-catalog.module.css";

export function CatalogRowMenu({ label, items }: { label: string; items: MenuProps["items"] }) {
  return (
    <Dropdown trigger={["click"]} placement="bottomRight" menu={{ items, onClick: ({ domEvent }) => domEvent.stopPropagation() }}>
      <button type="button" className={`btn btn-sm btn-light rounded-3 ${styles.rowMenu}`} aria-label={label} aria-haspopup="menu" onClick={event => event.stopPropagation()}>
        <EllipsisOutlined aria-hidden="true" />
      </button>
    </Dropdown>
  );
}
