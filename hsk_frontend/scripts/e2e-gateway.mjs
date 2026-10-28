// GATEWAY CÁCH LY cho kiểm thử trình duyệt (chỉ dùng trong e2e; KHÔNG phải một phần của app và không dùng ở bất kỳ môi trường nào khác).
//
// Vì sao có file này: bản build e2e phải là bản build production BÌNH THƯỜNG, không chứa URL mock (nếu không next.config.ts sẽ từ chối, và chúng ta không
// muốn nới guard đó). Do đó app được cấu hình bằng đường dẫn cùng origin như khi chạy sau gateway thật (/api/auth, /api/quiz, /api/notification,
// /api/tickets, Auth_Frontend ở /__auth) và chính file này đóng vai gateway: mọi thứ "giả" nằm ở tiến trình này và ở scripts/mock-server.mjs,
// không nằm trong artifact được build.
//
//   /__gateway-health         → 200 (tự trả lời, để Playwright biết gateway đã sẵn sàng)
//   /api/*  và  /mock-login   → mock server (127.0.0.1:<mock>)           giữ nguyên đường dẫn
//   /__auth/*                 → mock server, bỏ tiền tố /__auth          (trang đăng nhập GIẢ LẬP)
//   còn lại                   → app Next (127.0.0.1:<app>)
//
// An toàn: chỉ lắng nghe 127.0.0.1; upstream cứng là 127.0.0.1 (không nhận host tùy ý nên không thể trỏ tới Auth/backend thật);
// từ chối khởi động nếu tham số không phải số cổng hợp lệ.
//   node scripts/e2e-gateway.mjs --port 3100 --app 3200 --mock 3190
import http from "node:http";

const HOST = "127.0.0.1";
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`Thiếu hoặc sai --${name} <cổng>`);
    process.exit(1);
  }
  return n;
};
const PORT = arg("port");
const APP = arg("app");
const MOCK = arg("mock");

function target(url) {
  if (url === "/__auth" || url.startsWith("/__auth/") || url.startsWith("/__auth?")) {
    const rest = url.slice("/__auth".length);
    return { port: MOCK, path: rest.startsWith("/") ? rest : `/${rest}` };
  }
  if (url.startsWith("/api/") || url === "/mock-login" || url.startsWith("/mock-login?")) return { port: MOCK, path: url };
  return { port: APP, path: url };
}

const server = http.createServer((req, res) => {
  const url = req.url || "/";
  if (url === "/__gateway-health") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
  }
  const { port, path } = target(url);
  const upstream = http.request({ host: HOST, port, path, method: req.method, headers: req.headers, agent: false }, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  upstream.on("error", (error) => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Gateway e2e: không kết nối được upstream ${HOST}:${port} (${error.code ?? error.message})`);
  });
  req.pipe(upstream);
});

server.listen(PORT, HOST, () => console.log(`E2E gateway (cách ly) http://${HOST}:${PORT}  app→${APP}  mock→${MOCK}`));
