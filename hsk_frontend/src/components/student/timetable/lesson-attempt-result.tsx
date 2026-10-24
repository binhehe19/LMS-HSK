"use client";
import { AnswerLines } from "@/components/shared/answer-lines";
import { fileUrl } from "@/lib/api/storage-client";
import { answerAudio, answerFiles } from "@/lib/assessment/answer-codec";
import { answerLines } from "@/lib/assessment/answer-parts";
import { formatCorrectAnswer, formatPoints, scoreStateOf } from "@/lib/assessment/result-format";
import { plainText } from "./timetable-source";
import { useAssessmentAttemptResult } from "./use-assessment-attempt-result";

/** Đề trong kết quả: bỏ thẻ HTML (không render HTML) và đổi `{{n}}` thành chỗ trống. */
const questionLine = (html: string) => plainText(html).replace(/\{\{\d+\}\}/g, "____");

/**
 * Kết quả sau khi nộp, cập nhật dần theo tiến độ chấm: câu tự động có điểm trước, câu tự luận/ghi âm chờ giáo viên.
 * Điểm do máy chủ quyết định (`/result`); màn này không tự tính điểm.
 */
export function LessonAttemptResult({ attemptId, onRetake }: { attemptId: string; onRetake?: () => void }) {
  const { result, loading, error } = useAssessmentAttemptResult(attemptId);

  if (loading && !result) return <div className="hsk-lesson-empty"><h3>Đang lấy kết quả…</h3></div>;
  if (!result) {
    return (
      <div className="hsk-lesson-empty" role="alert">
        <h3>Không tải được kết quả</h3>
        <p>{error ?? "Kết quả bài làm chưa sẵn sàng."}</p>
      </div>
    );
  }

  const done = result.gradingStatus === "GRADED";
  const waitingTeacher = result.gradingStatus === "MANUAL_GRADING";
  const { gradedQuestions, totalQuestions } = result.progress;
  return (
    <div className="hsk-attempt-result">
      <header>
        <h3>{done ? "Kết quả bài làm" : waitingTeacher ? "Một số câu đang chờ giáo viên chấm" : "Đang chấm điểm bài làm…"}</h3>
        {(done || gradedQuestions > 0) && (
          <p className="hsk-attempt-score">
            {formatPoints(result.earnedPoints)}/{formatPoints(result.totalPoints)} điểm{done && result.percent != null ? ` (${formatPoints(result.percent)}%)` : ""}
          </p>
        )}
        {!done && gradedQuestions > 0 && <p>Điểm của các câu đã chấm, chưa gồm các câu còn lại.</p>}
        {!done && <p>{gradedQuestions}/{totalQuestions} câu đã chấm</p>}
        {onRetake && (
          <button type="button" onClick={onRetake}>
            Làm lại bài
          </button>
        )}
      </header>
      <ol>
        {result.questions.map((item) => {
          const q = item.question;
          const state = scoreStateOf(item.gradingStatus, item.earnedPoints != null);
          const mine = q ? answerLines(q, item.answerJson, item.parts) : [];
          const correct = q && state === "scored" ? formatCorrectAnswer(q) : [];
          return (
            <li key={item.questionId}>
              <p>
                <strong>{questionLine(q?.questionText ?? "")}</strong>
                <span>
                  {state === "scored" && ` ${formatPoints(item.earnedPoints)}/${formatPoints(item.maxPoints)} điểm`}
                  {state === "grading" && " Đang chấm điểm"}
                  {state === "waitingTeacher" && " Chờ giáo viên chấm"}
                </span>
              </p>
              <div>
                Bạn đã trả lời: {mine.length ? <AnswerLines lines={mine} /> : <em>Chưa trả lời</em>}
              </div>
              {q?.questionType === "AUDIO_RESPONSE" && fileUrl(answerAudio(item.answerJson ?? undefined)?.fileId) && <audio controls preload="none" src={fileUrl(answerAudio(item.answerJson ?? undefined)?.fileId) ?? undefined} />}
              {q?.questionType === "FILE_UPLOAD" &&
                answerFiles(item.answerJson ?? undefined).map((file) => (
                  <p key={file.fileId}>
                    <a href={fileUrl(file.fileId, "attachment") ?? undefined} target="_blank" rel="noreferrer">
                      {file.fileName || file.fileId}
                    </a>
                  </p>
                ))}
              {correct.length > 0 && <p>Đáp án đúng: {correct.join("; ")}</p>}
              {state === "scored" && q?.explanation && <p>{plainText(q.explanation)}</p>}
              {state === "scored" && item.graderComment && <p>Nhận xét: {item.graderComment}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
