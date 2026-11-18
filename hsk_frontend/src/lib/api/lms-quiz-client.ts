"use client";

// Client "nối thử" kho nội dung Bài tập (Quiz) HSK vào repo-lms thật (LearningResource + ContentPackage có sẵn), thay cho content-tree-client.ts/
// quiz-question-client.ts (mock). Cùng mẫu với lms-content-client.ts (Flashcard) / lms-grammar-client.ts (Grammar) ở cấp GÓI/MỤC, nhưng khác ở
// chỗ: QuizContent gộp CẢ danh sách câu hỏi vào JSON của chính nó (không có endpoint riêng cho từng câu hỏi như HSK cũ) — Thêm/Sửa/Xoá 1 câu hỏi
// luôn đọc lại toàn bộ content rồi PUT lại cả mảng `questions` (đã xác nhận với người phụ trách).
//
// Mapping (đã chốt với người phụ trách):
//  - QuizItem HSK gộp vào LearningResourceType.ASSESSMENT/ContentPackageType.ASSESSMENT có sẵn, dùng QuizContent: title/description giữ tên,
//    durationMinutes*60→timeLimits.default, shuffleQuestions giữ tên; layout v2 (một phần chứa mọi câu). Field KHÔNG có cột riêng ở QuizContent (instruction, skill, difficulty,
//    passingScore, audioFileId, passageText, passageImageFileId) → nhét vào `layout.meta` (JSON tự do, backend "chỉ lưu và trả lại", không đụng tới).
//  - Câu hỏi: type đổi tên để khớp ExerciseQuestionType (SHORT_ANSWER→ESSAY, MATCHING_PAIRS→MATCHING, còn lại giữ tên); TRUE_FALSE là trắc
//    nghiệm có variant "TRUE_FALSE" với 2 options cố định "Đúng"/"Sai" (đọc lại theo option nào correct=true); nối cặp có danh sách lựa chọn
//    chung (các vế phải); câu mẫu điền chỗ trống đổi {blank}/___ thành {{n}} khi gửi và ngược lại khi đọc; audio là media[] với đường dẫn storage. Field câu hỏi KHÔNG có chỗ lưu (imageFileId, difficulty, fillBlankMode, choices, gradingMode, referenceAnswer) →
//    TẠM BỎ QUA, không gửi lên, không đọc lại, cho tới khi có quyết định thêm field thật ở backend. questionId do frontend tự sinh
//    (crypto.randomUUID) khi tạo câu hỏi mới, giữ cố định qua các lần sửa (đúng tinh thần "ULID ổn định" của backend).
//  - Package→Folder→StudySet→QuizItem→Câu hỏi rút gọn còn Package→resource (QuizItem) — câu hỏi nằm trong content của resource, không phải một
//    cấp URL riêng. sessionNo cố định = 1. Gói của Kho là học phần tự do (không có syllabusId).
import { lmsClient } from "@/lib/api/lms-client";
import { listManagedPackages, syllabusBinding, type ManagedPackage } from "@/lib/api/package-management-client";
import { ApiError } from "@/lib/api/api-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { ContentItemInput, ContentPackage, ContentPackageInput } from "@/types/content";
import type { QuizDifficulty, QuizItem, QuizQuestion, QuizQuestionType } from "@/types/content-quiz";

const PACKAGE_TYPE = "ASSESSMENT";

// ---- shape thật của repo-lms (chỉ các trường dùng tới) ----
interface BackendPackageVersion {
  sessionCount?: number;
  id: string;
  title: string | null;
  description?: string | null;
}
interface BackendPackage {
  id: string;
  type: string;
  syllabusId?: string | null;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  draftVersion: BackendPackageVersion | null;
  publishedVersion: BackendPackageVersion | null;
  createdAt?: string;
  updatedAt?: string;
}
// 8 loại câu của backend (ExerciseQuestionType). Nối nhiều dòng là MATCHING (danh sách lựa chọn chung + matchingPairs); điền chỗ trống dùng {{n}} trong questionText.
type BackendQuestionType = "MULTIPLE_CHOICE" | "MULTIPLE_SELECT" | "MATCHING" | "FILL_IN_BLANK" | "SENTENCE_BUILDER" | "AUDIO_RESPONSE" | "ESSAY" | "FILE_UPLOAD";
// Các kiểu dưới đây chỉ khai báo field HSK đọc/ghi; `[key: string]: unknown` giữ chỗ cho mọi field khác của backend (gợi ý, rubric AI, tệp...)
// để khi lưu lại chúng đi nguyên vẹn, không bị bỏ rơi.
interface BackendOptionItem {
  optionIndex?: number;
  content?: string;
  correct?: boolean;
  [key: string]: unknown;
}
interface BackendMatchingPairItem {
  pairIndex?: number;
  prompt?: string;
  answer?: string;
  [key: string]: unknown;
}
interface BackendBlankItem {
  blankIndex?: number;
  correctAnswer?: string;
  acceptedAnswers?: string[];
  hint?: string;
  [key: string]: unknown;
}
interface BackendMedia {
  kind: string;
  url: string;
  [key: string]: unknown;
}
interface BackendQuizQuestion {
  questionId?: string;
  questionType?: BackendQuestionType;
  /** Gợi ý hiển thị, không ảnh hưởng chấm điểm. HSK dùng "TRUE_FALSE" cho câu Đúng/Sai (trắc nghiệm hai lựa chọn Đúng/Sai). */
  variant?: string;
  questionText?: string;
  /** Audio/video của câu: chỉ nhận đường dẫn storage /api/storage/file/<mã>. */
  media?: BackendMedia[];
  explanation?: string;
  referenceText?: string;
  points?: number;
  options?: BackendOptionItem[];
  matchingPairs?: BackendMatchingPairItem[];
  blanks?: BackendBlankItem[];
  [key: string]: unknown;
}
interface QuizLayoutMeta {
  instruction?: string;
  skill?: string;
  difficulty?: QuizDifficulty;
  passingScore?: number;
  audioFileId?: string;
  passageText?: string;
  passageImageFileId?: string;
  [key: string]: unknown;
}
interface BackendFile {
  url: string;
  name?: string;
  mimeType?: string;
  [key: string]: unknown;
}
interface QuizLayoutSection {
  id: string;
  title?: string;
  /** Văn bản chung của phần (bài đọc...). */
  content?: string;
  files?: BackendFile[];
  media?: BackendMedia[];
  questionIds: string[];
  [key: string]: unknown;
}
interface QuizLayout {
  version?: number;
  meta?: QuizLayoutMeta;
  /** Layout v2: mỗi câu hỏi nằm đúng một phần; backend kiểm tra questionIds khớp questions[]. */
  sections?: QuizLayoutSection[];
  [key: string]: unknown;
}
interface QuizContent {
  title: string;
  description?: string;
  /** Thời gian làm bài (giây) theo chế độ; HSK chỉ dùng default. Không còn timeLimitSeconds. */
  timeLimits?: { default?: number | null };
  shuffleQuestions?: boolean;
  layout?: QuizLayout;
  questions?: BackendQuizQuestion[];
}
interface BackendLearningResource {
  id: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  content: QuizContent | null;
  skill?: string | null;
}
interface BackendPackageVersionResource {
  sessionNo: number;
  id: string;
  learningResourceId: string;
  learningResourceVersionId: string;
  displayOrder: number;
  resourceContent: QuizContent | null;
  /** Kỹ năng của học liệu (cột skill); null với đề cũ chưa chuyển, khi đó đọc dự phòng layout.meta.skill. */
  skill?: string | null;
}
interface EditLockResponse {
  acquired: boolean;
  holderUserId?: string | null;
}

// ---- dịch kiểu câu hỏi FE <-> BE ----
// Câu Đúng/Sai và nối cặp của HSK không còn loại riêng ở backend: Đúng/Sai = trắc nghiệm hai lựa chọn có variant "TRUE_FALSE",
// nối cặp = MATCHING. Hai tên này chỉ còn là kiểu giao diện của HSK.
const TRUE_FALSE_VARIANT = "TRUE_FALSE";
const QUESTION_TYPE_TO_BACKEND: Record<Exclude<QuizQuestionType, "TRUE_FALSE">, BackendQuestionType> = {
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  FILL_IN_BLANK: "FILL_IN_BLANK",
  MATCHING_PAIRS: "MATCHING",
  SHORT_ANSWER: "ESSAY",
  AUDIO_RESPONSE: "AUDIO_RESPONSE",
  SENTENCE_BUILDER: "SENTENCE_BUILDER",
  MULTIPLE_SELECT: "MULTIPLE_SELECT",
  FILE_UPLOAD: "FILE_UPLOAD",
};
const QUESTION_TYPE_FROM_BACKEND: Record<BackendQuestionType, QuizQuestionType> = {
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  MULTIPLE_SELECT: "MULTIPLE_SELECT",
  FILL_IN_BLANK: "FILL_IN_BLANK",
  MATCHING: "MATCHING_PAIRS",
  ESSAY: "SHORT_ANSWER",
  AUDIO_RESPONSE: "AUDIO_RESPONSE",
  SENTENCE_BUILDER: "SENTENCE_BUILDER",
  FILE_UPLOAD: "FILE_UPLOAD",
};

function fileIdFromUrl(url: string | undefined | null): string | undefined {
  const match = url?.match(/\/file\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Đường dẫn storage chuẩn mà backend chấp nhận cho tệp/audio của câu (không phải URL đầy đủ của storage service). */
const storagePath = (fileId: string) => `/api/storage/file/${encodeURIComponent(fileId)}`;

/**
 * Câu mẫu HSK ({blank} hoặc ___) → questionText của backend với {{1}}, {{2}}… theo thứ tự. Số chỗ trống phải khớp blanks[]: thiếu thì
 * nối thêm {{n}} ở cuối, thừa thì bỏ chữ giữ chỗ.
 */
function templateToBackend(template: string, blankCount: number): string {
  let n = 0;
  let text = template.replace(/___+|\{blank\d*\}/g, () => (++n <= blankCount ? `{{${n}}}` : ""));
  for (let i = n + 1; i <= blankCount; i += 1) text += ` {{${i}}}`;
  return text;
}
const templateFromBackend = (text: string) => text.replace(/\{\{\d+\}\}/g, "{blank}");

/** Thay (hoặc bỏ, khi `next` rỗng) đúng phần tử đầu tiên thoả `isMine`; chưa có thì thêm lên đầu. Các phần tử khác giữ nguyên. */
function replaceFirst<T>(list: T[] | undefined, isMine: (item: T) => boolean, next: T | undefined): T[] | undefined {
  const out = [...(list ?? [])];
  const at = out.findIndex(isMine);
  if (at >= 0) {
    if (next) out[at] = next;
    else out.splice(at, 1);
  } else if (next) out.unshift(next);
  return out.length ? out : undefined;
}

const isAudio = (m: BackendMedia) => m.kind === "audio";
const isImageFile = (f: BackendFile) => /^image\//i.test(f.mimeType ?? "") || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(f.name ?? "");

/** Audio của câu/phần: thay mục audio đầu tiên theo `audioFileId`, giữ video và audio khác; audio không đổi thì giữ cả transcript. */
function withAudio(media: BackendMedia[] | undefined, audioFileId: string | undefined): BackendMedia[] | undefined {
  const previous = media?.find(isAudio);
  const url = audioFileId ? storagePath(audioFileId) : undefined;
  return replaceFirst(media, (m) => m === previous, url ? (previous?.url === url ? previous : { kind: "audio", url }) : undefined);
}

/** Ảnh bài đọc của phần: thay tệp ảnh đầu tiên, giữ các tệp khác. `image/*` để màn IELTS nhận ra là ảnh. */
function withImage(files: BackendFile[] | undefined, imageFileId: string | undefined): BackendFile[] | undefined {
  const previous = files?.find(isImageFile);
  const url = imageFileId ? storagePath(imageFileId) : undefined;
  return replaceFirst(files, (f) => f === previous, url ? (previous?.url === url ? previous : { url, name: "passage-image", mimeType: "image/*" }) : undefined);
}

/** Dòng cũ tương ứng với dòng đang lưu: trùng nội dung thì lấy dòng đó, nếu không thì theo vị trí khi số dòng không đổi (để giữ giải thích/gợi ý từng dòng). */
function carry<T>(old: T[] | undefined, index: number, count: number, same: (o: T) => boolean): T | undefined {
  return old?.find(same) ?? (old?.length === count ? old[index] : undefined);
}

/**
 * Dựng câu gửi lên backend. Bắt đầu từ câu gốc (`q.source`) rồi chỉ ghi đè các field HSK có ô sửa, nên gợi ý, rubric AI, tệp, giải thích từng
 * dòng... được soạn ở nơi khác vẫn còn nguyên. Đổi loại câu thì bỏ câu gốc (field của loại cũ không còn nghĩa).
 */
export function toBackendQuestion(q: QuizQuestion): BackendQuizQuestion {
  const source = q.source as BackendQuizQuestion | undefined;
  // Chọn nhiều / nộp tệp chưa soạn được trong HSK: giữ nguyên câu gốc.
  if (q.type === "MULTIPLE_SELECT" || q.type === "FILE_UPLOAD") return { ...source, questionId: q.id };
  const questionType = q.type === "TRUE_FALSE" ? "MULTIPLE_CHOICE" : QUESTION_TYPE_TO_BACKEND[q.type];
  const kept = source?.questionType === questionType ? source : undefined;
  const base: BackendQuizQuestion = {
    ...kept,
    questionId: q.id,
    questionType,
    questionText: q.prompt,
    points: q.points,
    explanation: q.explanation || undefined,
    media: withAudio(kept?.media, q.audioFileId),
  };
  // Câu Đúng/Sai và trắc nghiệm cùng là MULTIPLE_CHOICE: chỉ đặt/bỏ dấu Đúng/Sai, giữ các variant khác.
  if (q.type === "TRUE_FALSE") base.variant = TRUE_FALSE_VARIANT;
  else if (base.variant === TRUE_FALSE_VARIANT) base.variant = undefined;
  switch (q.type) {
    case "MULTIPLE_CHOICE":
      base.options = (q.options ?? []).map((o, i) => ({ optionIndex: i, content: o.text, correct: o.isCorrect }));
      break;
    case "TRUE_FALSE":
      base.options = [
        { optionIndex: 0, content: "Đúng", correct: q.correctAnswer === true },
        { optionIndex: 1, content: "Sai", correct: q.correctAnswer !== true },
      ];
      break;
    case "FILL_IN_BLANK": {
      const blanks = (q.blanks ?? []).map((b, i, all) => ({
        ...carry(kept?.blanks, i, all.length, (o) => o.correctAnswer === b.answer),
        blankIndex: i,
        correctAnswer: b.answer,
        acceptedAnswers: b.acceptable,
      }));
      base.questionText = templateToBackend(q.prompt, blanks.length);
      base.blanks = blanks;
      break;
    }
    case "MATCHING_PAIRS": {
      const pairs = q.pairs ?? [];
      // Danh sách lựa chọn chung là các vế phải (không trùng); mỗi dòng chọn một trong số đó.
      const choices = [...new Set(pairs.map((p) => p.right))];
      base.options = choices.map((content, optionIndex) => ({ optionIndex, content }));
      base.matchingPairs = pairs.map((p, i) => ({
        ...carry(kept?.matchingPairs, i, pairs.length, (o) => o.prompt === p.left && o.answer === p.right),
        pairIndex: i,
        prompt: p.left,
        answer: p.right,
      }));
      break;
    }
    case "SHORT_ANSWER":
      base.referenceText = q.referenceAnswer || undefined;
      break;
    default:
      break;
  }
  return base;
}

export function fromBackendQuestion(quizId: string, index: number, bq: BackendQuizQuestion): QuizQuestion {
  const isTrueFalse = bq.questionType === "MULTIPLE_CHOICE" && bq.variant === TRUE_FALSE_VARIANT;
  const type: QuizQuestionType = isTrueFalse ? "TRUE_FALSE" : QUESTION_TYPE_FROM_BACKEND[bq.questionType ?? "MULTIPLE_CHOICE"] ?? "MULTIPLE_CHOICE";
  const audio = bq.media?.find((m) => m.kind === "audio");
  const base: QuizQuestion = {
    source: bq,
    id: bq.questionId ?? crypto.randomUUID(),
    quizId,
    index,
    type,
    prompt: type === "FILL_IN_BLANK" ? templateFromBackend(bq.questionText ?? "") : bq.questionText ?? "",
    points: bq.points ?? 10,
    explanation: bq.explanation || undefined,
    audioFileId: fileIdFromUrl(audio?.url),
  };
  switch (type) {
    case "MULTIPLE_CHOICE":
      base.options = (bq.options ?? []).map((o) => ({ text: o.content ?? "", isCorrect: Boolean(o.correct) }));
      break;
    case "TRUE_FALSE":
      base.correctAnswer = (bq.options ?? []).find((o) => o.correct)?.optionIndex === 0;
      break;
    case "FILL_IN_BLANK":
      base.blanks = (bq.blanks ?? []).map((b, i) => ({ index: b.blankIndex ?? i, answer: b.correctAnswer ?? "", acceptable: b.acceptedAnswers }));
      break;
    case "MATCHING_PAIRS":
      base.pairs = (bq.matchingPairs ?? []).map((p) => ({ left: p.prompt ?? "", right: p.answer ?? "" }));
      break;
    case "SHORT_ANSWER":
      base.referenceAnswer = bq.referenceText || undefined;
      break;
    default:
      break;
  }
  return base;
}

/** Số "câu" theo quy tắc của backend (QuizContent.partCount): câu nối tính theo số dòng, câu điền theo số chỗ trống, còn lại là 1. */
export function partCount(questions: BackendQuizQuestion[] | undefined): number {
  return (questions ?? []).reduce((sum, q) => {
    const lines = q.questionType === "MATCHING" ? q.matchingPairs?.length : q.questionType === "FILL_IN_BLANK" ? q.blanks?.length : 1;
    return sum + Math.max(1, lines ?? 1);
  }, 0);
}

// ---- dịch metadata QuizItem <-> QuizContent (không đụng tới questions) ----
interface QuizMetaFields {
  title: string;
  description?: string;
  instruction?: string;
  skill?: string;
  difficulty?: QuizDifficulty;
  durationMinutes?: number;
  passingScore?: number;
  shuffleQuestions?: boolean;
  audioFileId?: string;
  passageText?: string;
  passageImageFileId?: string;
}

/**
 * Layout mới từ layout đang lưu: giữ các phần (tiêu đề, nội dung, tệp, media), bỏ id của câu đã xoá, thêm câu mới vào phần cuối, và chỉ ghi đè
 * các khoá `meta` mà HSK sở hữu. Chưa có layout thì dựng một phần chứa mọi câu.
 * `lead` là đoạn đọc, audio và ảnh cả bài của HSK: nằm ở phần ĐẦU TIÊN (`content`, `media`, `files`) đúng hợp đồng mới; các tệp/audio khác của phần giữ nguyên.
 */
export function mergeLayout(
  existing: QuizLayout | undefined,
  questionIds: string[],
  metaFields: QuizLayoutMeta,
  title: string,
  lead?: { content?: string; audioFileId?: string; imageFileId?: string },
): QuizLayout {
  const alive = new Set(questionIds);
  const sections = (existing?.sections ?? []).map((s) => ({ ...s, questionIds: s.questionIds.filter((id) => alive.has(id)) }));
  if (sections.length === 0) sections.push({ id: "section-1", title, questionIds: [] });
  const placed = new Set(sections.flatMap((s) => s.questionIds));
  sections[sections.length - 1].questionIds.push(...questionIds.filter((id) => !placed.has(id)));
  if (lead) {
    const first = sections[0];
    first.content = lead.content || undefined;
    first.media = withAudio(first.media, lead.audioFileId);
    first.files = withImage(first.files, lead.imageFileId);
  }
  return { ...existing, version: 2, meta: { ...existing?.meta, ...metaFields }, sections };
}

function toQuizContent(meta: QuizMetaFields, questions: BackendQuizQuestion[], existingLayout?: QuizLayout): QuizContent {
  const meta2: QuizLayoutMeta = {
    instruction: meta.instruction || undefined,
    skill: meta.skill || undefined,
    difficulty: meta.difficulty,
    passingScore: meta.passingScore,
    // Đoạn đọc/audio/ảnh cả bài nay nằm ở phần đầu (mergeLayout); xoá khỏi meta để dữ liệu cũ được chuyển khi lưu.
    audioFileId: undefined,
    passageText: undefined,
    passageImageFileId: undefined,
  };
  return {
    title: meta.title,
    description: meta.description || undefined,
    timeLimits: meta.durationMinutes && meta.durationMinutes > 0 ? { default: meta.durationMinutes * 60 } : undefined,
    shuffleQuestions: meta.shuffleQuestions ?? false,
    layout: mergeLayout(existingLayout, questions.map((q) => q.questionId ?? ""), meta2, meta.title, {
      content: meta.passageText,
      audioFileId: meta.audioFileId,
      imageFileId: meta.passageImageFileId,
    }),
    questions,
  };
}

function fromQuizContent(id: string, index: number, content: QuizContent | null, skill?: string | null): QuizItem {
  const meta = content?.layout?.meta;
  const lead = content?.layout?.sections?.[0];
  return {
    id,
    studySetId: "",
    index,
    title: content?.title ?? "",
    description: content?.description || undefined,
    instruction: meta?.instruction,
    // Cột skill là nguồn chính; layout.meta.skill chỉ để đọc đề cũ chưa chuyển (và vẫn được ghi cho tới khi chuyển xong dữ liệu).
    skill: skill ?? meta?.skill,
    difficulty: meta?.difficulty,
    durationMinutes: content?.timeLimits?.default ? Math.round(content.timeLimits.default / 60) : undefined,
    passingScore: meta?.passingScore,
    shuffleQuestions: content?.shuffleQuestions ?? false,
    // Phần đầu là nơi lưu mới; meta chỉ còn để đọc dữ liệu HSK cũ.
    audioFileId: fileIdFromUrl(lead?.media?.find(isAudio)?.url) ?? fileIdFromUrl(meta?.audioFileId),
    passageText: lead?.content || meta?.passageText,
    passageImageFileId: fileIdFromUrl(lead?.files?.find(isImageFile)?.url) ?? fileIdFromUrl(meta?.passageImageFileId),
    questionCount: partCount(content?.questions),
  };
}

function toUiPackage(pkg: ManagedPackage): ContentPackage {
  const version = pkg.draftVersion ?? pkg.publishedVersion;
  return {
    id: pkg.id,
    sessionCount: version?.sessionCount ?? 1,
    syllabusId: pkg.syllabusId,
    name: version?.title ?? "",
    description: version?.description ?? undefined,
    type: PACKAGE_TYPE,
    publishStatus: pkg.publishedVersionId ? "PUBLISHED" : "DRAFT",
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
}

// ---- gói ----
/** Các gói của Kho: học phần tự do (chưa thuộc giáo trình nào). */
export async function listQuizPackages(): Promise<ContentPackage[]> {
  return (await listManagedPackages(PACKAGE_TYPE)).map(toUiPackage);
}

export async function createQuizPackage(input: ContentPackageInput, demo: boolean): Promise<ContentPackage> {
  assertWriteEnabled("content", demo);
  const pkg = await lmsClient.post<BackendPackage>("/content-packages", {
    type: PACKAGE_TYPE,
    title: input.name,
    ...await syllabusBinding(input.syllabusId),
    description: input.description || undefined,
    sessionCount: input.sessionCount,
  });
  return toUiPackage(pkg);
}

async function ensureDraftVersionId(packageId: string): Promise<string> {
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  if (pkg.draftVersionId) return pkg.draftVersionId;
  const draft = await lmsClient.post<BackendPackageVersion>(`/content-packages/${encodeURIComponent(packageId)}/draft`);
  return draft.id;
}

export async function updateQuizPackage(packageId: string, input: ContentPackageInput, demo: boolean): Promise<ContentPackage> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.put(`/content-packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}`, {
    title: input.name,
    description: input.description || undefined,
    sessionCount: input.sessionCount,
  });
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  return toUiPackage(pkg);
}

export async function deleteQuizPackage(packageId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  await lmsClient.delete(`/content-packages/${encodeURIComponent(packageId)}`);
}

export async function publishQuizPackage(packageId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  const sessionToken = crypto.randomUUID();
  const lock = await lmsClient.post<EditLockResponse>(`/content-packages/${encodeURIComponent(packageId)}/lock`, { sessionToken });
  if (!lock.acquired) throw new Error("Không khoá được phiên chỉnh sửa (có thể người khác đang sửa gói này).");
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.post(`/content-packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}/publish?sessionToken=${encodeURIComponent(sessionToken)}`);
}

export async function unpublishQuizPackage(packageId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  if (!pkg.publishedVersionId) return;
  await ensureDraftVersionId(packageId);
  await lmsClient.post(`/content-packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(pkg.publishedVersionId)}/archive`);
}

// ---- mục (bài tập), phẳng trong gói — sessionNo cố định = 1 ----
async function resolveVersionAndLinks(packageId: string): Promise<{ versionId: string | null; links: BackendPackageVersionResource[] }> {
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
  if (!versionId) return { versionId: null, links: [] };
  const links = await lmsClient.get<BackendPackageVersionResource[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`);
  return { versionId, links };
}

export async function listPackageQuizItems(packageId: string, sessionNo?: number): Promise<QuizItem[]> {
  const { links } = await resolveVersionAndLinks(packageId);
  return links
    .filter(link => sessionNo === undefined || link.sessionNo === sessionNo)
    .map((link) => fromQuizContent(link.learningResourceId, link.displayOrder, link.resourceContent, link.skill))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

/** Backend bắt buộc bài tập phải có ít nhất 1 câu hỏi ngay khi tạo (`"Quiz must have at least one question"`), nhưng màn tạo bài tập
 * (ô metadata: tiêu đề, kỹ năng, thời gian...) chưa có soạn câu hỏi — soạn câu hỏi là trình riêng (nút "Soạn câu hỏi", QUIZ_ID_PARAM).
 * Nên tạo kèm 1 câu hỏi placeholder hợp lệ để qua được kiểm tra của backend; admin sửa/thay nó ngay trong trình soạn câu hỏi sau khi tạo. */
function placeholderQuestion(): QuizQuestion {
  return {
    id: crypto.randomUUID(),
    quizId: "",
    index: 0,
    type: "MULTIPLE_CHOICE",
    prompt: 'Câu hỏi 1 (chưa soạn — vào "Soạn câu hỏi" để chỉnh sửa)',
    points: 10,
    options: [
      { text: "Đáp án A", isCorrect: true },
      { text: "Đáp án B", isCorrect: false },
    ],
  };
}

export async function createQuizItem(packageId: string, input: ContentItemInput<QuizItem>, demo: boolean, sessionNo = 1): Promise<QuizItem> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  const resource = await lmsClient.post<BackendLearningResource>("/learning-resources", {
    type: PACKAGE_TYPE,
    content: toQuizContent(input, [toBackendQuestion(placeholderQuestion())]),
    publishImmediately: true,
    inLibrary: false,
    skill: input.skill || undefined,
  });
  const resourceVersionId = resource.publishedVersionId ?? resource.draftVersionId;
  await lmsClient.post(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`, {
    learningResourceId: resource.id,
    learningResourceVersionId: resourceVersionId,
    sessionNo,
    displayOrder: input.index ?? 0,
  });
  return fromQuizContent(resource.id, input.index ?? 0, resource.content, resource.skill);
}

export async function updateQuizItem(packageId: string, resourceId: string, input: ContentItemInput<QuizItem>, demo: boolean): Promise<QuizItem> {
  assertWriteEnabled("content", demo);
  const { versionId, links } = await resolveVersionAndLinksEnsuringDraft(packageId);
  const existing = links.find((l) => l.learningResourceId === resourceId)?.resourceContent ?? null;
  const content = toQuizContent(input, existing?.questions ?? [], existing?.layout);
  await lmsClient.put(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}/content`, { content });
  // Chuỗi rỗng = xóa kỹ năng; subType/tags không gửi nên giữ nguyên.
  await lmsClient.put(`/learning-resources/${encodeURIComponent(resourceId)}/classification`, { skill: input.skill ?? "" });
  return fromQuizContent(resourceId, input.index ?? 0, content, input.skill ?? null);
}

export async function deleteQuizItem(packageId: string, resourceId: string, demo: boolean): Promise<void> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  await lmsClient.delete(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}`);
}

async function resolveVersionAndLinksEnsuringDraft(packageId: string): Promise<{ versionId: string; links: BackendPackageVersionResource[] }> {
  const versionId = await ensureDraftVersionId(packageId);
  const links = await lmsClient.get<BackendPackageVersionResource[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`);
  return { versionId, links };
}

// ---- câu hỏi, nằm trong content của resource (không có endpoint riêng) ----
export async function getQuizResource(packageId: string, resourceId: string): Promise<{ packageName: string; item: QuizItem; questions: QuizQuestion[] }> {
  const pkg = await lmsClient.get<BackendPackage>(`/content-packages/${encodeURIComponent(packageId)}`);
  const versionId = pkg.draftVersionId ?? pkg.publishedVersionId;
  const links = versionId ? await lmsClient.get<BackendPackageVersionResource[]>(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`) : [];
  const link = links.find((l) => l.learningResourceId === resourceId);
  if (!link) throw new ApiError("Không tìm thấy bài tập trong gói này.", 404, "NOT_FOUND");
  const content = link.resourceContent;
  const packageName = pkg.draftVersion?.title ?? pkg.publishedVersion?.title ?? "";
  return {
    packageName,
    item: fromQuizContent(resourceId, link.displayOrder, content, link.skill),
    questions: (content?.questions ?? []).map((q, i) => fromBackendQuestion(resourceId, i, q)).sort((a, b) => a.index - b.index),
  };
}

export async function saveQuizQuestions(packageId: string, resourceId: string, item: QuizItem, questions: QuizQuestion[], demo: boolean): Promise<QuizQuestion[]> {
  assertWriteEnabled("content", demo);
  const { versionId, links } = await resolveVersionAndLinksEnsuringDraft(packageId);
  const existing = links.find((l) => l.learningResourceId === resourceId)?.resourceContent ?? null;
  const content = toQuizContent(item, questions.map(toBackendQuestion), existing?.layout);
  await lmsClient.put(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}/content`, { content });
  return questions.map((q, i) => ({ ...q, index: i }));
}
