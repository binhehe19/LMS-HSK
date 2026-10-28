// Màn "Quản lý lớp học" của Giảng viên /instructor/list-class (M4A). MOCK / NOT INTEGRATED: danh sách lớp do scripts/mock-server.mjs giả lập (không phải API thật).
// Mock: 25 lớp, ngày tính theo thời gian giả lập đóng băng; lớp i%4==0 còn bài chờ chấm; i%9==0 thiếu giáo viên; i%11==0 thiếu số học viên; khoá học theo i%4.
import type { Page } from "@playwright/test";
import { control, mockState, type LoginOptions } from "../support/mock";
import { expect, test, type App } from "../support/test";

const URL_PAGE = "/instructor/list-class";
const FIXED = new Date("2026-10-23T09:00:00+07:00"); // hôm nay của mock (UTC 02:00) và của trình duyệt (giờ VN) đều là 2026-10-23
const rows = "[data-testid='class-row']";
const cell = (page: Page, row: number, col: number) => page.locator(rows).nth(row).locator("td").nth(col);
const pager = ".ant-pagination";

async function open(page: Page, app: App, options: LoginOptions = {}) {
  await page.clock.setFixedTime(FIXED);
  await control({ now: FIXED.toISOString(), tickets: "none" });
  await app.signIn(URL_PAGE, { role: "teacher", ...options });
}

test.describe("Teacher và Mentor vào được; nội dung đúng dữ liệu mock", () => {
  for (const role of ["teacher", "mentor"] as const) {
    test(`${role}: tiêu đề thẻ, 10 dòng/trang, tổng 25, một sidebar, mục 'Quản lý lớp học' active, khung không có g-4, không vòng lặp redirect`, async ({ page, app }) => {
      await open(page, app, { role });
      await page.waitForSelector(rows);
      await expect(page.getByText("Danh sách lớp học (25)")).toBeVisible();
      await expect(page.locator(rows)).toHaveCount(10);
      await expect(page.getByText("Tổng số 25")).toBeVisible();
      await expect(page.locator(".management-sidebar-column")).toHaveCount(1);
      await expect(page.locator(".content > .container > .row")).toHaveClass("row");
      const active = await page.$$eval(".sidebar-middle .sidebar-menu a.active .sidebar-menu-text", (as) => as.map((a) => (a.textContent ?? "").trim()));
      expect(active).toEqual(["Quản lý lớp học"]);
      await expect(page.locator("thead th")).toHaveText(["STT", "Mã lớp", "Khóa học", "Giáo viên", "Ngày bắt đầu", "Ngày kết thúc dự kiến", "Số học viên", "Bài chưa chấm"]);
      await page.reload();
      await page.waitForSelector(rows);
      expect(page.url()).toBe(app.url(URL_PAGE));
      expect(app.loginVisits()).toBe(0);
      expect(app.problems).toEqual([]);
    });
  }

  test("lớp còn bài chờ chấm lên đầu (6 lớp i%4==0 có chấm đỏ), phần còn lại có ✓; ô thiếu dữ liệu hiện '-'", async ({ page, app }) => {
    await open(page, app);
    await page.waitForSelector(rows);
    for (let i = 0; i < 6; i++) await expect(cell(page, i, 7).locator(".cm-dot-badge")).toHaveText("*");
    await expect(cell(page, 6, 7).locator(".badge")).toHaveText("✓");
    // lớp 9 (i%9==0) thiếu giáo viên, lớp 11 (i%11==0) thiếu số học viên; chúng nằm ở nhóm không chờ chấm: tìm bằng mã lớp
    await page.getByLabel("Mã lớp").selectOption({ label: "Lớp giả lập 9 (MOCK09)" });
    await expect(cell(page, 0, 3)).toContainText("-");
    await expect(cell(page, 0, 3)).toContainText("?"); // huy hiệu chữ cái đầu khi không có tên
    await page.getByLabel("Mã lớp").selectOption({ label: "Lớp giả lập 11 (MOCK11)" });
    await expect(cell(page, 0, 6)).toHaveText("-");
  });
});

test.describe("quyền: chỉ TEACHER và MENTOR (đúng PrivateRoute HSK cũ); không tự cấp quyền cho Admin/Teacher-manager/Collaborator", () => {
  for (const role of ["admin", "teacher-manager", "collaborator", "manager", "user", "none"] as const) {
    test(`${role} bị chặn, không thấy nội dung, không thấy sidebar, không gọi API lớp`, async ({ page, app }) => {
      const calls: string[] = [];
      page.on("request", (r) => {
        if (/\/api\/quiz\/grading/.test(r.url())) calls.push(r.url());
      });
      await app.signIn(URL_PAGE, { role });
      await page.waitForSelector('[data-testid="auth-forbidden"]');
      expect(await page.locator(rows).count()).toBe(0);
      expect(await page.locator(".management-sidebar-column").count()).toBe(0);
      expect(calls).toEqual([]);
    });
  }

  test("chưa đăng nhập => chuyển Auth đúng một lần, redirect về đúng URL, KHÔNG gọi API", async ({ page, app }) => {
    const calls: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/(quiz|notification|tickets)/.test(r.url())) calls.push(r.url());
    });
    await page.goto(app.url(URL_PAGE));
    await app.waitForLogin();
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(app.url(URL_PAGE));
    expect(app.loginVisits()).toBe(1);
    expect(calls).toEqual([]);
  });
});

test.describe("lọc, tìm và phân trang (phía client như bản cũ)", () => {
  test("lọc khoá học, rồi lớp; đổi khoá xoá lớp đã chọn; tiêu đề đếm theo kết quả", async ({ page, app }) => {
    await open(page, app);
    await page.waitForSelector(rows);
    const course = page.getByLabel("Khóa học");
    await expect(course.locator("option")).toHaveText(["Tất cả khóa học", "Giao tiếp cơ bản", "HSK 1 cơ bản", "HSK 2 cơ bản", "HSK 3 trung cấp"]);
    await course.selectOption({ label: "HSK 2 cơ bản" }); // khoá theo i%4==1 => lớp 1,5,9,13,17,21,25 = 7 lớp
    await expect(page.getByText("Danh sách lớp học (7)")).toBeVisible();
    await expect(page.locator(rows)).toHaveCount(7);
    await page.getByLabel("Mã lớp").selectOption({ label: "Lớp giả lập 13 (MOCK13)" });
    await expect(page.locator(rows)).toHaveCount(1);
    await expect(cell(page, 0, 1)).toContainText("MOCK13");
    await course.selectOption({ label: "HSK 3 trung cấp" });
    await expect(page.getByLabel("Mã lớp")).toHaveValue(""); // đổi khoá => bỏ lớp đã chọn
    await expect(page.locator(rows)).toHaveCount(6); // i%4==2 => 2,6,10,14,18,22
    await course.selectOption({ label: "Tất cả khóa học" });
    await expect(page.getByText("Danh sách lớp học (25)")).toBeVisible();
  });

  const TIME_CASES: [label: string, mode: string, expected: number][] = [
    ["Hôm nay", "TODAY", 12], // lớp i ≤ 12 đã bắt đầu, đều còn chạy (30 ngày)
    ["Ngày mai", "TOMORROW", 13],
    ["Hôm qua", "YESTERDAY", 11],
    ["Trong 7 ngày qua", "PAST_7_DAYS", 12],
    ["Trong 7 ngày tới", "NEXT_7_DAYS", 18],
  ];
  for (const [label, mode, expected] of TIME_CASES) {
    test(`thời gian "${label}" (${mode}) => ${expected} lớp`, async ({ page, app }) => {
      await open(page, app);
      await page.waitForSelector(rows);
      await page.getByLabel("Thời gian").selectOption(mode);
      await expect(page.getByText(`Danh sách lớp học (${expected})`)).toBeVisible();
    });
  }

  test("'Ngày chính xác': ô ngày mặc định hôm nay; đổi ngày lọc lại; ngày không có lớp => 'Không có lớp phù hợp bộ lọc'; 'Mọi thời gian' trả đủ", async ({ page, app }) => {
    await open(page, app);
    await page.waitForSelector(rows);
    await page.getByLabel("Thời gian").selectOption("EXACT");
    const date = page.getByLabel("Chọn ngày chính xác");
    await expect(date).toHaveValue("2026-10-23");
    await expect(page.getByText("Danh sách lớp học (12)")).toBeVisible();
    await date.fill("2026-10-12"); // lớp i bắt đầu 23/10 + (i-12) ngày: chỉ lớp 1 (bắt đầu 12/10) đã bắt đầu vào ngày này
    await expect(page.getByText("Danh sách lớp học (1)")).toBeVisible();
    await date.fill("2025-01-01");
    await expect(page.getByText("Không có lớp phù hợp bộ lọc")).toBeVisible();
    await expect(page.getByText("Chưa có lớp được phân công")).toHaveCount(0);
    await page.getByLabel("Thời gian").selectOption("");
    await expect(page.getByText("Danh sách lớp học (25)")).toBeVisible();
    await expect(date).toHaveCount(0);
  });

  test("phân trang 25 lớp: STT liên tục qua các trang, trang cuối 5 dòng; đổi bộ lọc về trang 1", async ({ page, app }) => {
    await open(page, app);
    await page.waitForSelector(rows);
    await expect(page.locator(`${pager} .ant-pagination-item`)).toHaveText(["1", "2", "3"]);
    await page.locator(pager).getByTitle("3").click();
    await expect(page.locator(rows)).toHaveCount(5);
    await expect(cell(page, 0, 0)).toHaveText("21");
    await expect(cell(page, 4, 0)).toHaveText("25");
    await page.locator(pager).getByTitle("2").click();
    await expect(cell(page, 0, 0)).toHaveText("11");
    await page.getByLabel("Khóa học").selectOption({ label: "HSK 3 trung cấp" });
    await expect(page.locator(`${pager} .ant-pagination-item-active`)).toHaveText("1");
    await expect(cell(page, 0, 0)).toHaveText("1");
  });
});

test.describe("điều hướng từ màn", () => {
  test("bấm mã lớp => /instructor/list-class/list-lesson?classId&courseId (màn thật từ M4B, mục 'Quản lý lớp học' vẫn active); quay lại danh sách", async ({ page, app }) => {
    await open(page, app);
    await page.waitForSelector(rows);
    const first = page.locator(rows).first().locator("a");
    const code = (await first.innerText()).trim();
    const href = await first.getAttribute("href");
    expect(href).toMatch(/^\/instructor\/list-class\/list-lesson\?classId=mock-tc-\d+&courseId=mock-course-\d$/);
    await first.click();
    await page.waitForURL(app.url(href!));
    await page.waitForSelector("#lesson-search");
    await expect(page.locator('[data-testid="migration-placeholder"]')).toHaveCount(0);
    const active = await page.$$eval(".sidebar-middle .sidebar-menu a.active .sidebar-menu-text", (as) => as.map((a) => (a.textContent ?? "").trim()));
    expect(active).toEqual(["Quản lý lớp học"]);
    expect(code).toMatch(/^MOCK\d+$/);
    await page.goBack();
    await page.waitForSelector(rows);
    await expect(page.getByText("Danh sách lớp học (25)")).toBeVisible();
  });

  test("mục menu 'Quản lý lớp học' mở màn thật (không phải placeholder); Mentor cũng vào được", async ({ page, app }) => {
    await app.signIn("/instructor/welcome", { role: "mentor" });
    await page.waitForSelector(".welcome-hero-card");
    await page.getByRole("link", { name: /Quản lý lớp học/ }).click();
    await page.waitForURL(app.url(URL_PAGE));
    await page.waitForSelector(rows);
    await expect(page.locator('[data-testid="migration-placeholder"]')).toHaveCount(0);
  });
});

test.describe("trạng thái dữ liệu", () => {
  test("đang tải (lời gọi danh sách bị giữ lại): spinner, không hiện 'Chưa có lớp được phân công'", async ({ page, app }) => {
    // Giữ lời gọi ở trình duyệt cho tới khi test cho phép (xác định, không phụ thuộc độ trễ cố định 4 giây của mock — từng làm test chập chờn khi máy tải nặng).
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/api\/quiz\/grading\/classes$/, async (route) => {
      await gate;
      await route.continue();
    });
    await open(page, app);
    await expect(page.locator(".spinner-border").first()).toBeVisible();
    await expect(page.getByText("Chưa có lớp được phân công")).toHaveCount(0);
    release();
    await page.waitForSelector(rows);
    await expect(page.locator(".spinner-border")).toHaveCount(0);
  });

  test("rỗng thật: 'Chưa có lớp được phân công', tiêu đề (0), không khối lỗi", async ({ page, app }) => {
    await open(page, app, { state: "empty" });
    await expect(page.getByText("Chưa có lớp được phân công")).toBeVisible();
    await expect(page.getByText("Danh sách lớp học (0)")).toBeVisible();
    expect(await page.locator('[data-testid="class-list-notice"]').count()).toBe(0);
  });

  test("API lỗi 500: toast + khối lỗi có 'Thử lại', KHÔNG nói 'chưa có lớp'", async ({ page, app }) => {
    await open(page, app, { state: "error" });
    const notice = page.locator('[data-testid="class-list-notice"]');
    await notice.waitFor();
    await expect(notice).toHaveAttribute("data-kind", "error");
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Lỗi máy chủ giả lập");
    await expect(page.getByText("Chưa có lớp được phân công")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  });

  test("phản hồi sai định dạng (không phải mảng): khối lỗi hợp đồng, không hiện danh sách rỗng giả", async ({ page, app }) => {
    await open(page, app, { state: "invalid" });
    await expect(page.locator('[data-testid="class-list-notice"]')).toContainText("không đúng định dạng");
    await expect(page.getByText("Chưa có lớp được phân công")).toHaveCount(0);
  });
});

test.describe("responsive", () => {
  for (const [name, size] of [["tablet", { width: 820, height: 1180 }], ["mobile", { width: 390, height: 844 }]] as const) {
    test(`${name}: trang không cuộn ngang (bảng cuộn trong khung), sidebar xếp trên nội dung, bộ lọc xếp cột`, async ({ page, app }) => {
      await page.setViewportSize(size);
      await open(page, app);
      await page.waitForSelector(rows);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      const col = (await page.locator(".management-sidebar-column").boundingBox())!;
      const main = (await page.locator(".col-lg-9").boundingBox())!;
      expect(main.y).toBeGreaterThanOrEqual(col.y + col.height - 2);
      const wrap = await page.locator(".table-responsive").evaluate((e) => ({ client: e.clientWidth, scroll: e.scrollWidth }));
      expect(wrap.scroll).toBeGreaterThan(wrap.client); // bảng min-width 900 cuộn ngang TRONG khung .table-responsive như bản cũ
      const filters = await page.locator(".card.mb-3 .col-md-4").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      if (name === "mobile") expect(new Set(filters).size).toBe(3);
    });
  }

  test("mock không bị sửa bởi test khác: đếm lời gọi API lớp của một lần vào trang là 1", async ({ page, app }) => {
    await open(page, app);
    await page.waitForSelector(rows);
    expect((await mockState()).counters.teacherClasses).toBe(1);
  });
});
