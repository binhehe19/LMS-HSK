// Port NGUYÊN NGHĨA của LMS_Frontend/src/features/instructor/class-management/class-management.helpers.ts (hàm thuần dùng chung cho các màn chấm bài:
// định dạng điểm, tông màu, điểm mặc định của câu, tổng quan chấm, trạng thái "đã gửi"/"sẵn sàng gửi"). Không import React/Next, không gọi API.
// Bỏ các export không có nơi dùng ở HSK cũ (GRADING_STATUS_LABEL, renderAnswer, hasUnsentGradedAnswers).

export const formatScore = (value?: number | null): string => {
  if (value === null || value === undefined) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

/** Chọn màu điểm theo tỷ lệ trên thang 100, kể cả khi bài có điểm tối đa khác 100. */
export const scoreToneClass = (score?: number | null, maxScore?: number | null): string => {
  if (score === null || score === undefined || !Number.isFinite(score)) return "cm-score-tone--muted";
  const percentage = maxScore && maxScore > 0 ? (score / maxScore) * 100 : score;
  if (percentage < 60) return "cm-score-tone--low";
  if (percentage < 85) return "cm-score-tone--mid";
  return "cm-score-tone--high";
};

/** Chọn màu viền và chữ cho vòng tròn tiến độ (% hoàn thành) đồng bộ với mức màu điểm. */
export const getProgressToneColors = (percent?: number | null, submittedAny = true): { stroke: string; text: string } => {
  if (percent === null || percent === undefined || !Number.isFinite(percent) || !submittedAny || percent <= 0) {
    return { stroke: "#e5e7eb", text: "#9ca3af" };
  }
  if (percent < 60) return { stroke: "#ef4444", text: "#dc2626" };
  if (percent < 85) return { stroke: "#f59e0b", text: "#d97706" };
  return { stroke: "#22c55e", text: "#16a34a" };
};

/**
 * Lọc input ô nhập điểm: chỉ giữ chữ số và tối đa 1 dấu chấm thập phân. Chặn chữ, khoảng trắng, "e"/"+"/"-" (điểm không âm, không ký hiệu khoa học)
 * — dùng cho cả onChange (paste) lẫn phòng khi type="number" không lọc hết ký tự.
 */
export const sanitizeScoreInput = (raw: string): string => {
  const digitsAndDot = raw.replace(/[^0-9.]/g, "");
  const firstDotIndex = digitsAndDot.indexOf(".");
  if (firstDotIndex === -1) return digitsAndDot;
  const before = digitsAndDot.slice(0, firstDotIndex + 1);
  const after = digitsAndDot.slice(firstDotIndex + 1).replace(/\./g, "");
  return before + after;
};

/** Câu đã được máy chấm đúng/sai (trắc nghiệm, điền khuyết, ...). */
const isAutoGradedQuestion = (question: { isCorrect?: boolean | null }) => question.isCorrect === true || question.isCorrect === false;

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === null || v === undefined ? [] : [v]);

const textify = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(textify).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const row = v as Record<string, unknown>;
    const pick = row.answer ?? row.value ?? row.text ?? row.content ?? row.id;
    return pick !== undefined ? textify(pick) : JSON.stringify(v);
  }
  return String(v);
};

const studentPairMap = (studentAnswer: unknown): Record<string, string> => {
  const map: Record<string, string> = {};
  let items: unknown = studentAnswer;
  if (studentAnswer && typeof studentAnswer === "object" && !Array.isArray(studentAnswer)) {
    const obj = studentAnswer as Record<string, unknown>;
    if (Array.isArray(obj.pairMatches)) items = obj.pairMatches;
    else if (Array.isArray(obj.matchAnswers)) items = obj.matchAnswers;
    else {
      Object.entries(obj).forEach(([k, v]) => {
        map[String(k)] = textify(v);
      });
      return map;
    }
  }
  asArray(items).forEach((it) => {
    if (!it || typeof it !== "object") return;
    const row = it as Record<string, unknown>;
    const prompt = row.promptId ?? row.leftItemId ?? row.leftId ?? row.left;
    const answer = row.answerId ?? row.rightItemId ?? row.rightId ?? row.right ?? row.answer;
    if (prompt != null) map[String(prompt)] = answer != null ? String(answer) : "";
  });
  return map;
};

const countCorrectMatchingPairs = (question: { matchingPairs?: { id?: string }[]; studentAnswer?: unknown }): number => {
  const pairs = question.matchingPairs || [];
  const chosen = studentPairMap(question.studentAnswer);
  return pairs.filter((p) => {
    const id = String(p.id);
    return chosen[id] && String(chosen[id]) === id;
  }).length;
};

const countCorrectBlanks = (question: { blanks?: { index?: number; correctAnswer?: string }[]; studentAnswer?: unknown }): number => {
  const blanks = question.blanks || [];
  const student = question.studentAnswer;
  const studentBlank = (idx: number): string => {
    if (Array.isArray(student)) {
      const found = student.find((x) => {
        if (!x || typeof x !== "object") return false;
        const row = x as Record<string, unknown>;
        return (row.blankIndex ?? row.index) === idx;
      });
      return found && typeof found === "object" ? textify((found as Record<string, unknown>).answer ?? (found as Record<string, unknown>).value ?? found) : "";
    }
    if (student && typeof student === "object") {
      const obj = student as Record<string, unknown>;
      return textify(obj[idx] ?? obj[String(idx)] ?? "");
    }
    return idx === 0 ? textify(student) : "";
  };

  return blanks.filter((b) => {
    const idx = b.index ?? 0;
    const ans = studentBlank(idx).trim().toLowerCase();
    const correct = String(b.correctAnswer || "").trim().toLowerCase();
    return ans.length > 0 && ans === correct;
  }).length;
};

/** Tính điểm từng phần cho nối cặp / điền khuyết (đúng bao nhiêu cặp/ô thì được bấy nhiêu điểm). */
export const computePartialAutoScore = (question: {
  questionType?: string;
  maxScore?: number | null;
  matchingPairs?: { id?: string }[];
  blanks?: { index?: number; correctAnswer?: string }[];
  studentAnswer?: unknown;
}): number | null => {
  const max = question.maxScore ?? 0;

  if (question.matchingPairs?.length) {
    const total = question.matchingPairs.length;
    const correct = countCorrectMatchingPairs(question);
    return total === 0 ? 0 : Math.round((correct / total) * max);
  }

  if (question.blanks?.length) {
    const total = question.blanks.length;
    const correct = countCorrectBlanks(question);
    return total === 0 ? 0 : Math.round((correct / total) * max);
  }

  return null;
};

/** Điểm mặc định: ưu tiên điểm GV đã lưu, sau đó đúng/sai tự chấm, cuối cùng autoScore. */
export const getDefaultQuestionScore = (question: {
  teacherScore?: number | null;
  isCorrect?: boolean | null;
  maxScore?: number | null;
  autoScore?: number | null;
  questionType?: string;
  matchingPairs?: { id?: string }[];
  blanks?: { index?: number; correctAnswer?: string }[];
  studentAnswer?: unknown;
}): string => {
  if (question.teacherScore != null) return String(question.teacherScore);
  if (question.isCorrect === true) return String(question.maxScore ?? 0);

  const partial = computePartialAutoScore(question);
  if (partial !== null) return String(partial);

  if (question.autoScore != null) return String(question.autoScore);
  if (isAutoGradedQuestion(question)) return "0";
  return "";
};

export type ScorableQuestion = Parameters<typeof getDefaultQuestionScore>[0];

/** Điểm số của 1 câu (dùng chung logic với màn chấm chi tiết). */
const resolveQuestionScoreNumber = (question: ScorableQuestion): number => {
  const raw = getDefaultQuestionScore(question);
  if (raw === "") return 0;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/** Tổng điểm bài = cộng điểm từng câu (kể cả nối cặp tính từng phần). */
export const computeAttemptScoreFromQuestions = (questions: ScorableQuestion[] = []): number => questions.reduce((sum, q) => sum + resolveQuestionScoreNumber(q), 0);

/** Tổng quan điểm đã lưu: câu máy chấm hoặc Mentor đã cho điểm mới được tính là đã chấm. */
export const summarizeGradingQuestions = (questions: ScorableQuestion[] = []) => {
  const gradedQuestions = questions.filter((question) => question.teacherScore != null || question.autoScore != null || question.isCorrect != null);
  const correct = gradedQuestions.filter((question) => {
    if (question.teacherScore != null) {
      return (question.maxScore ?? 0) > 0 && question.teacherScore >= (question.maxScore ?? 0);
    }
    if (question.isCorrect != null) return question.isCorrect;
    return (question.maxScore ?? 0) > 0 && question.autoScore != null && question.autoScore >= (question.maxScore ?? 0);
  }).length;

  return {
    total: questions.length,
    graded: gradedQuestions.length,
    correct,
    score: computeAttemptScoreFromQuestions(gradedQuestions),
  };
};

/** Câu đã được gửi kết quả cho học viên. */
export const isQuestionReturnedToStudent = (
  question: { returnedAt?: string | null; teacherScore?: number | null; autoScore?: number | null },
  module?: { status?: string },
  allQuestions?: { returnedAt?: string | null }[],
): boolean => {
  if (question.returnedAt) return true;

  const questions = allQuestions || [];
  const hasPerAnswerTracking = questions.some((q) => q.returnedAt);
  // Chấm từng phần: chỉ khóa câu đã có returnedAt, không khóa cả bài.
  if (hasPerAnswerTracking) return false;

  const moduleReturned = module?.status === "returned" || module?.status === "RETURNED";
  // Legacy (trước returnedAt): chỉ khóa khi module thật sự RETURNED, có danh sách câu, VÀ câu này thực sự đã được chấm (có điểm). Bug thật ở HSK cũ:
  // câu dài bị tách thành 2 câu nhỏ SAU KHI module đã gửi kết quả — câu mới tách chưa từng được chấm nhưng vẫn bị khoá read-only khiến Mentor
  // không còn nút "Chỉnh sửa" để nhận xét.
  const questionWasGraded = question.teacherScore != null || question.autoScore != null;
  return moduleReturned && questions.length > 0 && questionWasGraded;
};

/** Tất cả câu trong bài đã được gửi kết quả. */
export const areAllQuestionsReturned = (questions: { returnedAt?: string | null }[] = []): boolean => {
  if (!questions.length) return false;
  return questions.every((q) => !!q.returnedAt);
};

/** Câu đã chấm và chưa gửi — có thể gửi kết quả lần này. */
export const isQuestionReadyToSend = (
  question: { returnedAt?: string | null; teacherScore?: number | null; isCorrect?: boolean | null; autoScore?: number | null; answerId?: string },
  draft?: { score: string },
): boolean => {
  if (question.returnedAt) return false;
  if (question.teacherScore != null) return true;
  if (draft && draft.score !== "") return true;
  return question.isCorrect != null && question.autoScore != null;
};
