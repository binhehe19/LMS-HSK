import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerFields } from "@/components/student/timetable/lesson-answer-fields";
import { LessonAttemptPlayer } from "@/components/student/timetable/lesson-attempt-player";
import { LessonAudioAnswer } from "@/components/student/timetable/lesson-audio-answer";
import { LessonFileAnswer } from "@/components/student/timetable/lesson-file-answer";
import type { AssessmentAttemptResponse } from "@/lib/api/assessment-attempt-client";
import { answerAudio, answerFiles, encodeAudio, encodeFiles } from "@/lib/assessment/answer-codec";

const storage = vi.hoisted(() => ({ uploadFile: vi.fn() }));
vi.mock("@/lib/api/storage-client", () => ({ uploadFile: storage.uploadFile, fileUrl: (id?: string) => (id ? `/api/storage/file/${id}` : null) }));
const client = vi.hoisted(() => ({ acquireLock: vi.fn(), releaseLock: vi.fn(), releaseLockOnUnload: vi.fn(), heartbeat: vi.fn(), submitAttempt: vi.fn() }));
vi.mock("@/lib/api/assessment-attempt-client", () => client);

const pick = (input: HTMLElement, ...files: File[]) => fireEvent.change(input, { target: { files } });
const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });
const META = { fileId: "f1", filename: "bai.pdf", mimeType: "application/pdf", sizeBytes: 10 };

beforeEach(() => {
  vi.clearAllMocks();
  storage.uploadFile.mockResolvedValue(META);
});

describe("answer-codec — đáp án tệp và ghi âm", () => {
  it("mã hoá đúng khoá backend; rỗng khi chưa có; đọc lại được", () => {
    const ref = { fileId: "a", fileName: "x.webm", mimeType: "audio/webm", sizeBytes: 5, durationSeconds: 3.2 };
    expect(encodeAudio(null)).toBe("");
    expect(JSON.parse(encodeAudio(ref))).toEqual({ audio: ref });
    expect(answerAudio(encodeAudio(ref))).toEqual(ref);
    expect(encodeFiles([])).toBe("");
    expect(answerFiles(encodeFiles([ref, { fileId: "b" }])).map((f) => f.fileId)).toEqual(["a", "b"]);
    expect(answerAudio("")).toBeNull();
    expect(answerFiles("không phải json")).toEqual([]);
  });
});

describe("LessonFileAnswer — nộp tệp", () => {
  const setup = (props = {}) => {
    const onChange = vi.fn();
    const onBusyChange = vi.fn();
    render(<LessonFileAnswer value={[]} onChange={onChange} onBusyChange={onBusyChange} maxFiles={2} maxFileSizeBytes={100} acceptedMimeTypes={["application/pdf", ".docx"]} {...props} />);
    return { onChange, onBusyChange };
  };

  it("tải lên rồi báo danh sách tệp (tên lấy từ storage), bận trong lúc tải", async () => {
    const { onChange, onBusyChange } = setup();
    pick(screen.getByLabelText("Chọn tệp nộp"), file("bai.pdf", "application/pdf"));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([{ fileId: "f1", fileName: "bai.pdf", mimeType: "application/pdf", sizeBytes: 10 }]));
    expect(onBusyChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it("từ chối tệp quá lớn, sai loại hoặc quá số lượng; không gọi tải lên", async () => {
    setup();
    const input = screen.getByLabelText("Chọn tệp nộp");
    pick(input, file("to.pdf", "application/pdf", 500));
    expect(await screen.findByText(/lớn hơn/)).toBeInTheDocument();
    pick(input, file("a.png", "image/png"));
    expect(await screen.findByText(/không thuộc loại tệp được phép/)).toBeInTheDocument();
    pick(input, file("1.pdf", "application/pdf"), file("2.pdf", "application/pdf"), file("3.pdf", "application/pdf"));
    expect(await screen.findByText(/tối đa 2 tệp/)).toBeInTheDocument();
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it("đuôi tệp trong danh sách cho phép được nhận (.docx)", async () => {
    const { onChange } = setup();
    storage.uploadFile.mockResolvedValue({ fileId: "f2", filename: "a.docx", mimeType: "", sizeBytes: 10 });
    pick(screen.getByLabelText("Chọn tệp nộp"), file("a.docx", ""));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("lỗi tải lên hiện thông báo, không ghi tệp; bỏ một tệp đã nộp", async () => {
    storage.uploadFile.mockRejectedValue(new Error("Kho lưu trữ lỗi"));
    const { onChange } = setup();
    pick(screen.getByLabelText("Chọn tệp nộp"), file("bai.pdf", "application/pdf"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Kho lưu trữ lỗi");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("bỏ tệp đã nộp", () => {
    const onChange = vi.fn();
    render(<LessonFileAnswer value={[{ fileId: "a", fileName: "a.pdf" }, { fileId: "b", fileName: "b.pdf" }]} onChange={onChange} />);
    fireEvent.click(screen.getAllByTitle("Bỏ tệp này")[0]);
    expect(onChange).toHaveBeenCalledWith([{ fileId: "b", fileName: "b.pdf" }]);
  });
});

describe("LessonAudioAnswer — ghi âm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
  });

  it("không có MediaRecorder: chỉ cho chọn tệp âm thanh; tải lên rồi báo {fileId, fileName, mimeType, sizeBytes}", async () => {
    storage.uploadFile.mockResolvedValue({ fileId: "au1", filename: "ghi.webm", mimeType: "audio/webm", sizeBytes: 10 });
    const onChange = vi.fn();
    render(<LessonAudioAnswer value={null} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Bắt đầu thu âm" })).toBeNull();
    pick(screen.getByLabelText("Tệp âm thanh"), file("ghi.webm", "audio/webm"));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ fileId: "au1", fileName: "ghi.webm", mimeType: "audio/webm", sizeBytes: 10, durationSeconds: undefined }));
  });

  it("thu âm bằng micro: bấm ghi rồi dừng thì tải bản ghi lên kèm thời lượng", async () => {
    class FakeRecorder {
      static isTypeSupported = () => true;
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["abc"]) }); this.onstop?.(); }
    }
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    const track = { stop: vi.fn() };
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) }, configurable: true });
    storage.uploadFile.mockResolvedValue({ fileId: "rec1", filename: "x.webm", mimeType: "audio/webm", sizeBytes: 3 });
    const onChange = vi.fn();
    const onBusyChange = vi.fn();
    render(<LessonAudioAnswer value={null} onChange={onChange} onBusyChange={onBusyChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thu âm" }));
    const stop = await screen.findByRole("button", { name: "Dừng thu âm" });
    await act(async () => fireEvent.click(stop));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(storage.uploadFile.mock.calls[0][0]).toMatchObject({ type: "audio/webm" });
    expect(onChange.mock.calls[0][0]).toMatchObject({ fileId: "rec1", mimeType: "audio/webm", sizeBytes: 3 });
    expect(typeof onChange.mock.calls[0][0].durationSeconds).toBe("number");
    expect(track.stop).toHaveBeenCalled(); // micro được tắt sau khi ghi
    expect(onBusyChange.mock.calls.at(-1)?.[0]).toBe(false);
  });

  it("micro bị từ chối: báo lỗi, vẫn chọn được tệp", async () => {
    vi.stubGlobal("MediaRecorder", class { static isTypeSupported = () => true; });
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    render(<LessonAudioAnswer value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu thu âm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Không truy cập được micro/);
    expect(screen.getByRole("button", { name: "Chọn tệp âm thanh" })).not.toBeDisabled();
  });

  it("tải lên lỗi: có nút thử tải lại bản ghi", async () => {
    storage.uploadFile.mockRejectedValueOnce(new Error("Mất mạng")).mockResolvedValueOnce({ fileId: "au2", filename: "g.webm", mimeType: "audio/webm", sizeBytes: 10 });
    const onChange = vi.fn();
    render(<LessonAudioAnswer value={null} onChange={onChange} />);
    pick(screen.getByLabelText("Tệp âm thanh"), file("g.webm", "audio/webm"));
    fireEvent.click(await screen.findByRole("button", { name: "Thử tải lại bản ghi" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fileId: "au2" })));
  });
});

describe("AnswerFields — câu ghi âm và nộp tệp ghi đáp án đúng định dạng", () => {
  it("nộp tệp: đọc maxFiles / loại tệp từ câu hỏi và ghi {files:[...]}", async () => {
    const onChange = vi.fn();
    render(<AnswerFields question={{ questionType: "FILE_UPLOAD", questionId: "q", maxFiles: 1, acceptedMimeTypes: ["application/pdf"] }} value="" onChange={onChange} />);
    pick(screen.getByLabelText("Chọn tệp nộp"), file("bai.pdf", "application/pdf"));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(JSON.parse(onChange.mock.calls[0][0])).toEqual({ files: [{ fileId: "f1", fileName: "bai.pdf", mimeType: "application/pdf", sizeBytes: 10 }] });
  });

  it("ghi âm: ghi {audio:{...}}; xoá bản ghi trả chuỗi rỗng", async () => {
    storage.uploadFile.mockResolvedValue({ fileId: "au", filename: "g.webm", mimeType: "audio/webm", sizeBytes: 4 });
    const onChange = vi.fn();
    const { rerender } = render(<AnswerFields question={{ questionType: "AUDIO_RESPONSE", questionId: "q" }} value="" onChange={onChange} />);
    pick(screen.getByLabelText("Tệp âm thanh"), file("g.webm", "audio/webm", 4));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const answer = onChange.mock.calls[0][0];
    expect(JSON.parse(answer).audio).toMatchObject({ fileId: "au", mimeType: "audio/webm" });
    rerender(<AnswerFields question={{ questionType: "AUDIO_RESPONSE", questionId: "q" }} value={answer} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Xoá bản ghi" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});

describe("LessonAttemptPlayer — chặn nộp bài khi đang tải tệp", () => {
  it("nút Nộp bài khoá trong lúc tải lên, mở lại khi xong và đáp án tệp được gửi khi nộp", async () => {
    client.acquireLock.mockResolvedValue({ acquired: true, holderUserId: "u", lockExpiresAt: null, serverNow: new Date().toISOString(), endsAt: null });
    client.releaseLock.mockResolvedValue({});
    client.heartbeat.mockResolvedValue({ lockRenewed: true, savedAnswerIds: ["q1"], remainingSeconds: null, effectiveStatus: "IN_PROGRESS" });
    client.submitAttempt.mockResolvedValue({ attemptId: "a1", answersIgnored: false, submittedAt: "" });
    let finish: (v: unknown) => void = () => {};
    storage.uploadFile.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const attempt = { attemptId: "a1", status: "IN_PROGRESS", remainingSeconds: null, savedAnswers: [], questions: [] } as unknown as AssessmentAttemptResponse;
    render(<LessonAttemptPlayer attempt={attempt} title="Bài" content={{}} questions={[{ questionId: "q1", questionType: "FILE_UPLOAD", questionText: "Nộp bài viết" }]} skill="writing" skillName="Viết" onSubmitted={vi.fn()} />);

    const input = await screen.findByLabelText("Chọn tệp nộp");
    await waitFor(() => expect(screen.getByRole("button", { name: "Chọn tệp" })).not.toBeDisabled());
    pick(input, file("bai.pdf", "application/pdf"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Nộp bài" })).toBeDisabled());
    expect(screen.getByText(/chờ xong rồi nộp bài/)).toBeInTheDocument();

    await act(async () => finish(META));
    await waitFor(() => expect(screen.getByRole("button", { name: "Nộp bài" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận nộp" }));
    await waitFor(() => expect(client.submitAttempt).toHaveBeenCalled());
    const answers = client.submitAttempt.mock.calls[0][2] as { questionId: string; answerJson: string }[];
    expect(JSON.parse(answers.find((a) => a.questionId === "q1")!.answerJson)).toEqual({ files: [{ fileId: "f1", fileName: "bai.pdf", mimeType: "application/pdf", sizeBytes: 10 }] });
  });
});
