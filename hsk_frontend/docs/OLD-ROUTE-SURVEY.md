# Khảo sát route của HSK cũ (chỉ đọc)

Sinh bởi `scripts/survey-old-routes.mjs` từ **LMS_Frontend/src/routes/router.link.tsx @ 72292b7**. Không chỉnh tay. Trạng thái ở app mới: `docs/ROUTE-STATUS.md`.

- Tổng số route khai báo trong `publicRoutes` + `authRoutes` (đã bỏ phần bị comment): **278** = **277** đường dẫn duy nhất + **1** khai báo trùng (`/instructor/instructor-profile` ở dòng 1171 và 1285; cùng component, cùng guard)
- Route khu quản lý (URL thuộc `/admin`, `/instructor`, `/teacher-manager`, hoặc `PrivateRoute` theo role nhân sự): **148**
- Route học viên/công khai/xác thực (ngoài phạm vi frontend quản lý): **129** — 80 không guard, 49 chỉ yêu cầu đăng nhập

## Cơ chế guard thực tế của HSK cũ

`PrivateRoute` (`core/common/private-route.tsx`): chờ `isAuthReady`; chưa đăng nhập → chuyển Authentication_Frontend `/login?redirect=…`;
có `allowedRoles` mà người dùng không có role nào trong danh sách → chuyển `/error-403`; không có `allowedRoles` → chỉ cần đã đăng nhập.
Route KHÔNG bọc `PrivateRoute` không có guard nào ở tầng route (mọi người, kể cả chưa đăng nhập, đều tải được component; việc hạn chế nếu có nằm trong
component hoặc API). Không được suy ra quyền từ việc thiếu `PrivateRoute`.

## Route khu quản lý

| Route | Component cũ | Dòng | Guard | Roles (nguyên văn) | Ghi chú |
|---|---|---|---|---|---|
| `/admin/dashboard` | AdminDashboard | 370 | roles | ADMIN |  |
| `/teacher-manager/dashboard` | TeacherManagerDashboard | 380 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/profile` | TeacherManagerProfile | 390 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/courses` | UnderConstructionContent | 399 | roles | TEACHER_MANAGER | UnderConstruction |
| `/teacher-manager/courses-grid` | UnderConstructionContent | 408 | roles | TEACHER_MANAGER | UnderConstruction |
| `/teacher-manager/announcements` | UnderConstructionContent | 417 | roles | TEACHER_MANAGER | UnderConstruction |
| `/teacher-manager/assignments` | UnderConstructionContent | 426 | roles | TEACHER_MANAGER | UnderConstruction |
| `/teacher-manager/students-grid` | UnderConstructionContent | 435 | roles | TEACHER_MANAGER | UnderConstruction |
| `/teacher-manager/students-list` | UnderConstructionContent | 444 | roles | TEACHER_MANAGER | UnderConstruction |
| `/teacher-manager/students-details` | UnderConstructionContent | 453 | roles | TEACHER_MANAGER | UnderConstruction |
| `/teacher-manager/quiz` | TeacherManagerQuiz | 462 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/ai-practice/manage` | ManageAiPractice | 471 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/quiz-results` | TeacherManagerQuizResult | 480 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/quiz-questions` | TeacherManagerQuizQuestions | 489 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/certificates` | TeacherManagerCertificate | 498 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/earnings` | TeacherManagerEarning | 507 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/payouts` | TeacherManagerPayout | 516 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/statements` | InstructorFinancialStatement | 525 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/messages` | UnderConstructionContent | 534 | roles | TEACHER_MANAGER | UnderConstruction |
| `/teacher-manager/tickets` | TeacherManagerTickets | 543 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/settings/profile` | TeacherManagerProfileSettings | 552 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/settings/change-password` | TeacherManagerChangePassword | 561 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/settings/plans` | TeacherManagerPlanSettings | 570 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/settings/social-profiles` | TeacherManagerSocialprofileSettings | 579 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/settings/linked-accounts` | TeacherManagerLinkedAccounts | 588 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/settings/notifications` | TeacherManagerNotification | 597 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/settings/integrations` | TeacherManagerIntegrations | 606 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/settings/withdraw` | TeacherManagerWithdraw | 615 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/teacher-management` | TeacherManagementPage | 624 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/learning-path/manage` | LPManageLearningPath | 633 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/syllabus/manage` | SyllabusManagementPage | 642 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/flashcard/manage` | ManageFlashcard | 651 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/hanzi/manage` | ManageHanzi | 660 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/vocabulary/manage` | ManageVocabulary | 669 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/online-course/manage` | OnlineCourseManagementPage | 687 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/online-course/leads` | OnlineCourseLeadManagementPage | 696 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/storage/manage` | ManageStorage | 705 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/learning-path/listening-practice/manage` | ManageListeningPractice | 714 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/grammar/manage` | ManageGrammar | 723 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/pronunciation/manage` | ManagePronunciation | 732 | roles | TEACHER_MANAGER |  |
| `/teacher-manager/kanji-origin/manage` | ManageKanjiOrigin | 741 | roles | TEACHER_MANAGER |  |
| `/admin/membership-management` | MembershipManagement | 750 | roles | ADMIN |  |
| `/admin/profile` | AdminProfile | 764 | roles | ADMIN |  |
| `/admin/learning-path/manage` | LPManageLearningPath | 773 | roles | ADMIN |  |
| `/admin/syllabus/manage` | SyllabusManagementPage | 782 | roles | ADMIN |  |
| `/admin/flashcard/manage` | ManageFlashcard | 791 | roles | ADMIN |  |
| `/admin/hanzi/manage` | ManageHanzi | 800 | roles | ADMIN |  |
| `/admin/vocabulary/manage` | ManageVocabulary | 809 | roles | ADMIN |  |
| `/admin/online-course/manage` | OnlineCourseManagementPage | 827 | roles | ADMIN |  |
| `/admin/online-course/leads` | OnlineCourseLeadManagementPage | 836 | roles | ADMIN |  |
| `/admin/storage/manage` | ManageStorage | 845 | roles | ADMIN |  |
| `/admin/learning-path/listening-practice/manage` | ManageListeningPractice | 854 | roles | ADMIN |  |
| `/admin/grammar/manage` | ManageGrammar | 863 | roles | ADMIN |  |
| `/admin/pronunciation/manage` | ManagePronunciation | 872 | roles | ADMIN |  |
| `/admin/kanji-origin/manage` | ManageKanjiOrigin | 881 | roles | ADMIN |  |
| `/admin/analytics` | AdminAnalyticsDashboard | 890 | roles | ADMIN |  |
| `/admin/class-management` | AdminClassManagementPage | 899 | roles | ADMIN |  |
| `/admin/class-management/students` | AdminClassStudentsPage | 908 | roles | ADMIN |  |
| `/admin/courses` | UnderConstructionContent | 917 | roles | ADMIN | UnderConstruction |
| `/admin/courses-grid` | UnderConstructionContent | 926 | roles | ADMIN | UnderConstruction |
| `/admin/announcements` | UnderConstructionContent | 935 | roles | ADMIN | UnderConstruction |
| `/admin/assignments` | UnderConstructionContent | 944 | roles | ADMIN | UnderConstruction |
| `/admin/students-grid` | UnderConstructionContent | 953 | roles | ADMIN | UnderConstruction |
| `/admin/students-list` | UnderConstructionContent | 962 | roles | ADMIN | UnderConstruction |
| `/admin/students-details` | UnderConstructionContent | 971 | roles | ADMIN | UnderConstruction |
| `/admin/admin-user-management` | AdminUserManagement | 980 | roles | ADMIN |  |
| `/admin/teacher-management` | TeacherManagementPage | 989 | roles | ADMIN |  |
| `/admin/quiz` | AdminQuiz | 998 | roles | ADMIN |  |
| `/admin/ai-practice/manage` | ManageAiPractice | 1007 | roles | ADMIN |  |
| `/admin/quiz-results` | AdminQuizResult | 1016 | roles | ADMIN |  |
| `/admin/quiz-questions` | AdminQuizQuestions | 1025 | roles | ADMIN |  |
| `/admin/certificates` | AdminCertificate | 1034 | roles | ADMIN |  |
| `/admin/earnings` | AdminEarning | 1043 | roles | ADMIN |  |
| `/admin/payouts` | AdminPayout | 1052 | roles | ADMIN |  |
| `/admin/statements` | InstructorFinancialStatement | 1061 | roles | ADMIN |  |
| `/admin/messages` | UnderConstructionContent | 1070 | roles | ADMIN | UnderConstruction |
| `/admin/tickets` | TeacherManagerTickets | 1079 | roles | ADMIN |  |
| `/admin/settings/profile` | AdminProfileSettings | 1089 | roles | ADMIN |  |
| `/admin/settings/change-password` | AdminChangePassword | 1098 | roles | ADMIN |  |
| `/admin/settings/plans` | AdminPlanSettings | 1107 | roles | ADMIN |  |
| `/admin/settings/social-profiles` | AdminSocialprofileSettings | 1116 | roles | ADMIN |  |
| `/admin/settings/linked-accounts` | AdminLinkedAccounts | 1125 | roles | ADMIN |  |
| `/admin/settings/notifications` | AdminNotification | 1134 | roles | ADMIN |  |
| `/admin/settings/integrations` | AdminIntegrations | 1143 | roles | ADMIN |  |
| `/admin/settings/withdraw` | AdminWithdraw | 1152 | roles | ADMIN |  |
| `/instructor/instructor-dashboard` | InstructorDashboard | 1161 | none | — |  |
| `/instructor/welcome` | InstructorWelcome | 1166 | none | — |  |
| `/instructor/instructor-profile` | InstructorProfile | 1171 | none | — |  |
| `/instructor/instructor-course` | UnderConstructionContent | 1176 | none | — | UnderConstruction |
| `/instructor/instructor-announcements` | UnderConstructionContent | 1181 | none | — | UnderConstruction |
| `/instructor/instructor-assignment` | UnderConstructionContent | 1186 | none | — | UnderConstruction |
| `/instructor/students` | UnderConstructionContent | 1191 | none | — | UnderConstruction |
| `/instructor/student-list` | UnderConstructionContent | 1196 | none | — | UnderConstruction |
| `/instructor/list-class` | ClassListPage | 1201 | roles | TEACHER, MENTOR |  |
| `/instructor/list-class/list-lesson` | LessonListPage | 1206 | roles | TEACHER, MENTOR |  |
| `/instructor/list-class/lesson-detail` | LessonDetailPage | 1211 | roles | TEACHER, MENTOR |  |
| `/instructor/list-class/submissions` | SubmissionListPage | 1216 | roles | TEACHER, MENTOR |  |
| `/instructor/list-class/grading` | GradingWorkspacePage | 1221 | roles | TEACHER, MENTOR |  |
| `/instructor/list-class/learning-analysis` | LearningAnalysisListPage | 1226 | roles | TEACHER, MENTOR |  |
| `/instructor/list-class/learning-analysis/detail` | LearningAnalysisDetailPage | 1231 | roles | TEACHER, MENTOR |  |
| `/instructor/instructor-quiz` | InstructorQuiz | 1236 | none | — |  |
| `/instructor/instructor-quiz-results` | InstructorQuizResult | 1241 | none | — |  |
| `/instructor/instructor-certificate` | InstructorCertificate | 1246 | none | — |  |
| `/instructor/instructor-earnings` | InstructorEarning | 1251 | none | — |  |
| `/instructor/instructor-payout` | InstructorPayout | 1256 | none | — |  |
| `/instructor/instructor-statements` | InstructorFinancialStatement | 1261 | none | — |  |
| `/instructor/instructor-message` | UnderConstructionContent | 1266 | none | — | UnderConstruction |
| `/instructor/instructor-tickets` | InstructorTickets | 1271 | roles | TEACHER, MENTOR, COLLABORATOR |  |
| `/instructor/instructor-support-tickets` | InstructorSupportTickets | 1280 | none | — |  |
| `/instructor/instructor-change-password` | InstructorChangePassoword | 1290 | none | — |  |
| `/instructor/instructor-plans` | InstructorPlanSettings | 1295 | none | — |  |
| `/instructor/instructor-social-profiles` | InstructorSocialprofileSettings | 1300 | none | — |  |
| `/instructor/instructor-linked-accounts` | InstructorLinkedAccounts | 1305 | none | — |  |
| `/instructor/instructor-notifications` | InstructorNotification | 1310 | none | — |  |
| `/instructor/instructor-integrations` | InstructorIntegrations | 1315 | none | — |  |
| `/instructor/instructor-withdraw` | InstructorWithdraw | 1320 | none | — |  |
| `/instructor/instructor-course-grid` | UnderConstructionContent | 1525 | none | — | UnderConstruction |
| `/instructor/students-details` | UnderConstructionContent | 1530 | none | — | UnderConstruction |
| `/instructor/instructor-quiz-questions` | InstructorQuizQuestions | 1535 | none | — |  |
| `/instructor/instructor-settings` | InstructorProfileSettings | 1590 | none | — |  |
| `/sets/create` | CreateSetPage | 1600 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/sets/:id/edit` | UpdateSetPage | 1605 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/flashcard/manage` | ManageFlashcard | 1674 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/flashcard/create-package` | ManageFlashcard | 1679 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/flashcard/manage-learning-path` | ManageFlashcard | 1684 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/flashcard/manage-learning` | ManageFlashcard | 1689 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/vocab-set/manage` | ManageVocabularySet | 1694 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/instructor/manage-storage` | ManageStorage | 1704 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/hanzi/create` | HanziCreateSetPage | 1715 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/hanzi/manage/create-package` | HanziCreatePackage | 1725 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/hanzi/manage` | ManageHanzi | 1730 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/hanzi/manage/select-type` | HanziSelectTypePage | 1735 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/hanzi/edit/:id` | HanziCreateSetPage | 1745 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/vocabulary/manage` | ManageVocabulary | 1776 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/learning-path/create` | LPCreateLearningPathPage | 1807 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/learning-path/manage` | LPManageLearningPath | 1812 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/learning-path/syllabus/manage` | SyllabusManagementPage | 1817 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/learning-path/online-course/manage` | OnlineCourseManagementPage | 1822 | roles | ADMIN, TEACHER_MANAGER |  |
| `/learning-path/online-course/leads` | OnlineCourseLeadManagementPage | 1827 | roles | ADMIN, TEACHER_MANAGER |  |
| `/learning-path/lesson-materials/manage` | LessonMaterialManagementPage | 1837 | roles | ADMIN, TEACHER_MANAGER |  |
| `/learning-path/listening-practice/manage` | ManageListeningPractice | 1843 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/kanji-origin/manage` | ManageKanjiOrigin | 1907 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/pronunciation/manage` | ManagePronunciation | 1922 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/kanji-origin/manage/select-type` | KanjiOriginSelectTypePage | 1927 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/pronunciation/manage/select-type` | PronunciationSelectTypePage | 1932 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/quiz/manage` | ManageQuiz | 1943 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |
| `/grammar/manage` | ManageGrammar | 1948 | roles | TEACHER, MENTOR, COLLABORATOR, ADMIN, TEACHER_MANAGER |  |
| `/ai-practice/manage` | ManageAiPractice | 1957 | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |  |

## Route ngoài phạm vi (học viên/công khai/xác thực)

Chỉ liệt kê đường dẫn để đối chiếu; app quản lý không phục vụ chúng.

**Không guard (80):** `/`, `/index`, `/course/course-grid`, `/online-courses`, `/course/:slug`, `/course/course-list`, `/course/course-category`, `/course/course-category-2`, `/course/course-category-3`, `/course/course-resume`, `/course/course-watch`, `/course/cart`, `/course/checkout`, `/course/add-course`, `/payment/success`, `/payment/cancel`, `/membership/pricing`, `/course/course-details`, `/course/course-details-2`, `/course/hsk-1-2`, `/course/hsk-3`, `/course/hsk-4`, `/course/hsk-5`, `/course/hsk-6`, `/student/student-dashboard`, `/blog/blog-grid`, `/blog/blog-2-grid`, `/blog/blog-3-grid`, `/blog/blog-carousal`, `/blog/blog-masonry`, `/blog/blog-left-sidebar`, `/blog/blog-right-sidebar`, `/blog/blog-details-left-sidebar`, `/blog/blog-details-right-sidebar`, `/pages/instructor-grid`, `/pages/instructor-list`, `/pages/instructor-details`, `/pages/about-us`, `/pages/contact-us`, `/pages/notifications`, `/pages/become-an-instructor`, `/pages/testimonials`, `/pages/pricing-plan`, `/pages/faq`, `/terms-conditions`, `/pages/privacy-policy`, `/student/student-profile`, `/student/student-courses`, `/student/student-certificates`, `/student/student-wishlist`, `/student/student-reviews`, `/student/student-quiz`, `/student/student-order-history`, `/student/student-referral`, `/student/student-messages`, `/student/student-tickets`, `/student/student-settings`, `/student/student-change-password`, `/student/student-social-profile`, `/student/student-linked-accounts`, `/student/student-notifications`, `/student/student-timetable`, `/student/student-notification-list`, `/student/student-billing-address`, `/student/student-quiz-questions`, `/login`, `/register`, `/forgot-password`, `/set-password`, `/reset-password`, `/otp`, `/lock-screen`, `/pages/error-403`, `/error-403`, `/pages/error-404`, `/pages/error-500`, `/pages/under-construction`, `/pages/coming-soon`, `/verify-email`, `*`

**Chỉ yêu cầu đăng nhập (49):** `/cart`, `/checkout/success`, `/sets`, `/sets/:id`, `/sets/:id/select-game`, `/sets/:id/match-intro`, `/sets/:id/blast`, `/sets/:id/blast/play`, `/sets/:id/match`, `/sets/:id/quiz`, `/sets/:id/practice`, `/folders`, `/folders/:id`, `/storage`, `/storage/:id`, `/folder-detail/:id`, `/flashcard/package/:id`, `/hanzi`, `/hanzi/:id/practice`, `/hanzi/:id`, `/hanzi/folders`, `/hanzi/folders/:id`, `/hanzi/folder-detail/:id`, `/vocabulary`, `/vocabulary/:id`, `/learning-path`, `/learning-path/:id`, `/learning-path/:id/step/:stepId`, `/learning-path/:id/practice/:moduleId`, `/learning-path/folders/:id`, `/learning-path/online-course/homework/:scheduleId`, `/learning-path/listening-practice`, `/learning-path/listening-practice/watch/:studySetId/:videoCode`, `/ai-practice`, `/ai-practice/:moduleId`, `/on-luyen/luyen-de`, `/hsk-writing`, `/hsk-writing/:moduleId`, `/kanji-origin`, `/kanji-origin/vocabulary`, `/kanji-origin/lesson/:studySetId`, `/kanji-origin/detail/:originId`, `/pronunciation`, `/pronunciation/detail/:id`, `/quiz`, `/quiz/:quizId/attempt`, `/quiz/:quizId/retry-question`, `/quiz/:quizId/result`, `/quiz-session/:scheduleId/result`

**Theo role nhưng không phải role nhân sự (0):** (không có)
