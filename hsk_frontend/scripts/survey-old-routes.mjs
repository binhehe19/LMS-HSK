// Khảo sát CHỈ-ĐỌC bảng route và guard của HSK cũ (LMS_Frontend), sinh ra:
//   - src/lib/management/old-routes.generated.ts   (dữ kiện về route khu quản lý, là đầu vào của route-registry.ts)
//   - docs/OLD-ROUTE-SURVEY.md                     (toàn bộ bảng route cũ, kể cả route học viên)
//
// Dùng:  node scripts/survey-old-routes.mjs --old <đường dẫn thư mục LMS_Frontend>   (cần node_modules của HSK cũ để biên dịch bảng hằng số route)
// KHÔNG chạy trong test/CI: HSK cũ là repo anh em, không thuộc checkout này. Kết quả được commit để mọi người dùng chung một khảo sát.
// Chỉ đọc file của HSK cũ; không ghi gì ngoài hai file đầu ra ở trên.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const argIdx = process.argv.indexOf("--old");
if (argIdx < 0 || !process.argv[argIdx + 1]) {
  console.error("Thiếu --old <đường dẫn LMS_Frontend>");
  process.exit(1);
}
const OLD = path.resolve(process.argv[argIdx + 1]);
const oldRequire = createRequire(path.join(OLD, "package.json"));
const esbuild = oldRequire("esbuild");

// 1) Hằng số route (all_routes) -> đường dẫn thật
const bundled = esbuild.buildSync({
  entryPoints: [path.join(OLD, "src/routes/all_routes.tsx")],
  bundle: true, format: "cjs", write: false, platform: "node", logLevel: "silent",
});
const mod = { exports: {} };
new Function("module", "exports", bundled.outputFiles[0].text)(mod, mod.exports);
const allRoutes = mod.exports.all_routes;

// 2) Bảng role (enum UserRole)
const enumSrc = fs.readFileSync(path.join(OLD, "src/core/utils/enum.ts"), "utf8");
const roleBody = enumSrc.match(/enum UserRole\s*\{([\s\S]*?)\}/)[1];
const roleMap = {};
for (const r of roleBody.matchAll(/(\w+)\s*=\s*["']([^"']+)["']/g)) roleMap[r[1]] = r[2];

// 3) Phân tích router.link.tsx (bỏ comment, giữ số dòng)
let raw = fs.readFileSync(path.join(OLD, "src/routes/router.link.tsx"), "utf8");
raw = raw.replace(/\/\*[\s\S]*?\*\//g, (x) => x.replace(/[^\n]/g, " "));
const lines = raw.split(/\r?\n/).map((l) => (/^\s*\/\//.test(l) ? "" : l));
const start = lines.findIndex((l) => l.startsWith("export const publicRoutes"));
const chunks = [];
let cur = null;
for (let i = start; i < lines.length; i++) {
  if (/^  \{\s*$/.test(lines[i])) { cur = { line: i + 1, text: [] }; chunks.push(cur); }
  if (cur) cur.text.push(lines[i]);
}

const entries = [];
for (const c of chunks) {
  const text = c.text.join("\n");
  const pm = text.match(/path:\s*([^,\n]+),/);
  if (!pm) continue;
  const expr = pm[1].trim();
  const k = expr.match(/^(?:routes|all_routes)\.(\w+)$/);
  const p = k ? allRoutes[k[1]] : /^["'`]/.test(expr) ? expr.slice(1, -1) : null;
  if (typeof p !== "string") throw new Error(`Không giải được path "${expr}" ở dòng ${c.line}`);
  const roleLists = [...text.matchAll(/allowedRoles=\{\[([^\]]*)\]\}/g)].map((x) =>
    [...x[1].matchAll(/UserRole\.(\w+)/g)].map((y) => {
      if (!roleMap[y[1]]) throw new Error(`Role lạ ${y[1]} ở dòng ${c.line}`);
      return roleMap[y[1]];
    }),
  );
  const hasPrivateRoute = /PrivateRoute/.test(text);
  // Nhiều PrivateRoute lồng nhau => phải thỏa tất cả => giao các danh sách.
  const roles = roleLists.length ? roleLists.reduce((a, b) => a.filter((r) => b.includes(r))) : [];
  const guard = !hasPrivateRoute ? "none" : roleLists.length ? "roles" : "authenticated";
  const component = [...new Set([...text.matchAll(/<([A-Z]\w*)/g)].map((x) => x[1]))].filter((t) => !["PrivateRoute", "Navigate"].includes(t))[0] ?? "(redirect)";
  entries.push({ path: p, line: c.line, guard, roles, component, underConstruction: /UnderConstructionContent/.test(text) });
}

// 4) Phạm vi quản lý: URL thuộc /admin, /instructor, /teacher-manager hoặc guard theo role nhân sự
const STAFF = ["ROLE_ADMIN", "ROLE_TEACHER", "ROLE_MENTOR", "ROLE_TEACHER_MANAGER", "ROLE_COLLABORATOR"];
const inNamespace = (p) => /^\/(admin|instructor|teacher-manager)(\/|$)/.test(p);
const isManagement = (e) => inNamespace(e.path) || (e.guard === "roles" && e.roles.some((r) => STAFF.includes(r)));

// Gộp khai báo trùng đường dẫn (cùng guard) TRƯỚC khi phân nhóm, để khai báo = đường dẫn duy nhất + khai báo trùng.
const seen = new Map();
const duplicates = [];
for (const e of entries) {
  const prev = seen.get(e.path);
  if (prev) {
    if (prev.guard !== e.guard || prev.roles.join() !== e.roles.join()) throw new Error(`Route trùng ${e.path} nhưng guard khác nhau (dòng ${prev.line} và ${e.line})`);
    duplicates.push({ path: e.path, lines: [prev.line, e.line] });
    continue;
  }
  seen.set(e.path, e);
}
const unique = [...seen.values()];
const management = unique.filter(isManagement);
const learner = unique.filter((e) => !isManagement(e));
if (entries.length !== unique.length + duplicates.length || unique.length !== management.length + learner.length) throw new Error("Số liệu route không khớp");

const oldCommit = execFileSync("git", ["-C", OLD, "rev-parse", "--short", "HEAD"]).toString().trim();
const source = `LMS_Frontend/src/routes/router.link.tsx @ ${oldCommit}`;

// 5) Ghi file sinh ra
const q = (s) => JSON.stringify(s);
const factLines = management
  .map((e) => `  { path: ${q(e.path)}, component: ${q(e.component)}, line: ${e.line}, guard: ${q(e.guard)}, roles: [${e.roles.map(q).join(", ")}], underConstruction: ${e.underConstruction} },`)
  .join("\n");
fs.writeFileSync(
  path.join(root, "src/lib/management/old-routes.generated.ts"),
  `// FILE SINH TỰ ĐỘNG bởi scripts/survey-old-routes.mjs — KHÔNG sửa tay (chạy lại script khi HSK cũ đổi).
// Nguồn: ${source}
// Chỉ là DỮ KIỆN quan sát được ở HSK cũ (route nào, component nào, guard nào). Trạng thái chuyển đổi và quyền ở app mới do
// route-registry.ts quyết định, không nằm ở đây.
// guard: "none" = route KHÔNG bọc PrivateRoute (không có guard ở tầng route); "authenticated" = PrivateRoute không giới hạn role;
//        "roles" = PrivateRoute allowedRoles (roles là danh sách nguyên văn; nhiều PrivateRoute lồng nhau thì lấy giao).

export interface OldRouteFact {
  path: string;
  component: string;
  line: number;
  guard: "none" | "authenticated" | "roles";
  roles: readonly string[];
  /** HSK cũ tự hiển thị UnderConstructionContent cho route này (chưa từng có chức năng thật). */
  underConstruction: boolean;
}

export const OLD_ROUTES_SOURCE = ${q(source)};

/** Số liệu đối chiếu: declared = uniquePaths + duplicateDeclarations; uniquePaths = management + outOfScope. */
export const OLD_ROUTE_COUNTS = {
  declared: ${entries.length},
  uniquePaths: ${unique.length},
  duplicateDeclarations: ${duplicates.length}, // ${duplicates.map((d) => d.path + " (dòng " + d.lines.join(" và ") + ")").join("; ") || "không có"}
  management: ${management.length},
  outOfScope: ${learner.length},
} as const;

/** Đường dẫn route học viên/công khai/xác thực (ngoài phạm vi frontend quản lý). Không được phục vụ, trả 404. */
export const OLD_OUT_OF_SCOPE_PATHS: readonly string[] = [
${learner.map((e) => "  " + q(e.path) + ",").join("\n")}
];

export const OLD_MANAGEMENT_ROUTES: readonly OldRouteFact[] = [
${factLines}
];
`,
);

const roleCell = (e) => (e.guard === "roles" ? e.roles.map((r) => r.replace("ROLE_", "")).join(", ") : "—");
const mdMgmt = management
  .map((e) => `| \`${e.path}\` | ${e.component} | ${e.line} | ${e.guard} | ${roleCell(e)} |${e.underConstruction ? " UnderConstruction |" : "  |"}`)
  .join("\n");
const byGuard = (g) => learner.filter((e) => e.guard === g);
fs.writeFileSync(
  path.join(root, "docs/OLD-ROUTE-SURVEY.md"),
  `# Khảo sát route của HSK cũ (chỉ đọc)

Sinh bởi \`scripts/survey-old-routes.mjs\` từ **${source}**. Không chỉnh tay. Trạng thái ở app mới: \`docs/ROUTE-STATUS.md\`.

- Tổng số route khai báo trong \`publicRoutes\` + \`authRoutes\` (đã bỏ phần bị comment): **${entries.length}** = **${unique.length}** đường dẫn duy nhất + **${duplicates.length}** khai báo trùng (${duplicates.map((d) => `\`${d.path}\` ở dòng ${d.lines.join(" và ")}`).join("; ") || "không có"}; cùng component, cùng guard)
- Route khu quản lý (URL thuộc \`/admin\`, \`/instructor\`, \`/teacher-manager\`, hoặc \`PrivateRoute\` theo role nhân sự): **${management.length}**
- Route học viên/công khai/xác thực (ngoài phạm vi frontend quản lý): **${learner.length}** — ${byGuard("none").length} không guard, ${byGuard("authenticated").length} chỉ yêu cầu đăng nhập

## Cơ chế guard thực tế của HSK cũ

\`PrivateRoute\` (\`core/common/private-route.tsx\`): chờ \`isAuthReady\`; chưa đăng nhập → chuyển Authentication_Frontend \`/login?redirect=…\`;
có \`allowedRoles\` mà người dùng không có role nào trong danh sách → chuyển \`/error-403\`; không có \`allowedRoles\` → chỉ cần đã đăng nhập.
Route KHÔNG bọc \`PrivateRoute\` không có guard nào ở tầng route (mọi người, kể cả chưa đăng nhập, đều tải được component; việc hạn chế nếu có nằm trong
component hoặc API). Không được suy ra quyền từ việc thiếu \`PrivateRoute\`.

## Route khu quản lý

| Route | Component cũ | Dòng | Guard | Roles (nguyên văn) | Ghi chú |
|---|---|---|---|---|---|
${mdMgmt}

## Route ngoài phạm vi (học viên/công khai/xác thực)

Chỉ liệt kê đường dẫn để đối chiếu; app quản lý không phục vụ chúng.

**Không guard (${byGuard("none").length}):** ${byGuard("none").map((e) => `\`${e.path}\``).join(", ")}

**Chỉ yêu cầu đăng nhập (${byGuard("authenticated").length}):** ${byGuard("authenticated").map((e) => `\`${e.path}\``).join(", ")}

**Theo role nhưng không phải role nhân sự (${byGuard("roles").length}):** ${byGuard("roles").map((e) => `\`${e.path}\` (${roleCell(e)})`).join(", ") || "(không có)"}
`,
);
console.log(`Đã ghi ${management.length} route quản lý, ${learner.length} route ngoài phạm vi, nguồn ${source}`);
