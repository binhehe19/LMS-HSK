"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { AssessmentAttemptResponse } from "@/lib/api/assessment-attempt-client";
import { isAnswered } from "@/lib/assessment/answer-codec";
import { AnswerFields } from "./lesson-answer-fields";
import { LessonAudio } from "./lesson-audio";
import { LessonSection, sectionOfQuestion } from "./lesson-section";
import { plainText } from "./timetable-source";
import { useAssessmentAttemptSession } from "./use-assessment-attempt-session";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: "Trắc nghiệm",
  MULTIPLE_SELECT: "Chọn nhiều đáp án",
  MATCHING: "Nối cặp",
  FILL_IN_BLANK: "Điền từ",
  SENTENCE_BUILDER: "Xếp câu",
  ESSAY: "Tự luận",
  AUDIO_RESPONSE: "Ghi âm",
  FILE_UPLOAD: "Nộp tệp",
};

export interface StageProps {
  title: string;
  /** Nội dung bài (để tìm phần chứa câu hỏi theo `layout.sections`). */
  content: unknown;
  questions: Obj[];
  answers: Record<string, string>;
  onAnswer: (questionId: string, answerJson: string) => void;
  skill: "listening" | "reading" | "writing" | "speaking";
  skillName: string;
  disabled?: boolean;
  /** Dải thông tin phía trên (giờ còn lại, trạng thái lưu...). */
  status?: ReactNode;
  /** Hành động cuối bài (nộp bài). */
  actions?: ReactNode;
  /** Ghi chú dưới câu hỏi. */
  note?: ReactNode;
  /** Báo câu ghi âm / nộp tệp đang ghi hoặc tải lên (màn cha chặn nộp bài cho tới khi xong). */
  onBusyChange?: (busy: boolean) => void;
}

/** Một câu một màn: phần chung (đoạn đọc/audio), đề, ô trả lời, nút trước/sau và bản đồ câu (câu đã trả lời được đánh dấu). */
export function QuestionStage({ title, content, questions, answers, onAnswer, skill, skillName, disabled, status, actions, note, onBusyChange }: StageProps) {
  const [index, setIndex] = useState(0);
  // Đang ghi âm/tải lên thì không chuyển câu: rời câu giữa chừng sẽ bỏ bản ghi dở hoặc để nộp bài trước khi tải xong.
  const [busy, setBusyState] = useState(false);
  const setBusy = useCallback(
    (next: boolean) => {
      setBusyState(next);
      onBusyChange?.(next);
    },
    [onBusyChange],
  );
  const current = questions[Math.min(index, Math.max(0, questions.length - 1))];
  const q = current ?? {};
  const id = typeof q.questionId === "string" ? q.questionId : "";
  const type = typeof q.questionType === "string" ? q.questionType : "";
  const prompt = typeof q.questionText === "string" ? q.questionText.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ") : "";
  const questionAudio = list(q.media).map(obj).find((m) => m.kind === "audio");

  return (
    <div className={`hsk-exercise is-${skill}`}>
      <div className="hsk-lesson-breadcrumb">● Luyện bài / {skillName}</div>
      <div className="hsk-exercise-frame">
        <header>
          <h2>{title}</h2>
          {status}
        </header>
        <section className="hsk-exercise-question">
          <div className="hsk-question-meta">
            <span>
              Câu {questions.length ? index + 1 : 0}/{questions.length}
            </span>
            <span>{TYPE_LABEL[type] ?? "Bài tập"}</span>
          </div>
          {current && (
            <>
              <LessonSection section={sectionOfQuestion(content, id)} showAudio={skill === "listening" || skill === "speaking"} />
              {type !== "FILL_IN_BLANK" && <p className="hsk-exercise-prompt">{plainText(prompt)}</p>}
              {(skill === "listening" || skill === "speaking") && questionAudio && <LessonAudio url={typeof questionAudio.url === "string" ? questionAudio.url : undefined} />}
              <AnswerFields key={id} question={q} value={answers[id] ?? ""} disabled={disabled} onChange={(json) => onAnswer(id, json)} onBusyChange={setBusy} />
              {note}
            </>
          )}
          <div className="hsk-exercise-nav">
            <button type="button" disabled={busy || index === 0} onClick={() => setIndex(index - 1)}>
              ‹ Câu trước
            </button>
            <button type="button" disabled={busy || index >= questions.length - 1} onClick={() => setIndex(index + 1)}>
              Câu sau ›
            </button>
          </div>
        </section>
        <footer className="hsk-question-map">
          {questions.map((item, i) => {
            const qid = typeof item.questionId === "string" ? item.questionId : String(i);
            return (
              <button type="button" key={qid} disabled={busy} aria-label={`Câu ${i + 1}`} aria-current={index === i ? "step" : undefined} className={`${index === i ? "is-active" : ""} ${isAnswered(answers[qid]) ? "is-answered" : ""}`.trim()} onClick={() => setIndex(i)}>
                {i + 1}
              </button>
            );
          })}
        </footer>
        {actions}
      </div>
    </div>
  );
}

const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
const SAVE_TEXT = { idle: "", saving: "Đang lưu…", saved: "Đã lưu", error: "Lưu lỗi, sẽ thử lại" } as const;

interface PlayerProps {
  attempt: AssessmentAttemptResponse;
  title: string;
  content: unknown;
  questions: Obj[];
  skill: StageProps["skill"];
  skillName: string;
  /** Gọi khi bài đã nộp (kể cả tự nộp do hết giờ) để chuyển sang màn kết quả. */
  onSubmitted: () => void;
}

/** Bài đang làm: khoá một thiết bị, tự lưu đáp án, đếm giờ, nộp bài (hết giờ tự nộp). Logic ở use-assessment-attempt-session (cùng bản của frontend/). */
export function LessonAttemptPlayer({ attempt, title, content, questions, skill, skillName, onSubmitted }: PlayerProps) {
  const session = useAssessmentAttemptSession(attempt);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitted = session.submitStatus === "submitted";
  useEffect(() => {
    if (submitted) onSubmitted();
  }, [submitted, onSubmitted]);

  const locked = session.lockState !== "acquired" || session.effectiveStatus !== "IN_PROGRESS" || session.submitStatus === "submitting";
  // Đang ghi âm/tải tệp: chưa cho nộp để bản ghi không bị bỏ sót.
  const cannotSubmit = locked || busy;
  const unanswered = questions.filter((item) => !isAnswered(session.answers[String(item.questionId)])).length;

  const status = (
    <div className="hsk-attempt-status" role="status">
      {session.remainingSeconds != null && <span>Còn lại {clock(session.remainingSeconds)}</span>}
      {SAVE_TEXT[session.saveStatus] && <span>{SAVE_TEXT[session.saveStatus]}</span>}
      {session.lockState === "checking" && <span>Đang kết nối…</span>}
      {session.lockState === "denied" && (
        <span role="alert">
          Bài đang mở ở thiết bị hoặc tab khác.{" "}
          <button type="button" onClick={() => void session.takeOver()}>
            Làm tiếp ở đây
          </button>
        </span>
      )}
      {session.lockState === "error" && (
        <span role="alert">
          Không kết nối được máy chủ.{" "}
          <button type="button" onClick={session.retryLock}>
            Thử lại
          </button>
        </span>
      )}
      {session.effectiveStatus === "TIME_OUT" && <span role="alert">Hết giờ, đang nộp bài…</span>}
    </div>
  );

  const actions = (
    <div className="hsk-attempt-submit">
      {session.submitStatus === "error" && <p role="alert">Nộp bài chưa được, hãy thử lại.</p>}
      {busy && <p role="status">Đang ghi âm hoặc tải lên, chờ xong rồi nộp bài.</p>}
      {confirming ? (
        <>
          <p>{unanswered ? `Còn ${unanswered} câu chưa trả lời. Nộp bài ngay?` : "Nộp bài ngay?"}</p>
          <button type="button" disabled={cannotSubmit} onClick={() => void session.submitNow()}>
            {session.submitStatus === "submitting" ? "Đang nộp…" : "Xác nhận nộp"}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            Làm tiếp
          </button>
        </>
      ) : (
        <button type="button" disabled={cannotSubmit} onClick={() => setConfirming(true)}>
          Nộp bài
        </button>
      )}
    </div>
  );

  return <QuestionStage title={title} content={content} questions={questions} answers={session.answers} onAnswer={session.setAnswer} skill={skill} skillName={skillName} disabled={locked} status={status} actions={actions} onBusyChange={setBusy} />;
}

/** Xem đề không có bài làm (quản trị xem thử): đáp án chỉ giữ trên trang, không lưu, không nộp. */
export function LessonQuestionPreview({ title, content, questions, skill, skillName }: Omit<PlayerProps, "attempt" | "onSubmitted">) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <QuestionStage
      title={title}
      content={content}
      questions={questions}
      answers={answers}
      onAnswer={(id, json) => setAnswers((previous) => ({ ...previous, [id]: json }))}
      skill={skill}
      skillName={skillName}
      note={<p className="hsk-local-answer-note">Xem thử: câu trả lời chỉ giữ trên trang, không lưu và không nộp.</p>}
    />
  );
}
