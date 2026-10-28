// Mô hình "bài tập ↔ bài nộp ↔ chấm bài" dùng chung cho hai hồ sơ dữ liệu của mock (data/legacy.mjs và data/demo.mjs).
// Hình dạng phản hồi khớp DTO của HSK cũ (LMS_Frontend/src/core/types/quiz.type.ts: GradingStudentResponse, GradingAttemptSummaryResponse,
// GradingAttemptDetailResponse...) vì các màn chấm bài được chuyển nguyên giao diện. Mọi con số hiển thị (bài chờ chấm, điểm, tỷ lệ hoàn thành,
// số liệu tổng quan) đều ĐƯỢC SUY RA từ cùng một tập attempt ở đây, nên các màn không bao giờ lệch nhau.
//
// Trạng thái một bài làm: SUBMITTED (còn câu tự luận chưa chấm hoặc chưa chốt) → GRADED (đã chốt điểm) → RETURNED (đã gửi kết quả cho học viên);
// bài chỉ có câu máy chấm được: AUTO_GRADED ngay khi nộp (không tính là "chờ chấm").

/** PRNG xác định (mulberry32) để dữ liệu giống nhau giữa các lần chạy với cùng seed. */
export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

export const SKILLS = {
  LISTENING: { label: "一、听力", vi: "Nghe" },
  READING: { label: "二、阅读", vi: "Đọc" },
  WRITING: { label: "三、书写", vi: "Viết" },
  SPEAKING: { label: "四、口语", vi: "Nói" },
  TRANSLATION: { label: "五、翻译", vi: "Dịch" },
};

const AUTO_TYPES = new Set(["TRUE_FALSE", "MULTIPLE_CHOICE", "FILL_IN_BLANK", "MATCHING_PAIRS"]);
export const isManualType = (type) => !AUTO_TYPES.has(type);

// ---------- ngân hàng câu hỏi mẫu (nội dung tiếng Trung giả định cho HSK, không lấy từ dữ liệu thật) ----------
const Q = {
  tf: (text, correct) => ({
    questionType: "TRUE_FALSE",
    questionText: text,
    options: [
      { id: "对", content: "对", isCorrect: correct },
      { id: "错", content: "错", isCorrect: !correct },
    ],
    correctAnswer: correct ? "对" : "错",
    maxScore: 1,
  }),
  mc: (text, options, correctIndex) => ({
    questionType: "MULTIPLE_CHOICE",
    questionText: text,
    options: options.map((content, i) => ({ id: String.fromCharCode(65 + i), content: `${String.fromCharCode(65 + i)}. ${content}`, isCorrect: i === correctIndex })),
    correctAnswer: String.fromCharCode(65 + correctIndex),
    maxScore: 1,
  }),
  blank: (text, answers) => ({
    questionType: "FILL_IN_BLANK",
    questionText: text,
    blanks: answers.map((correctAnswer, index) => ({ index, correctAnswer })),
    correctAnswer: answers.join(" / "),
    maxScore: answers.length,
  }),
  match: (pairs) => ({
    questionType: "MATCHING_PAIRS",
    questionText: "请把左右两栏配对。",
    matchingPairs: pairs.map(([prompt, answer], i) => ({ id: `p${i + 1}`, prompt, answer })),
    correctAnswer: pairs.map(([p, a]) => `${p} → ${a}`).join("; "),
    maxScore: pairs.length,
  }),
  short: (text, sample, maxScore = 3) => ({ questionType: "SHORT_ANSWER", questionText: text, correctAnswer: sample, maxScore }),
  essay: (text, maxScore = 5) => ({ questionType: "ESSAY", questionText: text, correctAnswer: "Bài viết tự luận, giáo viên chấm theo rubric.", maxScore }),
  audio: (text, maxScore = 5) => ({ questionType: "AUDIO_RESPONSE", questionText: text, correctAnswer: "Giáo viên nghe và chấm phát âm/ngữ điệu.", maxScore }),
};

/** Bộ đề mẫu theo kỹ năng; mỗi lần gọi trả bản sao để từng quiz có id riêng. */
export const QUIZ_TEMPLATES = [
  { skill: "LISTENING", title: "一、听力 — 判断对错", questions: () => [Q.tf("1. 男的周末要去北京出差。", true), Q.tf("2. 女的不喜欢喝咖啡。", false), Q.mc("3. 他们打算几点出发？", ["七点", "八点", "九点"], 1), Q.mc("4. 男的为什么不开心？", ["太累了", "太热了", "和老婆吵架了", "为老婆赶蚊子"], 3)] },
  { skill: "READING", title: "二、阅读 — 阅读理解", questions: () => [Q.mc("1. 这篇文章主要讲了什么？", ["爱情", "家庭", "工作"], 1), Q.blank("2. 他每天早上___起床，然后去___。", ["六点", "公园"]), Q.match([["苹果", "水果"], ["老师", "职业"], ["北京", "城市"]]), Q.short("3. 请简述你对“因材施教”的理解。", "根据学生的特点采取不同的教学方法。")] },
  { skill: "WRITING", title: "三、书写 — 短文写作", questions: () => [Q.blank("1. 我___（xǐhuan）学习汉语。", ["喜欢"]), Q.essay("2. 请以“我的家乡”为题写一篇80字左右的短文。")] },
  { skill: "SPEAKING", title: "四、口语 — 朗读与回答", questions: () => [Q.audio("1. 请朗读：今天天气很好，我们一起去公园散步吧。"), Q.audio("2. 请回答：你为什么学习汉语？")] },
  { skill: "TRANSLATION", title: "五、翻译 — 汉越互译", questions: () => [Q.short("1. 翻译成越南语：学而时习之，不亦说乎？", "Học mà thường ôn tập, chẳng vui lắm sao?"), Q.short("2. Dịch sang tiếng Trung: Tôi đã học tiếng Trung được hai năm.", "我学汉语学了两年了。")] },
];

// ---------- câu trả lời giả của học viên ----------
function answerFor(rng, q, ability) {
  const correct = rng.chance(ability);
  switch (q.questionType) {
    case "TRUE_FALSE":
    case "MULTIPLE_CHOICE": {
      const right = q.options.find((o) => o.isCorrect);
      const wrong = rng.pick(q.options.filter((o) => !o.isCorrect));
      const chosen = correct ? right : wrong;
      return { studentAnswer: chosen.id, isCorrect: chosen.isCorrect, autoScore: chosen.isCorrect ? q.maxScore : 0 };
    }
    case "FILL_IN_BLANK": {
      const answers = q.blanks.map((b) => ({ blankIndex: b.index, answer: rng.chance(ability) ? b.correctAnswer : "不知道" }));
      const right = answers.filter((a, i) => a.answer === q.blanks[i].correctAnswer).length;
      return { studentAnswer: answers, isCorrect: right === q.blanks.length, autoScore: right };
    }
    case "MATCHING_PAIRS": {
      const ids = q.matchingPairs.map((p) => p.id);
      const pairMatches = q.matchingPairs.map((p, i) => ({ promptId: p.id, answerId: rng.chance(ability) ? p.id : ids[(i + 1) % ids.length] }));
      const right = pairMatches.filter((m) => m.promptId === m.answerId).length;
      return { studentAnswer: { pairMatches }, isCorrect: right === ids.length, autoScore: right };
    }
    case "AUDIO_RESPONSE":
      return { studentAnswer: null, studentAudioId: `demo-audio-${rng.int(1000, 9999)}`, isCorrect: null, autoScore: null };
    default:
      return { studentAnswer: rng.pick(["我觉得老师应该根据每个学生的情况来教。", "家庭是最重要的，因为家人永远支持我们。", "Tôi nghĩ việc ôn tập thường xuyên rất quan trọng."]), isCorrect: null, autoScore: null };
  }
}

/**
 * Tạo kho bài tập + bài nộp.
 * @param opts.rng            PRNG của createRng
 * @param opts.sessions       [{ sessionId, classId, sessionNo, title, topic, date (ISO ngày), hasAssignment }]
 * @param opts.studentsOf     (classId) => [{ userId, name, email, phone, studentCode, ability (0..1) }]
 * @param opts.todayIso       ngày hôm nay (ISO) — buổi sau hôm nay chưa có bài nộp
 * @param opts.quizzesPerSession số bài tập mỗi buổi có bài tập (mặc định 2..3)
 * @param opts.submitRate     xác suất một học viên nộp một bài (mặc định 0.7)
 */
export function createGradingStore(opts) {
  const { rng, sessions, studentsOf, todayIso } = opts;
  const quizzes = new Map(); // quizId -> { quizId, sessionId, title, skillType, totalPoints, questions[] }
  const quizzesBySession = new Map(); // sessionId -> quizId[]
  const attempts = new Map(); // attemptId -> attempt
  const attemptsBySession = new Map(); // sessionId -> attemptId[]
  const notes = new Map(); // `${classId}|${scheduleId}|${userId}` -> { content, sentAt, author }
  const lessonDetails = new Map(); // scheduleId -> bản ghi đã "lưu" từ màn chi tiết bài học
  let seq = 0;
  const id = (p) => `${p}-${(++seq).toString(36)}`;

  for (const s of sessions) {
    if (!s.hasAssignment) continue;
    const n = opts.quizzesPerSession ?? rng.int(2, 3);
    const templates = [...QUIZ_TEMPLATES].sort(() => rng.next() - 0.5).slice(0, n);
    const list = [];
    templates.forEach((t, order) => {
      const questions = t.questions().map((q, i) => ({ ...q, questionId: id("q"), questionIndex: i + 1 }));
      const quiz = { quizId: id("quiz"), sessionId: s.sessionId, title: t.title, skillType: t.skill, questions, totalPoints: questions.reduce((sum, q) => sum + q.maxScore, 0), groupId: `${s.sessionId}-m${order + 1}`, groupName: `#${order + 1} Quiz - ${SKILLS[t.skill].vi}`, groupOrder: order + 1 };
      quizzes.set(quiz.quizId, quiz);
      list.push(quiz.quizId);
    });
    quizzesBySession.set(s.sessionId, list);

    if (s.date > todayIso) continue; // buổi chưa diễn ra: chưa ai nộp
    const students = studentsOf(s.classId);
    const ids = [];
    for (const st of students) {
      for (const quizId of list) {
        if (!rng.chance(opts.submitRate ?? 0.7)) continue;
        const quiz = quizzes.get(quizId);
        const questions = quiz.questions.map((q) => ({ ...q, answerId: id("ans"), ...answerFor(rng, q, st.ability), teacherScore: null, teacherComment: "", returnedAt: null }));
        const manual = questions.some((q) => isManualType(q.questionType));
        // Bài cũ hơn thì nhiều khả năng đã chấm/trả; bài gần đây còn chờ chấm.
        const age = (Date.parse(todayIso) - Date.parse(s.date)) / 86_400_000;
        let gradingStatus = manual ? "SUBMITTED" : "AUTO_GRADED";
        if (manual && age > 14 && rng.chance(0.8)) gradingStatus = "RETURNED";
        else if (manual && age > 7 && rng.chance(0.6)) gradingStatus = "GRADED";
        if (gradingStatus === "GRADED" || gradingStatus === "RETURNED") {
          // Trả bài 3–10 ngày sau buổi học (không phải "hôm qua" cho mọi bài) để số liệu "đã trả tuần này" của tổng quan có nghĩa.
          const returnedAt = new Date(Date.parse(s.date) + Math.min(age, rng.int(3, 10)) * 86_400_000).toISOString();
          for (const q of questions) {
            if (isManualType(q.questionType)) {
              q.teacherScore = rng.int(Math.floor(q.maxScore / 2), q.maxScore);
              q.teacherComment = rng.pick(["Diễn đạt tốt, chú ý trật tự từ.", "Ý rõ, còn lỗi dùng 的/得/地.", "Rất tốt!", "Cần viết dài hơn một chút."]);
            }
            if (gradingStatus === "RETURNED") q.returnedAt = returnedAt;
          }
        }
        const attempt = {
          attemptId: id("att"), userId: st.userId, quizId, sessionId: s.sessionId, classId: s.classId,
          submittedAt: new Date(Date.parse(s.date) + 20 * 3_600_000 + rng.int(0, 3_600_000)).toISOString(),
          gradingStatus, teacherComment: gradingStatus === "SUBMITTED" ? "" : rng.pick(["Em làm bài tốt, tiếp tục phát huy.", "Cần ôn lại phần ngữ pháp bài 3.", "Phát âm tiến bộ rõ."]),
          questions,
        };
        attempts.set(attempt.attemptId, attempt);
        ids.push(attempt.attemptId);
      }
    }
    attemptsBySession.set(s.sessionId, ids);
  }

  // ---------- tính điểm ----------
  const questionScore = (q) => (q.teacherScore != null ? q.teacherScore : q.autoScore != null ? q.autoScore : 0);
  const autoScore = (a) => a.questions.reduce((sum, q) => sum + (q.autoScore ?? 0), 0);
  const currentScore = (a) => Math.round(a.questions.reduce((sum, q) => sum + questionScore(q), 0) * 100) / 100;
  const finalScore = (a) => (a.gradingStatus === "SUBMITTED" ? undefined : currentScore(a));
  const isPending = (a) => a.gradingStatus === "SUBMITTED";
  const quizOf = (a) => quizzes.get(a.quizId);
  const toUiStatus = (gs) => (gs === "RETURNED" ? "returned" : gs === "GRADED" || gs === "AUTO_GRADED" ? "graded" : "submitted");

  const summary = (a) => {
    const q = quizOf(a);
    return { attemptId: a.attemptId, quizId: a.quizId, quizTitle: q.title, moduleId: q.groupId, skillType: q.skillType, gradingStatus: a.gradingStatus, autoScore: autoScore(a), finalScore: finalScore(a), totalPoints: q.totalPoints, totalQuestions: q.questions.length, submittedAt: a.submittedAt, groupId: q.groupId, groupName: q.groupName, groupOrder: q.groupOrder, quizOrder: 1 };
  };
  const detail = (a) => {
    const q = quizOf(a);
    return { attemptId: a.attemptId, userId: a.userId, quizId: a.quizId, quizTitle: q.title, scheduleId: a.sessionId, moduleId: q.groupId, skillType: q.skillType, gradingStatus: a.gradingStatus, autoScore: autoScore(a), finalScore: finalScore(a), totalPoints: q.totalPoints, teacherComment: a.teacherComment, submittedAt: a.submittedAt, questions: a.questions.map((x) => ({ ...x })) };
  };

  const sessionAttempts = (sessionId) => (attemptsBySession.get(sessionId) ?? []).map((aid) => attempts.get(aid));
  const findAttempt = (attemptId) => {
    const a = attempts.get(attemptId);
    if (!a) throw Object.assign(new Error("Không tìm thấy bài làm (MOCK)"), { status: 404 });
    return a;
  };

  return {
    quizzes,
    sessionQuizzes: (sessionId) => (quizzesBySession.get(sessionId) ?? []).map((qid) => quizzes.get(qid)),
    sessionAttempts,
    /** classId của bài làm (kiểm tra quyền sở hữu ở handler); null nếu không có. */
    attemptClassOf: (attemptId) => attempts.get(attemptId)?.classId ?? null,
    attemptIdOfAnswer: (answerId) => [...attempts.values()].find((a) => a.questions.some((q) => q.answerId === answerId))?.attemptId ?? null,
    hasPendingGrading: (sessionId) => sessionAttempts(sessionId).some(isPending),
    pendingCount: (sessionId) => sessionAttempts(sessionId).filter(isPending).length,
    classHasPending: (classId) => sessions.some((s) => s.classId === classId && sessionAttempts(s.sessionId).some(isPending)),
    classPendingCount: (classId) => sessions.filter((s) => s.classId === classId).reduce((sum, s) => sum + sessionAttempts(s.sessionId).filter(isPending).length, 0),
    /** Số bài nộp / số bài chờ chấm / điểm trung bình của toàn bộ hoặc theo lớp (số liệu tổng quan). */
    stats(classIds) {
      const all = [...attempts.values()].filter((a) => !classIds || classIds.includes(a.classId));
      const graded = all.filter((a) => a.gradingStatus !== "SUBMITTED");
      const avg = graded.length ? graded.reduce((s, a) => s + currentScore(a) / quizOf(a).totalPoints, 0) / graded.length : null;
      return { submitted: all.length, pending: all.filter(isPending).length, graded: graded.length, returned: all.filter((a) => a.gradingStatus === "RETURNED").length, averagePercent: avg === null ? null : Math.round(avg * 100) };
    },

    /** GradingStudentResponse[] của một buổi: mọi học viên của lớp, kèm module (bài tập) đã giao trong buổi. */
    scheduleStudents(sessionId, students) {
      const quizList = (quizzesBySession.get(sessionId) ?? []).map((qid) => quizzes.get(qid));
      const totalQuestions = quizList.reduce((sum, q) => sum + q.questions.length, 0);
      return students.map((st) => {
        const mine = sessionAttempts(sessionId).filter((a) => a.userId === st.userId);
        const modules = quizList.map((q) => {
          const a = mine.find((x) => x.quizId === q.quizId);
          return { moduleId: a ? a.attemptId : q.quizId, attemptId: a?.attemptId, quizId: q.quizId, label: q.title, skillType: q.skillType, submitted: !!a, status: a ? toUiStatus(a.gradingStatus) : undefined, score: a ? currentScore(a) : undefined, maxScore: q.totalPoints, groupId: q.groupId, groupName: q.groupName, groupOrder: q.groupOrder, quizOrder: 1 };
        });
        const answered = mine.reduce((sum, a) => sum + a.questions.filter((q) => q.studentAnswer !== null && q.studentAnswer !== "" || q.studentAudioId).length, 0);
        return {
          userId: st.userId, email: st.email, name: st.name, fullName: st.name, phone: st.phone, studentCode: st.studentCode,
          completionRate: quizList.length ? Math.round((mine.length / quizList.length) * 100) : 0,
          totalScore: Math.round(mine.reduce((sum, a) => sum + currentScore(a), 0) * 100) / 100,
          answeredQuestions: answered, totalQuestions, submittedAny: mine.length > 0, ungradedCount: mine.filter(isPending).length, modules,
        };
      });
    },
    studentAttempts: (sessionId, userId) => sessionAttempts(sessionId).filter((a) => a.userId === userId).map(summary),
    attempt: (attemptId) => detail(findAttempt(attemptId)),

    /**
     * Tổng hợp theo lớp cho Admin (hợp đồng HSK cũ GET /grading/admin/classes/{id}/students): mỗi học viên gộp module của mọi buổi có bài tập,
     * completionRate = số bài đã nộp / số bài đã giao.
     */
    classStudents(sessionIds, students) {
      const quizList = sessionIds.flatMap((sid) => (quizzesBySession.get(sid) ?? []).map((qid) => quizzes.get(qid)));
      const all = sessionIds.flatMap((sid) => sessionAttempts(sid));
      return students.map((st) => {
        const mine = all.filter((a) => a.userId === st.userId);
        const modules = quizList.map((qz) => {
          const a = mine.find((x) => x.quizId === qz.quizId);
          return { moduleId: a ? a.attemptId : qz.quizId, attemptId: a?.attemptId, quizId: qz.quizId, label: qz.title, skillType: qz.skillType, submitted: !!a, status: a ? toUiStatus(a.gradingStatus) : undefined, score: a ? currentScore(a) : undefined, maxScore: qz.totalPoints };
        });
        return {
          userId: st.userId, email: st.email, name: st.name, fullName: st.name, phone: st.phone, studentCode: st.studentCode,
          completionRate: quizList.length ? Math.round((mine.length / quizList.length) * 100) : 0,
          totalScore: Math.round(mine.reduce((sum, a) => sum + currentScore(a), 0) * 100) / 100,
          submittedAny: mine.length > 0, ungradedCount: mine.filter(isPending).length, modules,
        };
      });
    },

    // ---------- thao tác GHI (chỉ tồn tại trong bộ nhớ của mock) ----------
    gradeAnswer(answerId, body) {
      const a = [...attempts.values()].find((x) => x.questions.some((q) => q.answerId === answerId));
      if (!a) throw Object.assign(new Error("Không tìm thấy câu trả lời (MOCK)"), { status: 404 });
      const q = a.questions.find((x) => x.answerId === answerId);
      if (q.returnedAt) throw Object.assign(new Error("Câu này đã gửi kết quả, không chấm lại (MOCK)"), { status: 409 });
      q.teacherScore = body.teacherScore ?? null;
      q.teacherComment = body.teacherComment ?? "";
      return detail(a);
    },
    gradeQuestion(attemptId, questionId, body) {
      const a = findAttempt(attemptId);
      let q = a.questions.find((x) => x.questionId === questionId);
      if (!q) {
        // backend cũ: tự tạo bản ghi trả lời rỗng rồi chấm (câu được tách ra sau khi học viên đã nộp)
        q = { questionId, answerId: id("ans"), questionType: "SHORT_ANSWER", questionText: "(câu bổ sung)", studentAnswer: "", isCorrect: null, autoScore: null, maxScore: 1, teacherScore: null, teacherComment: "", returnedAt: null };
        a.questions.push(q);
      }
      q.teacherScore = body.teacherScore ?? null;
      q.teacherComment = body.teacherComment ?? "";
      return detail(a);
    },
    finalizeAttempt(attemptId, body) {
      const a = findAttempt(attemptId);
      if (a.gradingStatus === "RETURNED") throw Object.assign(new Error("Bài đã trả cho học viên (MOCK)"), { status: 409 });
      a.gradingStatus = "GRADED";
      if (body?.teacherComment !== undefined) a.teacherComment = body.teacherComment;
      return detail(a);
    },
    sendAttempt(attemptId, body, sentAt) {
      const a = findAttempt(attemptId);
      if (body?.teacherComment !== undefined) a.teacherComment = body.teacherComment;
      if (a.gradingStatus === "SUBMITTED") a.gradingStatus = "GRADED";
      a.gradingStatus = "RETURNED";
      for (const q of a.questions) if (!q.returnedAt) q.returnedAt = sentAt;
      return detail(a);
    },
    /** Gửi kết quả mọi bài đã chấm của một học viên trong buổi; trả số bài đã gửi. */
    sendStudentResults(sessionId, userId, sentAt) {
      let n = 0;
      for (const a of sessionAttempts(sessionId).filter((x) => x.userId === userId && x.gradingStatus === "GRADED")) {
        a.gradingStatus = "RETURNED";
        for (const q of a.questions) if (!q.returnedAt) q.returnedAt = sentAt;
        n++;
      }
      return n;
    },

    // ---------- chi tiết bài học (nội dung bài tập của buổi) ----------
    lessonDetail(sessionId, lessonTitle) {
      const saved = lessonDetails.get(sessionId);
      if (saved) return saved;
      const quizList = (quizzesBySession.get(sessionId) ?? []).map((qid) => quizzes.get(qid));
      return {
        lessonTitle,
        modules: quizList.map((q) => ({
          id: q.groupId, label: q.title, topicType: "Bài học", materialType: SKILLS[q.skillType].vi, locked: true,
          exercises: [{ name: q.title, quizId: q.quizId, questions: q.questions.map((x) => ({ no: x.questionIndex, type: x.questionType, text: x.questionText, score: x.maxScore, options: (x.options ?? []).map((o) => ({ label: o.content, correct: !!o.isCorrect })) })) }],
        })),
      };
    },
    saveLessonDetail(sessionId, data) {
      lessonDetails.set(sessionId, data);
      return data;
    },

    // ---------- nhận xét của giáo viên ----------
    sendNote(classId, scheduleId, userId, content, author, sentAt) {
      const note = { content, sentAt, author };
      notes.set(`${classId}|${scheduleId}|${userId}`, note);
      return note;
    },
    latestNote: (classId, scheduleId, userId) => notes.get(`${classId}|${scheduleId}|${userId}`) ?? null,
  };
}
