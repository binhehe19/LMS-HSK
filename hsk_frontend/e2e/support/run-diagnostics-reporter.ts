// Reporter chẩn đoán cho lần chạy Playwright: ghi đủ thông tin để phân biệt "test treo" với "máy ngủ/đứng tiến trình" (M3B.4, điều tra lần chạy 2,6 giờ).
//
// Bằng chứng vụ 2,6 giờ: nhật ký Windows (Power-Troubleshooter) ghi máy ngủ 12:04:32 → 14:20:01 (2h15m) đúng trong lúc chạy; tổng thời gian các test chỉ ~12 phút.
// Reporter này làm cho việc đó thấy ngay trong log lần sau, không cần đào nhật ký hệ điều hành:
//   - "NHẢY ĐỒNG HỒ": nhịp 30 giây bị trễ > 90 giây => tiến trình bị đóng băng (ngủ/treo máy), không phải test chậm.
//   - Test kéo dài quá 1,5 lần timeout của nó => đánh dấu nghi ngờ đóng băng (timer của test hết hạn ngay khi máy thức dậy).
//   - Test lỗi/hết giờ: ghi giờ bắt đầu/kết thúc thật, thời lượng, dự án, file:dòng.
// Không đổi kết quả test; chỉ in thêm ra stdout (kèm reporter "list").
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from "@playwright/test/reporter";

const HEARTBEAT_MS = 30_000;
const JUMP_THRESHOLD_MS = 90_000;
const stamp = () => `${new Date().toISOString().replace("T", " ").slice(0, 19)}Z`; // giờ UTC

export default class RunDiagnosticsReporter implements Reporter {
  private startedAt = 0;
  private beat: NodeJS.Timeout | undefined;
  private lastBeat = 0;
  private jumps: { at: string; seconds: number }[] = [];
  private suspicious: string[] = [];
  private testTimeout = 0;

  onBegin(config: FullConfig, suite: Suite) {
    this.startedAt = Date.now();
    this.lastBeat = this.startedAt;
    this.testTimeout = config.projects[0]?.timeout ?? config.metadata?.timeout ?? 0;
    console.log(`[diag] ${stamp()} bắt đầu: ${suite.allTests().length} test, workers=${config.workers}, timeout/test=${this.testTimeout}ms, globalTimeout=${config.globalTimeout}ms`);
    this.beat = setInterval(() => {
      const now = Date.now();
      const gap = now - this.lastBeat;
      this.lastBeat = now;
      if (gap > JUMP_THRESHOLD_MS) {
        const seconds = Math.round((gap - HEARTBEAT_MS) / 1000);
        this.jumps.push({ at: stamp(), seconds });
        console.log(`[diag] ${stamp()} NHẢY ĐỒNG HỒ: tiến trình bị đóng băng ~${seconds}s (máy ngủ/treo?) — các test đang chạy lúc này có thể hết giờ vì lý do này, không phải do lỗi ứng dụng`);
      }
    }, HEARTBEAT_MS);
    this.beat.unref();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const limit = test.timeout || this.testTimeout;
    const where = `${test.location.file.split(/[\\/]/).slice(-1)[0]}:${test.location.line}`;
    if (result.status === "timedOut" || result.status === "failed") {
      console.log(`[diag] ${stamp()} ${result.status.toUpperCase()} [${test.parent.project()?.name}] ${where} bắt đầu ${result.startTime.toISOString().slice(11, 19)}Z, kéo dài ${Math.round(result.duration / 1000)}s (giới hạn ${Math.round(limit / 1000)}s)`);
    }
    if (limit > 0 && result.duration > limit * 1.5) {
      const note = `${where} kéo dài ${Math.round(result.duration / 1000)}s > 1,5 × timeout (${Math.round(limit / 1000)}s): nghi ngờ tiến trình bị đóng băng`;
      this.suspicious.push(note);
      console.log(`[diag] ${stamp()} NGHI NGỜ ĐÓNG BĂNG: ${note}`);
    }
  }

  onError(error: { message?: string }) {
    console.log(`[diag] ${stamp()} LỖI CẤP RUN: ${String(error.message ?? error).split("\n")[0]}`);
  }

  onEnd(result: FullResult) {
    if (this.beat) clearInterval(this.beat);
    const wall = Math.round((Date.now() - this.startedAt) / 1000);
    const frozen = this.jumps.reduce((sum, j) => sum + j.seconds, 0);
    console.log(`[diag] ${stamp()} kết thúc: ${result.status}, tổng ${wall}s, đóng băng phát hiện ${frozen}s (${this.jumps.length} lần), test nghi ngờ ${this.suspicious.length}`);
    if (frozen > 60) console.log(`[diag] Lưu ý: ${frozen}s trong tổng ${wall}s là thời gian tiến trình bị đóng băng — thời gian chạy test thực tế ≈ ${wall - frozen}s.`);
  }

  printsToStdio() {
    return false;
  }
}
