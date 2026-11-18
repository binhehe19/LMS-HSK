"use client";

// Tiêu đề của buổi đang chọn, đặt ở đầu vùng nội dung (bên phải dãy buổi): có tên thì tên là dòng lớn và "Buổi n" nhỏ hơn ngay dưới; chưa có tên thì chỉ
// "Buổi n". Có `onRename` thì có nút đặt/đổi tên sát ngay sau tên (tên rỗng = xóa tên). `actions` là nút phụ cùng hàng, sát mép phải.
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./package-workspace.module.css";

/** Cùng giới hạn với backend (tên buổi tối đa 200 ký tự). */
const MAX_NAME_LENGTH = 200;

interface Props {
  sessionNo: number;
  title?: string;
  /** Bên gọi báo lỗi và ném lại để giữ ô nhập khi lưu thất bại. */
  onRename?: (sessionNo: number, title: string) => Promise<void>;
  actions?: ReactNode;
}

export function SessionHeading({ sessionNo, title, onRename, actions }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Buổi đang được đổi tên; ô nhập chỉ mở khi đúng là buổi đang chọn nên đổi buổi thì ô nhập tự đóng.
  const [editingNo, setEditingNo] = useState<number | null>(null);
  const editing = editingNo === sessionNo;
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEdit = () => {
    setDraft(title ?? "");
    setEditingNo(sessionNo);
  };

  const save = async () => {
    if (!onRename) return;
    setSaving(true);
    try {
      await onRename(sessionNo, draft.trim());
      setEditingNo(null);
    } catch {
      // Bên gọi đã báo lỗi; giữ ô nhập để người dùng sửa lại.
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form
        className={styles.sessionHeading}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <input
          ref={inputRef}
          className="form-control form-control-sm"
          value={draft}
          maxLength={MAX_NAME_LENGTH}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditingNo(null);
          }}
          aria-label={`Tên buổi ${sessionNo}`}
          placeholder="Tên buổi (để trống để xóa)"
        />
        <button type="submit" className={`btn btn-sm btn-outline-primary ${styles.headingButton}`} disabled={saving} aria-label="Lưu tên buổi">
          <i className="isax isax-tick-circle" aria-hidden="true" />
        </button>
        <button type="button" className={`btn btn-sm btn-outline-secondary ${styles.headingButton}`} disabled={saving} onClick={() => setEditingNo(null)} aria-label="Hủy đổi tên">
          <i className="isax isax-close-circle" aria-hidden="true" />
        </button>
      </form>
    );
  }

  return (
    <div className={styles.sessionHeading}>
      <div className={styles.sessionHeadingMain}>
        <div className={styles.sessionHeadingRow}>
          <h5 className={styles.sessionHeadingTitle}>{title ?? `Buổi ${sessionNo}`}</h5>
          {onRename && (
            <button type="button" className={styles.renameLink} onClick={startEdit} aria-label={title ? "Đổi tên buổi" : "Đặt tên buổi"} title={title ? "Đổi tên buổi" : "Đặt tên buổi"}>
              <i className="isax isax-edit-2" aria-hidden="true" />
              {!title && "Đặt tên"}
            </button>
          )}
        </div>
        {title && <span className={styles.sessionHeadingNo}>Buổi {sessionNo}</span>}
      </div>
      {actions && <div className={styles.sessionHeadingActions}>{actions}</div>}
    </div>
  );
}
