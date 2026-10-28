// Phép thử "độ trung thực CSS": chèn một DOM nhỏ gồm các thành phần/tiện ích của template (Bootstrap + SCSS của HSK cũ) vào trang rồi đọc style tính toán.
// Giá trị chuẩn (e2e/fixtures/css-golden.json) được ghi từ CHÍNH HSK cũ (React/Vite) bằng công cụ ngoài repo, nên so với nó nghĩa là so với HSK cũ.
//
// Vì sao cần: bộ xử lý CSS của Turbopack (lightningcss) làm rơi/đổi thứ tự một số rule của SCSS cũ (vd `.shadow-sm { ... !important }`, màu hover của nút) mà các màn đã chuyển
// không dùng tới nên so ảnh không bắt được. Test này bao phủ rộng hơn các màn hiện có để lỗi kiểu đó không lọt vào màn chuyển sau này.

/** Mỗi dòng là một phần tử (`<div class="...">`); một vài phần tử cần nội dung để có kích thước. */
export const PROBE_CLASSES: string[] = [
  // tiện ích bóng/viền/nền/chữ của template
  "shadow-sm", "shadow", "shadow-md", "shadow-lg", "shadow-none", "border border-primary", "border border-success", "border-0", "rounded", "rounded-3", "rounded-pill",
  "bg-primary", "bg-secondary", "bg-success", "bg-danger", "bg-warning", "bg-info", "bg-light", "bg-dark", "bg-white",
  "bg-primary-transparent", "bg-secondary-transparent", "bg-success-transparent", "bg-warning-transparent", "bg-danger-transparent", "bg-light-transparent",
  "bg-soft-primary", "bg-soft-light", "bg-soft-dark", "bg-primary bg-opacity-25", "bg-dark bg-opacity-50",
  "text-primary", "text-secondary", "text-success", "text-danger", "text-warning", "text-info", "text-muted", "text-gray-9", "text-gray-6", "text-title", "text-dark", "text-white bg-dark",
  "fs-12", "fs-14", "fs-16", "fs-18", "fw-semibold", "fw-bold",
  // nút
  "btn btn-primary", "btn btn-secondary", "btn btn-success", "btn btn-danger", "btn btn-warning", "btn btn-info", "btn btn-light", "btn btn-dark",
  "btn btn-outline-primary", "btn btn-outline-secondary", "btn btn-outline-danger", "btn btn-outline-dark", "btn btn-soft-primary", "btn btn-soft-success", "btn btn-soft-danger", "btn btn-soft-light",
  "btn btn-primary-ghost", "btn btn-danger-ghost", "btn btn-link", "btn btn-sm btn-primary", "btn btn-lg btn-primary", "btn btn-icon btn-primary", "btn btn-primary disabled",
  // badge, alert, card, progress
  "badge bg-primary", "badge bg-success", "badge badge-soft-primary", "badge badge-soft-success", "badge badge-soft-danger", "badge rounded-pill bg-danger",
  "alert alert-primary", "alert alert-success", "alert alert-warning", "alert alert-danger", "alert alert-info",
  "card", "card border-0 shadow-sm", "card-body", "card-header", "progress", "list-group-item",
  // avatar
  "avatar avatar-md", "avatar avatar-lg avatar-rounded", "avatar avatar-sm avatar-radius-0", "avatar avatar-xl",
];

/** Thuộc tính tính toán được so sánh (những thứ nhìn thấy được; không gồm kích thước phụ thuộc nội dung khác nhau giữa hai app). */
export const PROBE_PROPS: string[] = [
  "color", "background-color", "background-image", "background-position", "background-size", "background-repeat",
  "border-top-color", "border-top-width", "border-top-style", "border-right-color", "border-bottom-color", "border-left-color", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "box-shadow", "outline-color", "outline-style", "opacity", "display", "position", "overflow-x",
  "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "text-transform", "text-decoration-line", "text-align", "white-space", "cursor",
  "padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-right", "margin-bottom", "margin-left", "width", "height", "min-width", "z-index",
  "transition-property", "transition-duration", "filter", "backdrop-filter", "vertical-align", "flex-shrink", "align-items", "justify-content",
];

/** Chạy trong trang: chèn DOM thử, đọc style tính toán, gỡ DOM. Trả về [{cls, props}]. */
export function runProbe(args: { classes: string[]; props: string[] }): { cls: string; props: Record<string, string> }[] {
  const host = document.createElement("div");
  host.setAttribute("data-css-probe", "");
  host.style.cssText = "position:absolute;left:0;top:0;width:600px;visibility:hidden;pointer-events:none";
  for (const cls of args.classes) {
    const el = document.createElement("div");
    el.className = cls;
    el.textContent = "Mẫu";
    host.appendChild(el);
  }
  document.body.appendChild(host);
  const out = [...host.children].map((el, i) => {
    const cs = getComputedStyle(el);
    const props: Record<string, string> = {};
    for (const p of args.props) props[p] = cs.getPropertyValue(p);
    return { cls: args.classes[i], props };
  });
  host.remove();
  return out;
}

/** Bỏ khác biệt chỉ do cách ghi: `linear-gradient(..., A 0%, B 100%)` ≡ `linear-gradient(..., A, B)` (hai dừng mặc định). */
export function normalizeProbeValue(value: string): string {
  return value.replace(/ 0%(?=,)/g, "").replace(/, (rgb\([^)]*\)|#[0-9a-fA-F]+) 100%\)/g, ", $1)");
}

// ---- trạng thái :hover (cần chuột thật nên làm riêng) ----
export const HOVER_CLASSES: string[] = [
  "btn btn-primary", "btn btn-secondary", "btn btn-success", "btn btn-danger", "btn btn-warning", "btn btn-info", "btn btn-dark",
  "btn btn-outline-primary", "btn btn-outline-danger", "btn btn-soft-primary", "btn btn-soft-danger", "btn btn-primary-ghost", "btn btn-link",
];
export const HOVER_PROPS: string[] = ["color", "background-color", "background-image", "border-top-color", "box-shadow", "transform", "text-decoration-line"];

/** Chạy trong trang: chèn các nút nhìn thấy được ở góc trên trái để Playwright rê chuột lên. */
export function injectHoverProbe(classes: string[]): void {
  const host = document.createElement("div");
  host.setAttribute("data-css-hover-probe", "");
  host.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;display:flex;flex-direction:column;gap:6px;padding:6px;background:#fff";
  // Đọc giá trị cuối của :hover, không phải giá trị giữa chừng của transition.
  const style = document.createElement("style");
  style.textContent = "[data-css-hover-probe] *{transition:none!important}";
  host.appendChild(style);
  classes.forEach((cls, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = cls;
    el.setAttribute("data-probe-hover", String(i));
    el.textContent = "Nút";
    host.appendChild(el);
  });
  document.body.appendChild(host);
}
