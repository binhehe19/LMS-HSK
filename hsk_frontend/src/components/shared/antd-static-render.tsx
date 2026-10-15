"use client";

import { unstableSetRender } from "antd";
import { createRoot, type Root } from "react-dom/client";

// antd 5 + React 19: các API tĩnh (Modal.confirm dùng trong confirmAction, message, notification) tự render vào một container riêng bằng
// ReactDOM.render cũ, không còn trong React 19 => không hiện gì. antd ≥ 5.23 cung cấp `unstableSetRender` để trỏ sang createRoot; đây đúng là
// nội dung của gói @ant-design/v5-patch-for-react-19, viết tại chỗ để không thêm thư viện. Chạy một lần khi module được nạp ở trình duyệt.
type RootContainer = Element | DocumentFragment;
const roots = new WeakMap<RootContainer, Root>();

let installed = false;
export function installAntdStaticRender(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  unstableSetRender((node, container) => {
    const target = container as RootContainer;
    let root = roots.get(target);
    if (!root) {
      root = createRoot(target);
      roots.set(target, root);
    }
    root.render(node);
    return async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      roots.get(target)?.unmount();
      roots.delete(target);
    };
  });
}

installAntdStaticRender();

/** Thành phần rỗng để root layout (server component) nạp module này ở phía client. */
export function AntdStaticRender() {
  return null;
}
