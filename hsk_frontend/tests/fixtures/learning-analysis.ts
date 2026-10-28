// FIXTURE TĨNH — chỉ dùng trong test. KHÔNG phải dữ liệu thật và KHÔNG được import từ mã ứng dụng.
import type { GradingAttemptSummaryResponse, GradingStudentResponse, LessonDetailResponse } from "@/types/grading";
import type { AttendanceAnalysisResponse, PersonalizationView } from "@/types/learning-analysis";

export const lessonFixture: LessonDetailResponse = {
  lessonTitle: "Buổi 1: 第一课",
  modules: [
    { id: "m1", label: "#1 Quiz - Nghe", exercises: [{ name: "一、听力 — 判断对错", quizId: "quiz-l" }] },
    { id: "m2", label: "#2 Quiz - Đọc", exercises: [{ name: "二、阅读 — 阅读理解", quizId: "quiz-r" }, { name: "Slide không có quiz" }] },
  ],
};

export const attemptsFixture: GradingAttemptSummaryResponse[] = [{ attemptId: "att-1", quizId: "quiz-l", skillType: "LISTENING", gradingStatus: "GRADED", autoScore: 6, finalScore: 7, totalPoints: 10 }];

export const studentsFixture: GradingStudentResponse[] = [
  {
    userId: "u-1",
    fullName: "Nguyễn Văn An",
    email: "an@demo.invalid",
    studentCode: "HV0001",
    modules: [
      { moduleId: "a", quizId: "quiz-l", label: "Nghe", skillType: "LISTENING", submitted: true, score: 7, maxScore: 10 },
      { moduleId: "b", quizId: "quiz-r", label: "Đọc", skillType: "READING", submitted: false, maxScore: 8 },
    ],
  },
  {
    userId: "u-2",
    name: "Trần Thị Bình",
    email: "binh@demo.invalid",
    studentCode: "HV0002",
    modules: [
      { moduleId: "c", quizId: "quiz-l", label: "Nghe", skillType: "LISTENING", submitted: true, score: 9, maxScore: 10 },
      { moduleId: "d", quizId: "quiz-r", label: "Đọc", skillType: "READING", submitted: true, score: 4, maxScore: 8 },
    ],
  },
  { userId: "u-3", fullName: "Lê Hoàng Cường", avatarUrl: "https://cdn.example.invalid/c.png", modules: [] },
];

export const attendanceFixture: AttendanceAnalysisResponse = {
  trend: [
    { sessionNo: 1, sessionLabel: "Buổi 1", studentRate: 100, classAverageRate: 90 },
    { sessionNo: 2, sessionLabel: "Buổi 2", studentRate: 50, classAverageRate: 85 },
    { sessionNo: 3, sessionLabel: "Buổi 3", studentRate: null, classAverageRate: null },
  ],
  log: [
    { sessionLabel: "Buổi 1", date: "2026-10-01", status: "PRESENT" },
    { sessionLabel: "Buổi 2", date: "2026-10-04", status: "ABSENT", note: "Vắng không phép" },
    { sessionLabel: "Buổi 3", status: "LATE", note: "Đi muộn 10 phút" },
  ],
};

export const personalizationDraftFixture: PersonalizationView = {
  available: true,
  dataSufficiency: "SUFFICIENT",
  dataSufficiencyMessage: null,
  report: { id: "rep-1", state: "DRAFT", summary: "Học viên nên luyện thêm phần đọc hiểu đoạn văn.", snapshotWeakAreas: [{ label: "Kỹ năng Đọc", mastery: 0.5 }] },
  historicalSnapshot: { id: "snap-1", version: 1, weakAreas: [{ label: "Kỹ năng Đọc", mastery: 0.5 }] },
  recommendations: [{ label: "Luyện thêm Kỹ năng Đọc", reason: "Mức nắm vững 50%", status: "PENDING" }],
  tasks: [],
  currentTasks: [],
};

export const personalizationNoSnapshotFixture: PersonalizationView = { available: true, dataSufficiency: "UNKNOWN", dataSufficiencyMessage: null, report: null, historicalSnapshot: null, recommendations: [], tasks: [], currentTasks: [] };

export const personalizationApprovedFixture: PersonalizationView = {
  ...personalizationDraftFixture,
  report: { ...personalizationDraftFixture.report!, state: "APPROVED", approvedAt: "2026-10-27T08:00:00Z" },
  recommendations: [{ label: "Luyện thêm Kỹ năng Đọc", reason: "Mức nắm vững 50%", status: "ASSIGNED" }],
  tasks: [
    { id: "task-1", title: "Bài củng cố: Kỹ năng Đọc", status: "ASSIGNED", sourceSnapshotId: "snap-1", sourceLmsScheduleId: "sch-1", materialUrl: "https://exam.demo.invalid/practice?sessionCode=CNH-1", kcLabel: "Kỹ năng Đọc" },
    { id: "task-2", title: "Bài củng cố: Từ vựng bài 1", status: "ASSIGNED", sourceSnapshotId: "snap-1", sourceLmsScheduleId: "sch-1", materialUrl: "https://exam.demo.invalid/practice?sessionCode=cnh-1", kcLabel: "Từ vựng bài 1" },
  ],
};
