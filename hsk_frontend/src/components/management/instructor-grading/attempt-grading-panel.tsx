"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useGradingLock } from "@/components/management/instructor-grading/use-grading-lock";
import { plainText } from "@/components/student/timetable/timetable-source";
import { getGradingDetail, saveGrading, type GradingAnswerItem, type GradingDetail, type SaveGradingItem } from "@/lib/api/assessment-grading-client";
import { fileUrl } from "@/lib/api/storage-client";
import { AnswerLines } from "@/components/shared/answer-lines";
import { answerLines } from "@/lib/assessment/answer-parts";
import { formatCorrectAnswer, formatPoints } from "@/lib/assessment/result-format";

interface Edit {
  points?: string;
  comment?: string;
}

const questionLine = (html: string) => plainText(html).replace(/\{\{\d+\}\}/g, "____");

function parse(answerJson: string | null): Record<string, unknown> {
  try {
    const value = answerJson ? JSON.parse(answerJson) : null;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Đáp án của học viên: bản ghi âm (nghe), tệp (liên kết tải), còn lại là chữ theo từng loại câu. */
function StudentAnswer({ item }: { item: GradingAnswerItem }) {
  const type = item.question.questionType;
  const answer = parse(item.answerJson);
  if (type === "AUDIO_RESPONSE") {
    const audio = answer.audio as { fileId?: string } | null | undefined;
    const src = audio?.fileId ? fileUrl(audio.fileId) : null;
    return src ? <audio controls src={src} preload="none" className="w-100" /> : <em className="text-muted">(Không có bản ghi âm)</em>;
  }
  if (type === "FILE_UPLOAD") {
    const files = Array.isArray(answer.files) ? (answer.files as { fileId: string; fileName?: string }[]) : [];
    if (!files.length) return <em className="text-muted">(Không nộp tệp nào)</em>;
    return (
      <ul className="mb-0">
        {files.map((file) => (
          <li key={file.fileId}>
            <a href={fileUrl(file.fileId) ?? undefined} target="_blank" rel="noreferrer">
              {file.fileName || file.fileId}
            </a>
          </li>
        ))}
      </ul>
    );
  }
  const lines = answerLines(item.question, item.answerJson, item.parts);
  return lines.length ? <AnswerLines lines={lines} /> : <em className="text-muted">(Không trả lời)</em>;
}

const SOURCE_LABEL = { AUTO: "Tự động", AI: "Gợi ý của AI", MANUAL: "Giáo viên" } as const;

/**
 * Chấm một bài làm trên API chấm bài của backend chung: xin khoá chấm, xem từng câu, nhập điểm/nhận xét rồi lưu một lần.
 * Điểm tự động hiện sẵn và sửa được; điểm gợi ý của AI chỉ là đề xuất cho tới khi bạn lưu. Không có bước "gửi kết quả":
 * học viên thấy điểm của một câu ngay khi câu đó được lưu.
 */
export function AttemptGradingPanel({ attemptId, title }: { attemptId: string; title: string }) {
  const lock = useGradingLock(attemptId);
  const [detail, setDetail] = useState<GradingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGradingDetail(attemptId)
      .then((data) => !cancelled && setDetail(data))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Không tải được bài làm"));
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const pointsOf = (item: GradingAnswerItem) => edits[item.questionId]?.points ?? (item.earnedPoints != null ? String(item.earnedPoints) : "");
  const commentOf = (item: GradingAnswerItem) => edits[item.questionId]?.comment ?? item.graderComment ?? "";
  const setEdit = (questionId: string, patch: Edit) => setEdits((previous) => ({ ...previous, [questionId]: { ...previous[questionId], ...patch } }));
  const canEdit = lock.state === "held" && !saving;

  const save = async () => {
    if (!detail) return;
    const items: SaveGradingItem[] = [];
    for (const item of detail.answers) {
      if (!item.answerId || !edits[item.questionId]) continue;
      const raw = pointsOf(item).trim();
      const max = item.maxPoints ?? 0;
      const value = Number(raw);
      if (raw === "" || !Number.isFinite(value) || value < 0 || value > max) {
        toast.error(`Câu ${item.displayOrder}: điểm phải nằm trong khoảng 0–${formatPoints(max)}.`);
        return;
      }
      items.push({ answerId: item.answerId, earnedPoints: value, graderComment: commentOf(item).trim() || undefined });
    }
    if (!items.length) {
      toast.info("Chưa có thay đổi nào để lưu.");
      return;
    }
    setSaving(true);
    try {
      setDetail(await saveGrading(attemptId, lock.sessionToken, items));
      setEdits({});
      toast.success("Đã lưu điểm.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu điểm thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card mb-3" data-testid="attempt-grading-panel">
      <div className="cm-banner card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
        <span className="fw-bold">{detail?.title || title}</span>
        {detail && (
          <span className="fw-semibold">
            {formatPoints(detail.earnedPoints)}/{formatPoints(detail.totalPoints)} điểm
          </span>
        )}
      </div>
      <div className="card-body">
        {lock.state === "denied" && (
          <div className="alert alert-warning d-flex align-items-center justify-content-between" role="alert">
            <span>Bài này đang được người khác chấm{lock.holder ? ` (${lock.holder})` : ""}. Bạn chỉ xem được.</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void lock.takeOver().then((ok) => ok || toast.error("Không giành được quyền chấm. Vui lòng thử lại."))}>
              Chấm thay
            </button>
          </div>
        )}
        {lock.state === "error" && (
          <div className="alert alert-danger" role="alert">
            Không kết nối được để xin quyền chấm. Tải lại trang để thử lại.
          </div>
        )}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {!detail && !error && <span className="spinner-border text-primary" />}

        {detail?.answers.map((item) => (
          <div key={item.questionId} className="border rounded p-3 mb-3">
            <div className="d-flex justify-content-between gap-3">
              <div className="fw-semibold">
                Câu {item.displayOrder}. {questionLine(item.question.questionText ?? "")}
              </div>
              {item.scoreSource && <span className="badge bg-light text-dark border flex-shrink-0">{SOURCE_LABEL[item.scoreSource]}{item.provisional ? " — chưa duyệt" : ""}</span>}
            </div>
            <div className="mt-2">
              <span className="text-muted small">Học viên trả lời: </span>
              <StudentAnswer item={item} />
            </div>
            {formatCorrectAnswer(item.question).length > 0 && (
              <div className="mt-1 small text-success">Đáp án đúng: {formatCorrectAnswer(item.question).join("; ")}</div>
            )}
            {item.answerId ? (
              <div className="row g-2 mt-2">
                <div className="col-md-2 col-4">
                  <label className="form-label small mb-1" htmlFor={`pts-${item.questionId}`}>
                    Điểm (tối đa {formatPoints(item.maxPoints)})
                  </label>
                  <input id={`pts-${item.questionId}`} type="number" min={0} max={item.maxPoints ?? undefined} step="0.25" className="form-control form-control-sm" value={pointsOf(item)} disabled={!canEdit} onChange={(e) => setEdit(item.questionId, { points: e.target.value })} />
                </div>
                <div className="col-md-10 col-8">
                  <label className="form-label small mb-1" htmlFor={`cmt-${item.questionId}`}>
                    Nhận xét
                  </label>
                  <textarea id={`cmt-${item.questionId}`} rows={1} className="form-control form-control-sm" value={commentOf(item)} disabled={!canEdit} onChange={(e) => setEdit(item.questionId, { comment: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="small text-muted mt-2">Học viên bỏ trống câu này.</div>
            )}
          </div>
        ))}

        {detail && (
          <div className="text-end">
            <button type="button" className="btn btn-danger" disabled={!canEdit || Object.keys(edits).length === 0} onClick={() => void save()}>
              {saving ? "Đang lưu…" : "Lưu điểm"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
