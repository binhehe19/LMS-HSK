// Độ trung thực CSS so với HSK cũ: chèn một DOM gồm ~90 thành phần/tiện ích của template (Bootstrap + SCSS cũ) và nút ở trạng thái hover vào trang,
// rồi so style tính toán với giá trị chuẩn ghi từ CHÍNH HSK cũ (e2e/fixtures/css-golden.json, tạo bằng scripts/record-css-golden.mjs).
// Lý do tồn tại và lịch sử phát hiện (Turbopack làm rơi `.shadow-sm`): xem e2e/support/css-probe.ts và docs/M3B2-WELCOME.md.
import golden from "../fixtures/css-golden.json";
import { HOVER_CLASSES, HOVER_PROPS, injectHoverProbe, normalizeProbeValue, PROBE_CLASSES, PROBE_PROPS, runProbe } from "../support/css-probe";
import { expect, test } from "../support/test";

test.beforeEach(async ({ page, app }) => {
  await app.signIn("/instructor/welcome", { role: "teacher" });
  await page.waitForSelector(".welcome-hero-card");
});

test("danh sách thành phần khớp giá trị chuẩn (đổi danh sách => phải ghi lại giá trị chuẩn từ HSK cũ)", () => {
  expect(golden.rest.map((r) => r.cls)).toEqual(PROBE_CLASSES);
  expect(golden.hover.map((r) => r.cls)).toEqual(HOVER_CLASSES);
  for (const r of golden.rest) expect(Object.keys(r.props)).toEqual(PROBE_PROPS);
});

test("style tính toán của ~90 thành phần/tiện ích template giống HSK cũ", async ({ page }) => {
  const actual = await page.evaluate(runProbe, { classes: PROBE_CLASSES, props: PROBE_PROPS });
  const diffs: string[] = [];
  actual.forEach((el, i) => {
    for (const prop of PROBE_PROPS) {
      const want = golden.rest[i].props[prop as keyof (typeof golden.rest)[number]["props"]] as string;
      const got = normalizeProbeValue(el.props[prop]);
      if (got !== want) diffs.push(`[${el.cls}] ${prop}: HSK cũ=${want}  mới=${got}`);
    }
  });
  expect(diffs, `Lệch so với HSK cũ:\n${diffs.slice(0, 20).join("\n")}`).toEqual([]);
});

test("trạng thái :hover của các nút template giống HSK cũ", async ({ page }) => {
  await page.evaluate(injectHoverProbe, HOVER_CLASSES);
  const diffs: string[] = [];
  for (let i = 0; i < HOVER_CLASSES.length; i++) {
    const el = page.locator(`[data-probe-hover="${i}"]`);
    await el.hover();
    const got = await el.evaluate((node, props) => Object.fromEntries(props.map((p) => [p, getComputedStyle(node).getPropertyValue(p)])), HOVER_PROPS);
    for (const prop of HOVER_PROPS) {
      const want = golden.hover[i].props[prop as keyof (typeof golden.hover)[number]["props"]] as string;
      if (normalizeProbeValue(got[prop]) !== want) diffs.push(`[${HOVER_CLASSES[i]}:hover] ${prop}: HSK cũ=${want}  mới=${normalizeProbeValue(got[prop])}`);
    }
  }
  expect(diffs, `Lệch so với HSK cũ:\n${diffs.slice(0, 20).join("\n")}`).toEqual([]);
});
