"use client";

// Client "nối thử" kho nội dung Bài tập (Quiz) HSK vào repo-lms thật (LearningResource + ContentPackage có sẵn), thay cho content-tree-client.ts/
// quiz-question-client.ts (mock). Cùng mẫu với lms-content-client.ts (Flashcard) / lms-grammar-client.ts (Grammar) ở cấp GÓI/MỤC, nhưng khác ở
// chỗ: QuizContent gộp CẢ danh sách câu hỏi vào JSON của chính nó (không có endpoint riêng cho từng câu hỏi như HSK cũ) — Thêm/Sửa/Xoá 1 câu hỏi
// luôn đọc lại toàn bộ content rồi PUT lại cả mảng `questions` (đã xác nhận với người phụ trách).
//
// Mapping (đã chốt với người phụ trách):
//  - QuizItem HSK gộp vào LearningResourceType.ASSESSMENT/ContentPackageType.ASSESSMENT có sẵn, dùng QuizContent: title/description giữ tên,
//    durationMinutes*60→timeLimitSeconds, shuffleQuestions giữ tên. Field KHÔNG có cột riêng ở QuizContent (instruction, skill, difficulty,
//    passingScore, audioFileId, passageText, passageImageFileId) → nhét vào `layout.meta` (JSON tự do, backend "chỉ lưu và trả lại", không đụng tới).
//  - Câu hỏi: type đổi tên để khớp ExerciseQuestionType (SHORT_ANSWER→ESSAY, còn lại giữ tên); TRUE_FALSE không có field boolean riêng ở backend
//    (dùng chung options[] như MULTIPLE_CHOICE) → tự đổi correctAnswer (boolean) thành 2 options cố định "Đúng"/"Sai" khi gửi lên, đọc lại theo
//    option nào correct=true. Field câu hỏi KHÔNG có chỗ lưu (imageFileId, difficulty, fillBlankMode, choices, gradingMode, referenceAnswer) →
//    TẠM BỎ QUA, không gửi lên, không đọc lại, cho tới khi có quyết định thêm field thật ở backend. questionId do frontend tự sinh
//    (crypto.randomUUID) khi tạo câu hỏi mới, giữ cố định qua các lần sửa (đúng tinh thần "ULID ổn định" của backend).
//  - Package→Folder→StudySet→QuizItem→Câu hỏi rút gọn còn Package→resource (QuizItem) — câu hỏi nằm trong content của resource, không phải một
//    cấp URL riêng. sessionNo cố định = 1. syllabusId/syllabusVersionId dùng cặp đại diện cố định riêng cho quiz.
import { lmsClient } from "@/lib/api/lms-client";
import { ApiError } from "@/lib/api/api-client";
import { fileUrl } from "@/lib/api/storage-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { ContentItemInput, ContentPackage, ContentPackageInput } from "@/types/content";
import type { PageResponse } from "@/types/lms";
import type { QuizDifficulty, QuizItem, QuizQuestion, QuizQuestionType } from "@/types/content-quiz";

const PACKAGE_TYPE = "ASSESSMENT";
const HSK_SYLLABUS_ID = "HSK-LIBRARY-QUIZ";
const HSK_SYLLABUS_VERSION_ID = "HSK-LIBRARY-QUIZ-V1";

// ---- shape thật của repo-lms (chỉ các trường dùng tới) ----
interface BackendPackageVersion {
  id: string;
  title: string | null;
  description: string | null;
}
interface BackendPackage {
  id: string;
  type: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  draftVersion: BackendPackageVersion | null;
  publishedVersion: BackendPackageVersion | null;
  createdAt?: string;
  updatedAt?: string;
}
type BackendQuestionType = "MULTIPLE_CHOICE" | "MULTIPLE_SELECT" | "TRUE_FALSE" | "CHOOSE_FROM_LIST" | "MATCHING_PAIRS" | "FILL_IN_BLANK" | "SENTENCE_BUILDER" | "AUDIO_RESPONSE" | "ESSAY" | "FILE_UPLOAD";
interface BackendOptionItem {
  optionIndex?: number;
  content?: string;
  correct?: boolean;
}
interface BackendMatchingPairItem {
  pairIndex?: number;
  prompt?: string;
  answer?: string;
}
interface BackendBlankItem {
  blankIndex?: number;
  correctAnswer?: string;
  acceptedAnswers?: string[];
  hint?: string;
}
interface BackendQuizQuestion {
  questionId?: string;
  questionType?: BackendQuestionType;
  questionText?: string;
  audioUrl?: string;
  explanation?: string;
  points?: number;
  options?: BackendOptionItem[];
  matchingPairs?: BackendMatchingPairItem[];
  blanks?: BackendBlankItem[];
}
interface QuizLayoutMeta {
  instruction?: string;
  skill?: string;
  difficulty?: QuizDifficulty;
  passingScore?: number;
  audioFileId?: string;
  passageText?: string;
  passageImageFileId?: string;
}
interface QuizLayout {
  meta?: QuizLayoutMeta;
}
interface QuizContent {
  title: string;
  description?: string;
  timeLimitSeconds?: number;
  shuffleQuestions?: boolean;
  layout?: QuizLayout;
  questions?: BackendQuizQuestion[];
}
interface BackendLearningResource {
  id: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  content: QuizContent | null;
}
interface BackendPackageVersionResource {
  id: string;
  learningResourceId: string;
  learningResourceVersionId: string;
  displayOrder: number;
  resourceContent: QuizContent | null;
}
interface EditLockResponse {
  acquired: boolean;
  holderUserId?: string | null;
}

// ---- dịch kiểu câu hỏi FE <-> BE ----
const QUESTION_TYPE_TO_BACKEND: Record<QuizQuestionType, BackendQuestionType> = {
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  TRUE_FALSE: "TRUE_FALSE",
  FILL_IN_BLANK: "FILL_IN_BLANK",
  MATCHING_PAIRS: "MATCHING_PAIRS",
  SHORT_ANSWER: "ESSAY",
  AUDIO_RESPONSE: "AUDIO_RESPONSE",
  SENTENCE_BUILDER: "SENTENCE_BUILDER",
};
const QUESTION_TYPE_FROM_BACKEND: Partial<Record<BackendQuestionType, QuizQuestionType>> = {
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  TRUE_FALSE: "TRUE_FALSE",
  FILL_IN_BLANK: "FILL_IN_BLANK",
  MATCHING_PAIRS: "MATCHING_PAIRS",
  ESSAY: "SHORT_ANSWER",
  AUDIO_RESPONSE: "AUDIO_RESPONSE",
  SENTENCE_BUILDER: "SENTENCE_BUILDER",
};

function fileIdFromUrl(url: string | undefined | null): string | undefined {
  const match = url?.match(/\/file\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function toBackendQuestion(q: QuizQuestion): BackendQuizQuestion {
  const base: BackendQuizQuestion = {
    questionId: q.id,
    questionType: QUESTION_TYPE_TO_BACKEND[q.type] ?? "MULTIPLE_CHOICE",
    questionText: q.prompt,
    points: q.points,
    explanation: q.explanation || undefined,
    audioUrl: fileUrl(q.audioFileId) ?? undefined,
  };
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
    case "FILL_IN_BLANK":
      base.blanks = (q.blanks ?? []).map((b) => ({ blankIndex: b.index, correctAnswer: b.answer, acceptedAnswers: b.acceptable }));
      break;
    case "MATCHING_PAIRS":
      base.matchingPairs = (q.pairs ?? []).map((p, i) => ({ pairIndex: i, prompt: p.left, answer: p.right }));
      break;
    default:
      break;
  }
  return base;
}

function fromBackendQuestion(quizId: string, index: number, bq: BackendQuizQuestion): QuizQuestion {
  const type = QUESTION_TYPE_FROM_BACKEND[bq.questionType ?? "MULTIPLE_CHOICE"] ?? "MULTIPLE_CHOICE";
  const base: QuizQuestion = {
    id: bq.questionId ?? crypto.randomUUID(),
    quizId,
    index,
    type,
    prompt: bq.questionText ?? "",
    points: bq.points ?? 10,
    explanation: bq.explanation || undefined,
    audioFileId: fileIdFromUrl(bq.audioUrl),
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
    default:
      break;
  }
  return base;
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

function toQuizContent(meta: QuizMetaFields, questions: BackendQuizQuestion[]): QuizContent {
  const meta2: QuizLayoutMeta = {
    instruction: meta.instruction || undefined,
    skill: meta.skill || undefined,
    difficulty: meta.difficulty,
    passingScore: meta.passingScore,
    audioFileId: meta.audioFileId ? fileUrl(meta.audioFileId) ?? undefined : undefined,
    passageText: meta.passageText || undefined,
    passageImageFileId: meta.passageImageFileId ? fileUrl(meta.passageImageFileId) ?? undefined : undefined,
  };
  return {
    title: meta.title,
    description: meta.description || undefined,
    timeLimitSeconds: meta.durationMinutes && meta.durationMinutes > 0 ? meta.durationMinutes * 60 : undefined,
    shuffleQuestions: meta.shuffleQuestions ?? false,
    layout: { meta: meta2 },
    questions,
  };
}

function fromQuizContent(id: string, index: number, content: QuizContent | null): QuizItem {
  const meta = content?.layout?.meta;
  return {
    id,
    studySetId: "",
    index,
    title: content?.title ?? "",
    description: content?.description || undefined,
    instruction: meta?.instruction,
    skill: meta?.skill,
    difficulty: meta?.difficulty,
    durationMinutes: content?.timeLimitSeconds ? Math.round(content.timeLimitSeconds / 60) : undefined,
    passingScore: meta?.passingScore,
    shuffleQuestions: content?.shuffleQuestions ?? false,
    audioFileId: fileIdFromUrl(meta?.audioFileId),
    passageText: meta?.passageText,
    passageImageFileId: fileIdFromUrl(meta?.passageImageFileId),
    questionCount: content?.questions?.length ?? 0,
  };
}

function toUiPackage(pkg: BackendPackage): ContentPackage {
  const version = pkg.draftVersion ?? pkg.publishedVersion;
  return {
    id: pkg.id,
    name: version?.title ?? "",
    description: version?.description ?? undefined,
    type: PACKAGE_TYPE,
    publishStatus: pkg.publishedVersionId ? "PUBLISHED" : "DRAFT",
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
}

// ---- gói ----
export async function listQuizPackages(): Promise<ContentPackage[]> {
  const res = await lmsClient.get<PageResponse<BackendPackage>>(`/content-packages?type=${PACKAGE_TYPE}&syllabusId=${encodeURIComponent(HSK_SYLLABUS_ID)}&size=200`);
  return (res.items ?? []).map(toUiPackage);
}

export async function createQuizPackage(input: ContentPackageInput, demo: boolean): Promise<ContentPackage> {
  assertWriteEnabled("content", demo);
  const pkg = await lmsClient.post<BackendPackage>("/content-packages", {
    type: PACKAGE_TYPE,
    syllabusId: HSK_SYLLABUS_ID,
    syllabusVersionId: HSK_SYLLABUS_VERSION_ID,
    title: input.name,
    description: input.description || undefined,
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

export async function listPackageQuizItems(packageId: string): Promise<QuizItem[]> {
  const { links } = await resolveVersionAndLinks(packageId);
  return links
    .map((link) => fromQuizContent(link.learningResourceId, link.displayOrder, link.resourceContent))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export async function createQuizItem(packageId: string, input: ContentItemInput<QuizItem>, demo: boolean): Promise<QuizItem> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  const resource = await lmsClient.post<BackendLearningResource>("/learning-resources", {
    type: PACKAGE_TYPE,
    content: toQuizContent(input, []),
    publishImmediately: true,
    inLibrary: false,
  });
  const resourceVersionId = resource.publishedVersionId ?? resource.draftVersionId;
  await lmsClient.post(`/content-packages/versions/${encodeURIComponent(versionId)}/resources`, {
    learningResourceId: resource.id,
    learningResourceVersionId: resourceVersionId,
    sessionNo: 1,
    displayOrder: input.index ?? 0,
  });
  return fromQuizContent(resource.id, input.index ?? 0, resource.content);
}

export async function updateQuizItem(packageId: string, resourceId: string, input: ContentItemInput<QuizItem>, demo: boolean): Promise<QuizItem> {
  assertWriteEnabled("content", demo);
  const { versionId, links } = await resolveVersionAndLinksEnsuringDraft(packageId);
  const existing = links.find((l) => l.learningResourceId === resourceId)?.resourceContent ?? null;
  const content = toQuizContent(input, existing?.questions ?? []);
  await lmsClient.put(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}/content`, { content });
  return fromQuizContent(resourceId, input.index ?? 0, content);
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
    item: fromQuizContent(resourceId, link.displayOrder, content),
    questions: (content?.questions ?? []).map((q, i) => fromBackendQuestion(resourceId, i, q)).sort((a, b) => a.index - b.index),
  };
}

export async function saveQuizQuestions(packageId: string, resourceId: string, item: QuizItem, questions: QuizQuestion[], demo: boolean): Promise<QuizQuestion[]> {
  assertWriteEnabled("content", demo);
  const versionId = await ensureDraftVersionId(packageId);
  const content = toQuizContent(item, questions.map(toBackendQuestion));
  await lmsClient.put(`/content-packages/versions/${encodeURIComponent(versionId)}/resources/${encodeURIComponent(resourceId)}/content`, { content });
  return questions.map((q, i) => ({ ...q, index: i }));
}
