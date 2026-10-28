// ============================================================================================
//  MOCK / NOT INTEGRATED — máy chủ GIẢ LẬP chỉ để xem trước giao diện, chạy demo và kiểm thử luồng Auth/route guard ở local.
//  Đây KHÔNG phải Authentication thật, KHÔNG phải backend LMS. Không dùng cho môi trường nào khác.
//  - Chỉ bind 127.0.0.1, không kết nối mạng ngoài, không ghi đĩa, token giả (không ký, không dùng được ở nơi khác).
//  - Ứng dụng Next.js KHÔNG biết đến máy chủ này; nó chỉ được trỏ tới đây bằng biến môi trường (xem .env.example) hoặc qua gateway cách ly
//    (scripts/e2e-gateway.mjs, scripts/demo.mjs).
//  - Hồ sơ dữ liệu: MOCK_PROFILE=e2e (mặc định; dữ liệu đóng băng cho Playwright) | demo (bộ dữ liệu nhất quán cho chế độ demo).
//  Chạy:  npm run mock:server   (mặc định cổng 3190; MOCK_PORT để đổi)
// ============================================================================================
import http from "node:http";
import { HOST, PORT, PROFILE, authenticate, cors, fail, requireSession, send, state } from "./core.mjs";
import { createDemoProvider } from "./data/demo.mjs";
import { createLegacyProvider } from "./data/legacy.mjs";
import * as adminOverview from "./handlers/admin-overview.mjs";
import * as adminUsers from "./handlers/admin-users.mjs";
import * as auth from "./handlers/auth.mjs";
import * as contentTree from "./handlers/content-tree.mjs";
import * as control from "./handlers/control.mjs";
import * as dictionary from "./handlers/dictionary.mjs";
import * as hskStorage from "./handlers/hsk-storage.mjs";
import * as learningAnalysis from "./handlers/learning-analysis.mjs";
import * as lessonMaterials from "./handlers/lesson-materials.mjs";
import * as lms from "./handlers/lms.mjs";
import * as notification from "./handlers/notification.mjs";
import * as onlineCourse from "./handlers/online-course.mjs";
import * as payment from "./handlers/payment.mjs";
import * as quizGrading from "./handlers/quiz-grading.mjs";
import * as storage from "./handlers/storage.mjs";
import * as syllabusModules from "./handlers/syllabus-modules.mjs";
import * as teachers from "./handlers/teachers.mjs";
import * as tickets from "./handlers/tickets.mjs";
import * as workTickets from "./handlers/work-tickets.mjs";

state.data = PROFILE === "demo" ? createDemoProvider() : createLegacyProvider();

// Thứ tự có ý nghĩa: handler đầu tiên trả true sẽ kết thúc request. `workTickets` phải đứng TRƯỚC `tickets`: ở hồ sơ demo nó trả cả danh sách
// GET /api/tickets (cùng kho với thao tác ghi), ở hồ sơ e2e nó trả false cho danh sách để `tickets.mjs` giữ dữ liệu đóng băng của Playwright.
const HANDLERS = [control, auth, quizGrading, learningAnalysis, lms, storage, contentTree, dictionary, adminOverview, teachers, syllabusModules, onlineCourse, lessonMaterials, hskStorage, workTickets, payment, notification, adminUsers, tickets];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors(req));
    return res.end();
  }
  const ctx = {
    req,
    res,
    url,
    method: req.method,
    /** Phiên hợp lệ hoặc null (không gửi phản hồi). */
    session: () => authenticate(req),
    /** Phiên hợp lệ có role phù hợp; đã gửi 401/403 và trả null nếu không. */
    require: (roles) => requireSession({ req, res }, roles),
  };
  try {
    for (const h of HANDLERS) {
      if (await h.handle(ctx)) return;
    }
    send(req, res, 404, fail("404", `MOCK: không có endpoint ${req.method} ${url.pathname}`));
  } catch (error) {
    console.error("[mock] lỗi xử lý", req.method, url.pathname, error);
    if (!res.headersSent) send(req, res, 500, fail("500", "Lỗi nội bộ của máy chủ giả lập (MOCK)"));
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`MOCK server (KHÔNG phải hệ thống thật) đang chạy tại http://${HOST}:${PORT} — hồ sơ dữ liệu: ${PROFILE}`);
});
