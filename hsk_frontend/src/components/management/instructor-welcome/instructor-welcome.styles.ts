// CSS của màn "Tổng quan" giảng viên, lấy NGUYÊN VĂN khối <style> trong instructor-welcome.tsx của HSK cũ. Giữ dạng thẻ <style> nội tuyến
// (như bản cũ) để thứ tự cascade so với Bootstrap/SCSS không đổi.
export const INSTRUCTOR_WELCOME_CSS = `
          .welcome-hero-card {
            position: relative;
            overflow: hidden;
            border-radius: 24px;
            background: linear-gradient(135deg, #B10019 0%, #E63946 58%, #F4A261 100%);
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
          }
          .welcome-hero-card::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px);
            background-size: 22px 22px;
            opacity: 0.35;
          }
          .welcome-hero-orb {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            filter: blur(2px);
          }
          .welcome-hero-orb.orb-one {
            top: -60px;
            right: -40px;
            width: 220px;
            height: 220px;
          }
          .welcome-hero-orb.orb-two {
            bottom: -90px;
            left: -50px;
            width: 260px;
            height: 260px;
          }
          .welcome-stat-card {
            border: 1px solid rgba(225, 29, 72, 0.12);
            border-radius: 18px;
            background: linear-gradient(180deg, rgba(255, 245, 245, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%);
            box-shadow: 0 12px 30px rgba(177, 0, 25, 0.07);
            transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
          }
          .welcome-stat-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 18px 36px rgba(177, 0, 25, 0.12);
            border-color: rgba(225, 29, 72, 0.22);
          }
          .welcome-stat-icon {
            width: 54px;
            height: 54px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
        `;
