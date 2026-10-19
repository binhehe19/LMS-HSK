// CSS toast chào mừng ticket. HSK cũ có hai bản gần như trùng nhau (tm-toast-* cho Admin/Teacher-manager, inst-toast-* cho giảng viên)
// chỉ khác vài giá trị màu/bóng; gộp thành MỘT bộ lớp, phần khác nhau nằm ở biến CSS của từng biến thể. Mọi số liệu lấy nguyên văn từ
// hai file cũ (teacher-manager-welcome-notification.tsx, instructor-welcome-notification.tsx). Giữ dạng thẻ <style> nội tuyến như bản cũ.
export const TICKET_WELCOME_TOAST_CSS = `
  @keyframes ticket-toast-in {
    0% { transform: translateY(-20px) scale(0.95); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }
  .ticket-toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 99999;
    width: 520px;
    max-width: 95vw;
    animation: ticket-toast-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
  .ticket-toast-container.is-manager {
    --tt-shadow: 0 12px 40px rgba(255, 77, 77, 0.2), 0 5px 15px rgba(0,0,0,0.08);
    --tt-border: rgba(255, 77, 77, 0.15);
    --tt-icon-bg: linear-gradient(135deg, #ff4d4d, #f9b115);
    --tt-stat-bg: rgba(255, 77, 77, 0.1);
    --tt-stat-color: #e63946;
    --tt-done-bg: rgba(249, 177, 21, 0.1);
    --tt-done-color: #d49100;
    --tt-progress-bg: linear-gradient(to right, #ff4d4d, #f9b115);
  }
  .ticket-toast-container.is-instructor {
    --tt-shadow: 0 12px 40px rgba(255, 77, 77, 0.15), 0 5px 15px rgba(0,0,0,0.08);
    --tt-border: rgba(255, 77, 77, 0.1);
    --tt-icon-bg: linear-gradient(135deg, #ff4c4c, #ff8c00);
    --tt-stat-bg: rgba(255, 77, 77, 0.08);
    --tt-stat-color: #ff4d4d;
    --tt-done-bg: rgba(0, 184, 148, 0.08);
    --tt-done-color: #00b894;
    --tt-progress-bg: linear-gradient(to right, #ff4d4d, #ff8c00);
  }
  .ticket-toast-bar {
    background: #fff;
    background: linear-gradient(to right, #ffffff, #fffafa);
    border-left: 6px solid #ff4d4d;
    border-radius: 10px;
    box-shadow: var(--tt-shadow);
    display: flex;
    align-items: center;
    padding: 16px 20px;
    position: relative;
    overflow: hidden;
    border: 1px solid var(--tt-border);
  }
  .ticket-toast-icon {
    width: 38px;
    height: 38px;
    background: var(--tt-icon-bg);
    color: white;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 18px;
    font-size: 18px;
    flex-shrink: 0;
    box-shadow: 0 4px 10px rgba(255, 77, 77, 0.3);
  }
  .ticket-toast-content {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-right: 15px;
  }
  .ticket-toast-title {
    font-size: 14px;
    color: #222;
    margin: 0;
    font-weight: 700;
    line-height: 1.2;
  }
  .ticket-toast-text {
    font-size: 12.5px;
    color: #555;
    margin: 0;
    font-weight: 400;
    line-height: 1.4;
  }
  .ticket-toast-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 5px;
  }
  .ticket-toast-stats {
    display: flex;
    gap: 8px;
  }
  .ticket-toast-stat {
    background: var(--tt-stat-bg);
    color: var(--tt-stat-color);
    padding: 2px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
  }
  .ticket-toast-stat.done {
    background: var(--tt-done-bg);
    color: var(--tt-done-color);
  }
  .ticket-toast-link {
    color: #ff4d4d;
    font-weight: 700;
    text-decoration: none !important;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: transform 0.2s;
  }
  .ticket-toast-link:hover {
    transform: translateX(3px);
    color: #e63946;
  }
  .ticket-toast-close {
    background: rgba(0,0,0,0.03);
    border: none;
    color: #999;
    cursor: pointer;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  .ticket-toast-close:hover {
    background: #ff4d4d;
    color: white;
  }
  .ticket-toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: var(--tt-progress-bg);
    width: 100%;
    animation: ticket-progress-shrink 10s linear forwards;
  }
  @keyframes ticket-progress-shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
`;
