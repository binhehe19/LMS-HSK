"use client";
import { useCallback, useState } from "react";
import type { AssessmentAttemptResponse } from "@/lib/api/assessment-attempt-client";
import { useStudentRequest } from "../student-data";
import { LessonAttemptPlayer, LessonQuestionPreview } from "./lesson-attempt-player";
import { LessonAttemptResult } from "./lesson-attempt-result";
import { readLessonAssessments, startLessonAssessment } from "./lesson-assessment-source";
import type { TimetableModule, TimetableSession } from "./timetable-data";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {});
const NAMES = { listening: "Nghe", reading: "Đọc", writing: "Viết", speaking: "Nói" } as const;

interface Props {
  session?: TimetableSession;
  isAdmin: boolean;
  resources: TimetableModule[];
  skill: keyof typeof NAMES;
}

/**
 * Phần bài tập của buổi học, dùng chung luồng làm bài với IELTS: bắt đầu/tiếp tục bài (`/assessment-attempts`), làm và tự lưu, nộp,
 * rồi xem kết quả (`/result`). Quản trị chỉ xem thử, không tạo bài làm.
 */
export function ExercisePanel({ resources, skill, session, isAdmin }: Props) {
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState<Record<string, TimetableModule>>({});
  const [finished, setFinished] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const live = useStudentRequest(useCallback(() => readLessonAssessments(resources), [resources]));

  const loaded = live.data?.resources ?? resources;
  const modules = loaded.map((module) => started[module.id] ?? module);
  const exercise = modules[Math.min(active, Math.max(0, modules.length - 1))];
  const markFinished = useCallback((id: string) => setFinished((previous) => (previous[id] ? previous : { ...previous, [id]: true })), []);

  const start = async (target: TimetableModule) => {
    if (!session || isAdmin) return;
    setStarting(true);
    setStartError("");
    try {
      const next = await startLessonAssessment(target, session);
      setStarted((previous) => ({ ...previous, [target.id]: next }));
      setFinished((previous) => ({ ...previous, [target.id]: false }));
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Không tải được bài tập");
    } finally {
      setStarting(false);
    }
  };

  const content = obj(exercise?.content);
  const attempt = content.attempt ? (content.attempt as AssessmentAttemptResponse) : null;
  const questions = (Array.isArray(content.questions) ? content.questions : []).map(obj);
  const title = exercise?.title || `Phần ${NAMES[skill]}`;
  const canStart = !isAdmin && !!session && !!exercise?.resourceId && !!exercise.packageVersionId;
  const readyToStart = canStart && !attempt;

  let body;
  if (exercise && attempt && (attempt.status === "SUBMITTED" || finished[exercise.id])) {
    body = <LessonAttemptResult key={attempt.attemptId} attemptId={attempt.attemptId} onRetake={canStart ? () => void start(exercise) : undefined} />;
  } else if (exercise && attempt && questions.length) {
    body = <LessonAttemptPlayer key={attempt.attemptId} attempt={attempt} title={title} content={exercise.content} questions={questions} skill={skill} skillName={NAMES[skill]} onSubmitted={() => markFinished(exercise.id)} />;
  } else if (exercise && !attempt && questions.length && isAdmin) {
    body = <LessonQuestionPreview key={exercise.id} title={title} content={exercise.content} questions={questions} skill={skill} skillName={NAMES[skill]} />;
  } else {
    body = (
      <div className={`hsk-exercise is-${skill}`}>
        <div className="hsk-lesson-breadcrumb">● Luyện bài / {NAMES[skill]}</div>
        <div className="hsk-exercise-frame">
          <header>
            <h2>{title}</h2>
          </header>
          <div className="hsk-lesson-empty">
            <h3>{live.loading ? "Đang tải bài tập…" : readyToStart ? "Sẵn sàng làm bài" : "Chưa có dữ liệu"}</h3>
            {!live.loading && <p>{readyToStart ? "Bấm bắt đầu để mở câu hỏi." : resources.length ? "Không tải được nội dung câu hỏi của bài tập này." : "Buổi học chưa được gắn bài tập này."}</p>}
            {exercise && canStart && (
              <button type="button" className="lesson-start-attempt" disabled={starting || live.loading} onClick={() => void start(exercise)}>
                {starting ? "Đang tải…" : "Bắt đầu bài tập"}
              </button>
            )}
            {(startError || !!live.data?.warnings.length) && <p role="alert">{startError || live.data?.warnings.join(" · ")}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {modules.length > 1 && (
        <div className="hsk-exercise-picker" role="tablist" aria-label="Chọn bài tập">
          {modules.map((item, i) => (
            <button type="button" role="tab" key={item.id} aria-selected={i === active} className={i === active ? "is-active" : ""} onClick={() => setActive(i)}>
              {item.topicTitle ? `${item.topicTitle} · ${item.title}` : item.title}
            </button>
          ))}
        </div>
      )}
      {body}
    </>
  );
}
