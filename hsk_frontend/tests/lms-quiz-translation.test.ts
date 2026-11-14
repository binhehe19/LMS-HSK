import { describe, expect, it } from "vitest";
import { fromBackendQuestion, mergeLayout, partCount, toBackendQuestion } from "@/lib/api/lms-quiz-client";
import { sectionOfQuestion, sectionParagraphs } from "@/components/student/timetable/lesson-section";

// Lưu một câu qua HSK không được làm mất field mà HSK không có ô sửa (soạn ở IELTS).
const roundTrip = (backend: Record<string, unknown>, edit: (q: ReturnType<typeof fromBackendQuestion>) => void = () => {}) => {
  const q = fromBackendQuestion("quiz", 0, backend);
  edit(q);
  return toBackendQuestion(q) as Record<string, unknown>;
};

describe("lms-quiz-client — dịch câu hỏi HSK <-> backend", () => {
  it("ESSAY: giữ gợi ý, rubric AI, đề số, số từ tối thiểu khi sửa nội dung", () => {
    const essay = { questionId: "e1", questionType: "ESSAY", questionText: "Viết", points: 5, hints: [{ text: "gợi ý" }], aiRubric: "rubric", task: 2, minimumWords: 250, referenceText: "mẫu" };
    const out = roundTrip(essay, (q) => { q.prompt = "Viết lại"; });
    expect(out).toMatchObject({ questionText: "Viết lại", hints: [{ text: "gợi ý" }], aiRubric: "rubric", task: 2, minimumWords: 250, referenceText: "mẫu" });
  });

  it("nối cặp: giải thích từng dòng đi theo dòng, kể cả khi xoá một dòng giữa", () => {
    const matching = {
      questionId: "m1", questionType: "MATCHING", questionText: "Nối", points: 4,
      options: [{ optionIndex: 0, content: "a" }, { optionIndex: 1, content: "b" }, { optionIndex: 2, content: "c" }],
      matchingPairs: [{ pairIndex: 0, prompt: "1", answer: "a", explanation: "e-a" }, { pairIndex: 1, prompt: "2", answer: "b", explanation: "e-b" }, { pairIndex: 2, prompt: "3", answer: "c", explanation: "e-c" }],
    };
    const out = roundTrip(matching, (q) => { q.pairs = q.pairs!.filter((p) => p.left !== "2"); });
    expect((out.matchingPairs as { prompt: string; explanation: string; pairIndex: number }[]).map((p) => [p.pairIndex, p.prompt, p.explanation])).toEqual([[0, "1", "e-a"], [1, "3", "e-c"]]);
  });

  it("điền chỗ trống: gợi ý từng chỗ trống được giữ, {{n}} khớp số đáp án", () => {
    const fill = { questionId: "f1", questionType: "FILL_IN_BLANK", questionText: "Tôi {{1}} học", points: 2, blanks: [{ blankIndex: 0, correctAnswer: "đi", hint: "động từ" }] };
    const out = roundTrip(fill);
    expect(out.questionText).toBe("Tôi {{1}} học");
    expect(out.blanks).toEqual([{ blankIndex: 0, correctAnswer: "đi", hint: "động từ" }]);
  });

  it("đổi loại câu thì bỏ field của loại cũ", () => {
    const essay = { questionId: "e2", questionType: "ESSAY", questionText: "Viết", points: 5, aiRubric: "rubric", minimumWords: 100 };
    const out = roundTrip(essay, (q) => { q.type = "AUDIO_RESPONSE"; });
    expect(out.questionType).toBe("AUDIO_RESPONSE");
    expect(out.aiRubric).toBeUndefined();
    expect(out.minimumWords).toBeUndefined();
  });

  it("Đúng/Sai → trắc nghiệm bỏ variant TRUE_FALSE; variant khác của trắc nghiệm được giữ", () => {
    const tf = { questionId: "t1", questionType: "MULTIPLE_CHOICE", variant: "TRUE_FALSE", questionText: "x", points: 1, options: [{ optionIndex: 0, content: "Đúng", correct: true }, { optionIndex: 1, content: "Sai", correct: false }] };
    const mc = roundTrip(tf, (q) => { q.type = "MULTIPLE_CHOICE"; q.options = [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }]; });
    expect(mc.variant).toBeUndefined();
    const other = roundTrip({ ...tf, variant: "TFNG" }, (q) => { q.type = "MULTIPLE_CHOICE"; q.options = [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }]; });
    expect(other.variant).toBe("TFNG");
  });

  it("chọn nhiều / nộp tệp: đi nguyên vẹn, không bị đổi thành trắc nghiệm", () => {
    const multi = { questionId: "s1", questionType: "MULTIPLE_SELECT", questionText: "Chọn", points: 3, options: [{ optionIndex: 0, content: "a", correct: true }, { optionIndex: 1, content: "b", correct: true }] };
    expect(roundTrip(multi)).toEqual(multi);
    const upload = { questionId: "u1", questionType: "FILE_UPLOAD", questionText: "Nộp", points: 3, maxFiles: 2, acceptedMimeTypes: ["application/pdf"] };
    expect(roundTrip(upload)).toEqual(upload);
  });

  it("audio: đổi tệp thì thay audio, giữ video; bỏ audio thì chỉ còn video", () => {
    const q = { questionId: "a1", questionType: "AUDIO_RESPONSE", questionText: "Nói", points: 2, media: [{ kind: "audio", url: "/api/storage/file/old" }, { kind: "video", url: "/api/storage/file/vid" }] };
    expect(roundTrip(q, (x) => { x.audioFileId = "new"; }).media).toEqual([{ kind: "audio", url: "/api/storage/file/new" }, { kind: "video", url: "/api/storage/file/vid" }]);
    expect(roundTrip(q, (x) => { x.audioFileId = undefined; }).media).toEqual([{ kind: "video", url: "/api/storage/file/vid" }]);
  });
});

describe("lms-quiz-client — mergeLayout", () => {
  const existing = {
    version: 2,
    meta: { skill: "READING", examType: "giữ" },
    sections: [
      { id: "s1", title: "Passage 1", content: "<p>đoạn</p>", files: [{ url: "/api/storage/file/f1" }], questionIds: ["q1", "q2"] },
      { id: "s2", title: "Passage 2", questionIds: ["q3"] },
    ],
  };

  it("giữ nội dung/tệp của phần và khoá meta lạ, bỏ câu đã xoá, thêm câu mới vào phần cuối", () => {
    const out = mergeLayout(existing, ["q1", "q3", "q4"], { skill: "LISTENING" }, "Tiêu đề");
    expect(out.sections).toEqual([
      { id: "s1", title: "Passage 1", content: "<p>đoạn</p>", files: [{ url: "/api/storage/file/f1" }], questionIds: ["q1"] },
      { id: "s2", title: "Passage 2", questionIds: ["q3", "q4"] },
    ]);
    expect(out.meta).toEqual({ skill: "LISTENING", examType: "giữ" });
  });

  it("chưa có layout: dựng một phần chứa mọi câu", () => {
    expect(mergeLayout(undefined, ["a", "b"], {}, "T")).toMatchObject({ version: 2, sections: [{ id: "section-1", title: "T", questionIds: ["a", "b"] }] });
  });

  it("đoạn đọc, audio, ảnh cả bài vào phần đầu; giữ tệp/audio khác của phần", () => {
    const withAssets = {
      sections: [{ id: "s1", questionIds: ["q1"], content: "cũ", media: [{ kind: "audio", url: "/api/storage/file/a-old" }, { kind: "audio", url: "/api/storage/file/a-2" }], files: [{ url: "/api/storage/file/doc", name: "de.pdf", mimeType: "application/pdf" }] }],
    };
    const out = mergeLayout(withAssets, ["q1"], {}, "T", { content: "Đoạn mới", audioFileId: "a-new", imageFileId: "img1" });
    expect(out.sections![0]).toMatchObject({
      content: "Đoạn mới",
      media: [{ kind: "audio", url: "/api/storage/file/a-new" }, { kind: "audio", url: "/api/storage/file/a-2" }],
      files: [{ url: "/api/storage/file/img1", name: "passage-image", mimeType: "image/*" }, { url: "/api/storage/file/doc", name: "de.pdf", mimeType: "application/pdf" }],
    });
  });

  it("xoá đoạn đọc/audio/ảnh: chỉ bỏ phần HSK sở hữu, tệp khác còn", () => {
    const existing = {
      sections: [{ id: "s1", questionIds: ["q1"], content: "x", media: [{ kind: "audio", url: "/api/storage/file/a1" }], files: [{ url: "/api/storage/file/img", name: "a.png" }, { url: "/api/storage/file/doc", name: "de.pdf" }] }],
    };
    const first = mergeLayout(existing, ["q1"], {}, "T", {}).sections![0];
    expect(first.content).toBeUndefined();
    expect(first.media).toBeUndefined();
    expect(first.files).toEqual([{ url: "/api/storage/file/doc", name: "de.pdf" }]);
  });
});

describe("màn học viên — phần chứa câu hỏi", () => {
  const content = { layout: { sections: [{ id: "s1", content: "<p>Đoạn một</p>", questionIds: ["q1"] }, { id: "s2", questionIds: ["q2", "q3"] }] } };

  it("tìm đúng phần theo questionId; không có thì null", () => {
    expect(sectionOfQuestion(content, "q3")).toMatchObject({ id: "s2" });
    expect(sectionOfQuestion(content, "q9")).toBeNull();
    expect(sectionOfQuestion({}, "q1")).toBeNull();
    expect(sectionOfQuestion(content, undefined)).toBeNull();
  });

  it("văn bản của phần thành các đoạn thuần, thẻ HTML bị bỏ (không render HTML)", () => {
    expect(sectionParagraphs("<p>Đoạn <b>một</b></p><p>Đoạn&nbsp;hai<br>dòng ba</p>")).toEqual(["Đoạn một", "Đoạn hai", "dòng ba"]);
    expect(sectionParagraphs('<img src=x onerror="alert(1)">hello')).toEqual(["hello"]);
    expect(sectionParagraphs(undefined)).toEqual([]);
  });
});

describe("lms-quiz-client — partCount", () => {
  it("câu nối đếm theo dòng, câu điền theo chỗ trống, còn lại là 1", () => {
    expect(partCount([
      { questionType: "MULTIPLE_CHOICE" },
      { questionType: "MATCHING", matchingPairs: [{}, {}, {}, {}] },
      { questionType: "FILL_IN_BLANK", blanks: [{}, {}, {}, {}, {}] },
      { questionType: "ESSAY" },
      { questionType: "MATCHING", matchingPairs: [] },
    ])).toBe(1 + 4 + 5 + 1 + 1);
    expect(partCount(undefined)).toBe(0);
  });
});
