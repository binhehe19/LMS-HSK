import { describe, expect, it } from "vitest";
import { vocabularyWords } from "@/components/student/timetable/lesson-panels";
import type { TimetableModule } from "@/components/student/timetable/timetable-data";

const vocab = (content: unknown, over: Partial<TimetableModule> = {}): TimetableModule =>
  ({ id: "link", resourceId: "res", title: "t", icon: "doc", kind: "practice", progress: null, description: "", resourceType: "VOCABULARY", content, ...over }) as TimetableModule;

// Nội dung từ vựng ZH (cùng cấu trúc với Từ điển): phiên âm chính không phải phần tử đầu.
const zh = {
  word: "你好",
  imageUrl: "/api/storage/file/img-1",
  pinyins: [
    { pinyin: "nǐ hǎo (phụ)", isPrimary: false, meanings: [{ meaningVi: "nghĩa phụ" }] },
    {
      pinyin: "nǐ hǎo",
      audioUrl: "/api/storage/file/aud-1",
      wordTypes: "Thán từ",
      isPrimary: true,
      meanings: [
        { meaningVi: "xin chào", examples: [{ zh: "你好吗？", pinyin: "nǐ hǎo ma?", vi: "bạn khỏe không?" }, { zh: "你好，老师！", pinyin: "nǐ hǎo, lǎoshī!" }] },
        { meaningEn: "hello", examples: [{ zh: "你好！", pinyin: "nǐ hǎo!" }] },
      ],
    },
  ],
};

describe("vocabularyWords: đọc nội dung từ vựng ZH ở màn học của học viên", () => {
  it("lấy phiên âm chính, từ loại, nghĩa đầu, ví dụ của các nghĩa, hình và âm thanh", () => {
    const [word] = vocabularyWords([vocab(zh)]);
    expect(word).toMatchObject({ word: "你好", pinyin: "nǐ hǎo", pos: "Thán từ", meaning: "xin chào" });
    expect(word.examples).toEqual([
      { cn: "你好吗？", pinyin: "nǐ hǎo ma?", vi: "bạn khỏe không?" },
      { cn: "你好，老师！", pinyin: "nǐ hǎo, lǎoshī!", vi: "" },
      { cn: "你好！", pinyin: "nǐ hǎo!", vi: "" },
    ]);
    expect(word.image).toContain("img-1");
    expect(word.audio).toContain("aud-1");
  });

  it("flashcard dùng nghĩa đầu của phiên âm chính và một ví dụ đi kèm", () => {
    const [word] = vocabularyWords([vocab(zh)], "flashcards");
    expect(word).toMatchObject({ pinyin: "nǐ hǎo", meaning: "xin chào" });
    expect(word.examples).toEqual([{ cn: "你好吗？", pinyin: "nǐ hǎo ma?", vi: "bạn khỏe không?" }]);
  });

  it("không có phiên âm chính đánh dấu thì lấy phiên âm đầu; nghĩa tiếng Việt trống thì dùng nghĩa tiếng Anh", () => {
    const [word] = vocabularyWords([vocab({ word: "好", pinyins: [{ pinyin: "hǎo", meanings: [{ meaningEn: "good" }] }] })]);
    expect(word).toMatchObject({ pinyin: "hǎo", meaning: "good", pos: "", examples: [] });
  });

  it("từ chưa có phiên âm vẫn hiện chữ Hán, không lỗi; mục không có từ bị bỏ; resource không phải từ vựng bị bỏ", () => {
    expect(vocabularyWords([vocab({ word: "空", pinyins: [] })])[0]).toMatchObject({ word: "空", pinyin: "", meaning: "", examples: [] });
    expect(vocabularyWords([vocab({ pinyins: [] })])).toEqual([]);
    expect(vocabularyWords([vocab(zh, { resourceType: "GRAMMAR" })])).toEqual([]);
  });

  it("nhiều từ trong một resource (words[]) đều được đọc theo cùng cấu trúc", () => {
    const words = vocabularyWords([vocab({ words: [zh, { word: "谢谢", pinyins: [{ pinyin: "xièxie", isPrimary: true, meanings: [{ meaningVi: "cảm ơn" }] }] }] })]);
    expect(words.map((w) => [w.word, w.pinyin, w.meaning])).toEqual([["你好", "nǐ hǎo", "xin chào"], ["谢谢", "xièxie", "cảm ơn"]]);
  });
});
