"use client";

// Ô tìm kiếm chức năng ở thanh đầu trang: gõ để lọc các mục menu của khu vực (không phân biệt hoa thường và dấu tiếng Việt), chọn bằng chuột hoặc
// ↑ ↓ Enter để chuyển trang; liên kết ngoài mở tab mới. Escape hoặc bấm ra ngoài thì đóng danh sách.
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { NavItem } from "@/components/management/management-nav";

const MAX_RESULTS = 8;

/** Bỏ dấu và hạ chữ thường để "luyen viet" khớp "Luyện viết (Hán tự)". */
const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

export function ManagementHeaderSearch({ items, onNavigate }: { items: NavItem[]; onNavigate?: (href: string) => void }) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return [];
    const matches = ({ title, header }: NavItem) =>
      fold(title).includes(needle) || Boolean(header && fold(header).includes(needle));
    return items
      .flatMap((item) => (item.children ?? [item]).filter((child) => matches(item) || matches(child)))
      .filter((item) => item.href && item.href !== "#")
      .slice(0, MAX_RESULTS);
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const go = (item: NavItem) => {
    setOpen(false);
    setQuery("");
    if (item.href.startsWith("http://") || item.href.startsWith("https://")) window.open(item.href, "_blank", "noopener,noreferrer");
    else if (onNavigate) onNavigate(item.href);
    else router.push(item.href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && open && results[active]) {
      event.preventDefault();
      go(results[active]);
    }
  };

  const showList = open && query.trim() !== "";

  return (
    <div className="management-header-search" ref={wrapperRef} role="search">
      <i className="isax isax-search-normal-1" aria-hidden="true" />
      <input
        type="search"
        value={query}
        placeholder="Tìm kiếm hoặc nhập lệnh…"
        aria-label="Tìm chức năng"
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="management-header-search-results" id={listId} role="listbox">
          {results.length === 0 ? (
            <li className="management-header-search-empty">Không tìm thấy chức năng phù hợp</li>
          ) : (
            results.map((item, index) => (
              <li key={`${item.href}-${index}`} role="option" aria-selected={index === active}>
                <button type="button" className={index === active ? "is-active" : undefined} onMouseEnter={() => setActive(index)} onClick={() => go(item)}>
                  <i className={item.icon} aria-hidden="true" />
                  <span>{item.title}</span>
                  {item.header && <small>{item.header}</small>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
