// Màn "Danh sách bài học" của một lớp /instructor/list-class/list-lesson (M4B). MOCK / NOT INTEGRATED: buổi học do scripts/mock-server.mjs giả lập (không phải API thật).
// Mock: 23 buổi mỗi lớp (3 trang), trả ĐẢO NGƯỢC thứ tự; tiêu đề chứa số lớp để kiểm tra không lẫn dữ liệu; chỉ lớp mock-tc-1..25 thuộc giảng viên, lớp khác => 403.
//   buổi 1: title "Buổi 1" · buổi 2: có title + topic · buổi 3: không title · buổi 4: thiếu sessionNo (xuống cuối) · i%3==0 có bài tập · i%5==0 còn bài chờ chấm.
import type { Page } from "@playwright/test";
import { control, mockState, type LoginOptions } from "../support/mock";
import { expect, test, type App } from "../support/test";

const LIST = "/instructor/list-class";
const LESSONS = "/instructor/list-class/list-lesson";
const q = (classId = "mock-tc-4", courseId = "mock-course-0", extra = "") => `${LESSONS}?classId=${classId}&courseId=${courseId}${extra}`;
const rows = "[data-testid='lesson-row']";
const cellText = (page: Page, row: number, col: number) => page.locator(rows).nth(row).locator("td").nth(col);
const pager = ".ant-pagination";
const lessonCalls = (page: Page) => {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/quiz\/grading\/classes\/[^/]+\/schedules/.test(r.url())) urls.push(r.url());
  });
  return urls;
};

async function openLessons(page: Page, app: App, url = q(), options: LoginOptions = {}) {
  await control({ tickets: "none" });
  await app.signIn(url, { role: "teacher", ...options });
}

/** Bắt đầu chờ toast sonner NGAY (gọi TRƯỚC khi mở trang): toast tự tắt sau ~4s nên kiểm tra sau khi trang hydrate chậm có thể lỡ. Trả về văn bản toast; null nếu không thấy trong 60s. */
function armToast(page: Page): Promise<string | null> {
  const toast = page.locator("[data-sonner-toast]").first();
  return toast.waitFor({ state: "visible", timeout: 60_000 }).then(
    () => toast.textContent({ timeout: 5_000 }).catch(() => ""),
    () => null,
  );
}

test.describe("luồng list-class → list-lesson", () => {
  test("bấm mã lớp mở đúng lớp (classId/courseId trong URL), không lẫn dữ liệu giữa các lớp; quay lại bằng liên kết 'Danh sách lớp học' và bằng nút back", async ({ page, app }) => {
    await control({ tickets: "none" });
    await app.signIn(LIST, { role: "teacher" });
    await page.waitForSelector("[data-testid='class-row']");
    const calls = lessonCalls(page);
    await page.getByRole("link", { name: "MOCK04" }).click();
    await page.waitForSelector(rows);
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(q("mock-tc-4", "mock-course-0"));
    await expect(page.getByText("Bài 5 của lớp 4").first()).toBeVisible();
    await expect(page.getByText(/của lớp 8/)).toHaveCount(0);
    expect((await mockState()).lastLessonsClassId).toBe("mock-tc-4");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/\/grading\/classes\/mock-tc-4\/schedules$/);
    await page.getByRole("link", { name: "Danh sách lớp học" }).click(); // đường dẫn breadcrumb
    await page.waitForURL(app.url(LIST));
    await page.waitForSelector("[data-testid='class-row']");
    await page.getByRole("link", { name: "MOCK08" }).click(); // lớp khác: dữ liệu của lớp 8
    await page.waitForSelector(rows);
    await expect(page.getByText("Bài 5 của lớp 8").first()).toBeVisible();
    await expect(page.getByText(/của lớp 4/)).toHaveCount(0);
    expect((await mockState()).lastLessonsClassId).toBe("mock-tc-8");
    await page.goBack(); // nút back của trình duyệt về danh sách lớp
    await page.waitForURL(app.url(LIST));
    await page.waitForSelector("[data-testid='class-row']");
    expect(app.problems).toEqual([]);
  });

  test("tải thẳng URL (reload) vẫn hoạt động, giữ query; mục menu 'Quản lý lớp học' active; không vòng lặp redirect", async ({ page, app }) => {
    await openLessons(page, app, q("mock-tc-12", "mock-course-0"));
    await page.waitForSelector(rows);
    await expect(page.getByText("Bài 5 của lớp 12").first()).toBeVisible();
    const active = await page.$$eval(".sidebar-middle .sidebar-menu a.active .sidebar-menu-text", (as) => as.map((a) => (a.textContent ?? "").trim()));
    expect(active).toEqual(["Quản lý lớp học"]);
    await page.reload();
    await page.waitForSelector(rows);
    expect(page.url()).toBe(app.url(q("mock-tc-12", "mock-course-0")));
    await expect(page.getByText("Bài 5 của lớp 12").first()).toBeVisible();
    expect(app.loginVisits()).toBe(0);
  });
});

test.describe("nội dung và tương tác", () => {
  test("cột, breadcrumb, tìm kiếm, tổng 23; sắp theo thứ tự buổi dù API trả đảo ngược; thiếu sessionNo xuống cuối; định dạng tiêu đề; màu theo bài tập", async ({ page, app }) => {
    await openLessons(page, app);
    await page.waitForSelector(rows);
    await expect(page.locator("thead th")).toHaveText(["STT", "Tên bài học", "Chi tiết bài học", "Danh sách nộp bài", "Phân tích học tập"]);
    await expect(page.getByText("Tổng số 23")).toBeVisible();
    await expect(page.locator("nav.mb-3.small")).toHaveText("Danh sách lớp học›Danh sách bài học") // dấu › cách bằng margin (mx-2), không có khoảng trắng trong văn bản;
    await expect(cellText(page, 0, 1)).toHaveText("Buổi 1"); // title đã có tiền tố "Buổi"
    await expect(cellText(page, 1, 1)).toHaveText("Buổi 2: Bài 2 của lớp 4: Chủ đề 2 lớp 4");
    await expect(cellText(page, 2, 1)).toHaveText("Buổi 3"); // không title
    await expect(cellText(page, 3, 1)).toHaveText("Buổi 5: Bài 5 của lớp 4"); // buổi 4 thiếu sessionNo bị đẩy xuống cuối
    await expect(cellText(page, 0, 0)).toHaveText("1");
    expect(await cellText(page, 2, 1).locator("div").evaluate((e) => getComputedStyle(e).color)).toBe("rgb(128, 0, 32)"); // buổi 3: có bài tập
    expect(await cellText(page, 0, 1).locator("div").evaluate((e) => getComputedStyle(e).color)).toBe("rgb(113, 166, 210)");
    await expect(page.locator(rows).nth(2).locator("th, td").nth(3).locator(".cm-dot-badge")).toHaveCount(0);
    // buổi 5 (i%5==0) còn bài chờ chấm: chấm đỏ ở nút "Danh sách nộp bài"
    await expect(page.locator(rows).filter({ hasText: "Buổi 5:" }).locator(".cm-dot-badge")).toHaveText("*");
    await page.getByLabel("Tìm kiếm").fill("chủ đề 6");
    await expect(page.locator(rows)).toHaveCount(1);
    await expect(page.getByText("Tổng số 1")).toBeVisible();
    await page.getByLabel("Tìm kiếm").fill("không có bài này");
    await expect(page.getByText("Chưa có bài học")).toBeVisible();
  });

  test("ba nút mỗi dòng mở đúng route/query cũ (ba màn thật từ M5); nút back về list-lesson", async ({ page, app }) => {
    await openLessons(page, app);
    await page.waitForSelector(rows);
    const row = page.locator(rows).nth(1); // buổi 2: title "Bài 2 của lớp 4"
    const expectQuery = (url: string, path: string) => {
      const u = new URL(url);
      expect(u.pathname).toBe(path);
      expect(Object.fromEntries(u.searchParams)).toEqual({ classId: "mock-tc-4", courseId: "mock-course-0", scheduleId: "mock-syl-4-2", title: "Bài 2 của lớp 4" });
    };
    // Dấu hiệu trang thật của từng màn (dữ liệu, trạng thái rỗng hoặc dòng thông báo của chính màn đó), không phải placeholder.
    // Buổi 2 (i%3≠0) không có bài tập => Chi tiết bài học hiện "Buổi này chưa có bài tập".
    const MARKER = {
      "/instructor/list-class/lesson-detail": page.locator('[data-testid="lesson-module"], [data-testid="lesson-detail-notice"]').or(page.getByText("Buổi này chưa có bài tập")),
      "/instructor/list-class/submissions": page.locator('[data-testid="submission-row"], [data-testid="submissions-notice"]'),
      "/instructor/list-class/learning-analysis": page.locator('[data-testid="student-row"], [data-testid="la-param-notice"], [data-testid="la-students-notice"]'),
    } as const;
    for (const [button, path] of [["Chi tiết bài học", "/instructor/list-class/lesson-detail"], ["Danh sách nộp bài", "/instructor/list-class/submissions"], ["Phân tích học tập", "/instructor/list-class/learning-analysis"]] as const) {
      await page.locator(rows).nth(1).getByRole("button", { name: button }).click();
      await page.waitForURL((u) => u.pathname === path);
      await MARKER[path].first().waitFor();
      await expect(page.locator('[data-testid="migration-placeholder"]')).toHaveCount(0);
      expectQuery(page.url(), path);
      await page.goBack();
      await page.waitForSelector(rows);
      expect(page.url()).toBe(app.url(q()));
    }
    await expect(row).toBeVisible();
  });
});

test.describe("phân trang qua URL (?page=)", () => {
  test("bấm trang 3 ghi ?page=3 (replace), reload giữ trang; đi sang màn khác rồi back về ĐÚNG trang 3", async ({ page, app }) => {
    await openLessons(page, app);
    await page.waitForSelector(rows);
    await expect(page.locator(`${pager} .ant-pagination-item`)).toHaveText(["1", "2", "3"]);
    const historyBefore = await page.evaluate(() => history.length);
    await page.locator(pager).getByTitle("3").click();
    await expect(page.locator(rows)).toHaveCount(3);
    expect(page.url()).toContain("page=3");
    expect(page.url()).toContain("classId=mock-tc-4&courseId=mock-course-0");
    expect(await page.evaluate(() => history.length)).toBe(historyBefore); // replace: không thêm mục lịch sử
    await expect(cellText(page, 0, 0)).toHaveText("21");
    await page.reload();
    await page.waitForSelector(rows);
    await expect(page.locator(rows)).toHaveCount(3);
    await expect(cellText(page, 0, 0)).toHaveText("21");
    await page.locator(rows).first().getByRole("button", { name: "Danh sách nộp bài" }).click();
    await page.waitForSelector('[data-testid="submission-row"], [data-testid="submissions-notice"]'); // màn Danh sách nộp bài (trang thật, M5)
    await page.goBack();
    await page.waitForSelector(rows);
    await expect(cellText(page, 0, 0)).toHaveText("21");
    expect(page.url()).toContain("page=3");
  });

  test("gõ tìm kiếm về trang 1; ?page không hợp lệ => trang 1; ?page quá lớn => trang cuối", async ({ page, app }) => {
    await openLessons(page, app, q("mock-tc-4", "mock-course-0", "&page=2"));
    await page.waitForSelector(rows);
    await expect(cellText(page, 0, 0)).toHaveText("11");
    await page.getByLabel("Tìm kiếm").fill("bài");
    await expect(page.locator(`${pager} .ant-pagination-item-active`)).toHaveText("1");
    expect(page.url()).toContain("page=1");
    for (const [bad, expected] of [["abc", "1"], ["0", "1"], ["-3", "1"], ["99", "3"]] as const) {
      await page.goto(app.url(q("mock-tc-4", "mock-course-0", `&page=${bad}`)));
      await page.waitForSelector(rows);
      await expect(page.locator(`${pager} .ant-pagination-item-active`)).toHaveText(expected);
    }
  });
});

test.describe("query thiếu/không hợp lệ — KHÔNG gọi API", () => {
  for (const [name, url, kind] of [
    ["thiếu classId", LESSONS, "missing-class"],
    ["classId rỗng", `${LESSONS}?classId=&courseId=mock-course-0`, "missing-class"],
    ["classId path traversal", `${LESSONS}?classId=..%2Fadmin&courseId=1`, "invalid-class"],
    ["classId có ký tự '?'", `${LESSONS}?classId=a%3Fb&courseId=1`, "invalid-class"],
    ["classId quá dài", `${LESSONS}?classId=${"x".repeat(200)}&courseId=1`, "invalid-class"],
  ] as const) {
    test(`${name} => thông báo, không request tới API buổi học, không toast`, async ({ page, app }) => {
      const calls = lessonCalls(page);
      await openLessons(page, app, url);
      const notice = page.locator('[data-testid="lesson-list-notice"]');
      await notice.waitFor();
      await expect(notice).toHaveAttribute("data-kind", kind);
      await expect(page.getByText("Chưa có bài học")).toHaveCount(0);
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Danh sách lớp học" })).toBeVisible(); // đường quay lại
      await page.waitForTimeout(500);
      expect(calls).toEqual([]);
      expect((await mockState()).counters.lessons).toBe(0);
    });
  }

  test("lớp không thuộc giảng viên (backend trả 403): toast + khối lỗi, KHÔNG nói 'Chưa có bài học' (không dùng email/quyền từ frontend)", async ({ page, app }) => {
    const toastShown = armToast(page); // toast sonner tự tắt sau ~4s: bắt đầu chờ TRƯỚC khi mở trang để không lỡ khi máy chậm
    await openLessons(page, app, q("lop-cua-nguoi-khac", "x"));
    const notice = page.locator('[data-testid="lesson-list-notice"]');
    await notice.waitFor();
    await expect(notice).toHaveAttribute("data-kind", "error");
    await expect(notice).toContainText("không có quyền");
    expect(await toastShown).not.toBeNull();
    await expect(page.getByText("Chưa có bài học")).toHaveCount(0);
  });
});

test.describe("quyền: chỉ TEACHER và MENTOR (đúng PrivateRoute HSK cũ của list-lesson)", () => {
  for (const role of ["teacher", "mentor"] as const) {
    test(`${role} vào được`, async ({ page, app }) => {
      await openLessons(page, app, q(), { role });
      await page.waitForSelector(rows);
      await expect(page.getByText("Tổng số 23")).toBeVisible();
    });
  }

  for (const role of ["admin", "teacher-manager", "collaborator", "manager", "user", "none"] as const) {
    test(`${role} bị chặn, không thấy sidebar/nội dung, KHÔNG gọi API buổi học`, async ({ page, app }) => {
      const calls = lessonCalls(page);
      await app.signIn(q(), { role });
      await page.waitForSelector('[data-testid="auth-forbidden"]');
      expect(await page.locator(rows).count()).toBe(0);
      expect(await page.locator(".management-sidebar-column").count()).toBe(0);
      expect(calls).toEqual([]);
    });
  }

  test("chưa đăng nhập => chuyển Auth đúng một lần, redirect về ĐÚNG URL kèm query, KHÔNG gọi API", async ({ page, app }) => {
    const calls: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/(quiz|notification|tickets)/.test(r.url())) calls.push(r.url());
    });
    await page.goto(app.url(q("mock-tc-4", "mock-course-0", "&page=2")));
    await app.waitForLogin();
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(app.url(q("mock-tc-4", "mock-course-0", "&page=2")));
    expect(app.loginVisits()).toBe(1);
    expect(calls).toEqual([]);
  });
});

test.describe("trạng thái dữ liệu", () => {
  test("đang tải (lời gọi buổi học bị giữ lại): spinner, không hiện 'Chưa có bài học'", async ({ page, app }) => {
    // Giữ lời gọi ở trình duyệt cho tới khi test cho phép (xác định, không phụ thuộc độ trễ cố định của mock).
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/api\/quiz\/grading\/classes\/[^/]+\/schedules$/, async (route) => {
      await gate;
      await route.continue();
    });
    await openLessons(page, app, q());
    await expect(page.locator(".spinner-border").first()).toBeVisible();
    await expect(page.getByText("Chưa có bài học")).toHaveCount(0);
    release();
    await page.waitForSelector(rows);
    await expect(page.locator(".spinner-border")).toHaveCount(0);
  });

  test("rỗng thật: 'Chưa có bài học', Tổng số 0, không khối lỗi", async ({ page, app }) => {
    await openLessons(page, app, q(), { state: "empty" });
    await expect(page.getByText("Chưa có bài học")).toBeVisible();
    await expect(page.getByText("Tổng số 0")).toBeVisible();
    expect(await page.locator('[data-testid="lesson-list-notice"]').count()).toBe(0);
  });

  test("API lỗi 500: toast + khối lỗi có 'Thử lại', KHÔNG nói 'Chưa có bài học'", async ({ page, app }) => {
    const toastText = armToast(page);
    await openLessons(page, app, q(), { state: "error" });
    const notice = page.locator('[data-testid="lesson-list-notice"]');
    await notice.waitFor();
    await expect(notice).toHaveAttribute("data-kind", "error");
    expect(await toastText).toContain("Lỗi máy chủ giả lập");
    await expect(page.getByText("Chưa có bài học")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  });

  test("phản hồi sai định dạng: khối lỗi hợp đồng", async ({ page, app }) => {
    await openLessons(page, app, q(), { state: "invalid" });
    await expect(page.locator('[data-testid="lesson-list-notice"]')).toContainText("không đúng định dạng");
  });
});

test.describe("responsive", () => {
  for (const [name, size] of [["tablet", { width: 820, height: 1180 }], ["mobile", { width: 390, height: 844 }]] as const) {
    test(`${name}: trang không cuộn ngang, sidebar xếp trên nội dung, ô tìm kiếm full chiều rộng ở mobile`, async ({ page, app }) => {
      await page.setViewportSize(size);
      await openLessons(page, app);
      await page.waitForSelector(rows);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      const col = (await page.locator(".management-sidebar-column").boundingBox())!;
      const main = (await page.locator(".col-lg-9").boundingBox())!;
      expect(main.y).toBeGreaterThanOrEqual(col.y + col.height - 2);
      const input = (await page.getByLabel("Tìm kiếm").boundingBox())!;
      if (name === "mobile") expect(input.width).toBeGreaterThan(size.width * 0.6);
    });
  }
});
