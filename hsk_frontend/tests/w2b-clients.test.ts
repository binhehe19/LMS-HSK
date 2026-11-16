import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { createQuestion, deleteQuestion, getQuiz, listQuestions, updateQuestion } from "@/lib/api/quiz-question-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import type { QuizQuestionBody } from "@/types/content-quiz";

const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
const lastCall = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, method: init.method, body: init.body ? JSON.parse(init.body as string) : undefined, credentials: init.credentials };
};
const question: QuizQuestionBody = { type: "TRUE_FALSE", prompt: "再见 = tạm biệt", points: 5, correctAnswer: true, index: 2 };

afterEach(() => vi.unstubAllGlobals());

describe("quiz-question-client — /quiz/questions theo hợp đồng đề xuất", () => {
  it("chưa cấu hình NEXT_PUBLIC_HSK_API_BASE_PATH => ApiNotConfiguredError, không gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(listQuestions("q1")).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(getQuiz("q1")).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("đọc: GET /quiz/quizzes/{id} và GET /quiz/questions/{quizId}, cookie, mã hoá id", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    const fetchMock = respond(200, { success: true, data: [] });
    vi.stubGlobal("fetch", fetchMock);
    await getQuiz("qz item 1");
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/quiz/quizzes/qz%20item%201", method: "GET", credentials: "include" });
    await listQuestions("q/1");
    expect(lastCall(fetchMock).url).toBe("/api/hsk/quiz/questions/q%2F1");
  });

  it("ghi khi công tắc ĐÓNG => WriteDisabledError, không request; MỞ => POST /questions/{quizId}, PUT/DELETE /questions/{id} với body", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "disabled");
    const blocked = vi.fn();
    vi.stubGlobal("fetch", blocked);
    expect(() => createQuestion("q1", question, false)).toThrow(WriteDisabledError);
    expect(() => deleteQuestion("x", false)).toThrow(WriteDisabledError);
    expect(blocked).not.toHaveBeenCalled();

    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
    const fetchMock = respond(200, { success: true, data: { id: "x" } });
    vi.stubGlobal("fetch", fetchMock);
    await createQuestion("q1", question, false);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/quiz/questions/q1", method: "POST", body: { type: "TRUE_FALSE", prompt: "再见 = tạm biệt", points: 5, correctAnswer: true, index: 2 } });
    await updateQuestion("qq 1", question, false);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/quiz/questions/qq%201", method: "PUT" });
    await deleteQuestion("qq1", true);
    expect(lastCall(fetchMock)).toMatchObject({ url: "/api/hsk/quiz/questions/qq1", method: "DELETE" });
  });
});
