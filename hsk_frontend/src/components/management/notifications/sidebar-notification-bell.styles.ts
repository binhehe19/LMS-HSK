// CSS của chuông thông báo, lấy NGUYÊN VĂN khối <style> trong sidebar-notification-bell.tsx của HSK cũ. Giữ dạng thẻ <style> nội tuyến
// (như bản cũ) để thứ tự cascade so với Bootstrap/SCSS không đổi.
export const SIDEBAR_NOTIFICATION_BELL_CSS = `
        .sidebar-notification-wrapper {
          position: absolute;
          top: 15px;
          right: 15px;
          z-index: 1000;
        }
        .notification-bell-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          transition: all 0.3s ease;
          position: relative;
          cursor: pointer;
        }
        .notification-bell-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }
        .notification-bell-btn i {
          font-size: 18px;
        }
        .bell-ring {
          animation: ring 2s ease infinite;
          transform-origin: 50% 0;
        }
        @keyframes ring {
          0% { transform: rotate(0); }
          5% { transform: rotate(15deg); }
          10% { transform: rotate(-15deg); }
          15% { transform: rotate(10deg); }
          20% { transform: rotate(-10deg); }
          25% { transform: rotate(5deg); }
          30% { transform: rotate(-5deg); }
          35% { transform: rotate(0); }
          100% { transform: rotate(0); }
        }
        .noti-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: linear-gradient(135deg, #FF4667 0%, #392C7D 100%);
          color: white;
          font-size: 10px;
          font-weight: bold;
          min-width: 16px;
          height: 16px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          border: 1.5px solid #6b0f1a;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .sb-noti-dropdown {
          width: 350px;
          border: none;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          border-radius: 12px;
          padding: 0;
          overflow: hidden;
          margin-top: 10px !important;
        }
        .sb-noti-header {
          background: white;
          padding: 12px 15px;
          border-bottom: 1px solid #f0f0f0;
        }
        .sb-noti-title {
          font-weight: 700;
          font-size: 15px;
          margin: 0;
          color: #333;
        }
        .sb-mark-read-all {
          font-size: 12px;
          color: #392C7D;
          cursor: pointer;
          text-decoration: none;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .sb-mark-read-all:hover {
          background: #f0f4ff;
          text-decoration: underline;
        }
        .sb-noti-list {
          max-height: 350px;
          overflow-y: auto;
          background: #fff;
        }
        .sb-noti-item {
          padding: 12px 15px;
          border-bottom: 1px solid #f8f9fa;
          transition: all 0.2s;
          display: flex;
          gap: 12px;
          cursor: pointer;
          white-space: normal;
        }
        .sb-noti-item:hover {
          background-color: #f0f4ff;
        }
        .sb-noti-item.unread {
          background-color: #f5f8ff;
        }
        .sb-noti-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sb-noti-icon.unread {
          background: #eef2ff;
          color: #392c7d;
        }
        .sb-noti-content {
          flex: 1;
        }
        .sb-noti-item-title {
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 2px;
          color: #111;
        }
        .sb-noti-msg {
          font-size: 12px;
          color: #666;
          line-height: 1.4;
          margin-bottom: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .sb-noti-time {
          font-size: 11px;
          color: #999;
        }
        .sb-noti-footer {
          padding: 10px;
          text-align: center;
          background: #f9f9fb;
          border-top: 1px solid #eee;
        }
        .sb-noti-all-btn {
          color: #392C7D;
          font-weight: 600;
          font-size: 13px;
          text-decoration: none;
        }
        .sb-noti-all-btn:hover {
          text-decoration: underline;
        }
      `;
