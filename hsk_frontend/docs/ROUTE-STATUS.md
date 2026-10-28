# Trạng thái route khu quản lý

FILE SINH TỰ ĐỘNG từ `src/lib/management/route-registry.ts` (test `tests/route-registry.test.ts` kiểm tra khớp; `UPDATE_ROUTE_DOCS=1 npm test` để ghi lại). Không sửa tay.
Dữ kiện HSK cũ: LMS_Frontend/src/routes/router.link.tsx @ 72292b7 (xem `docs/OLD-ROUTE-SURVEY.md`).

**Đối chiếu số lượng:** 278 khai báo trong router cũ = 277 đường dẫn duy nhất + 1 khai báo trùng; 277 = 148 route khu quản lý (bảng dưới) + 129 route học viên/công khai (ngoài phạm vi, trả 404).

| Trạng thái | Số route | Ý nghĩa |
|---|---|---|
| MIGRATED | 41 | Đã có trang thật |
| NOT_MIGRATED | 34 | Role xác định được (PrivateRoute HSK cũ, hoặc quyết định giao diện của chủ dự án); hiện trang "Chức năng đang được chuyển đổi" ở đúng URL cũ |
| UNKNOWN | 49 | Không đủ bằng chứng để phục vụ (không có PrivateRoute và chưa có quyết định, hoặc chỉ dành cho role chưa xác minh); trả 404 |
| OUT_OF_SCOPE | 24 | HSK cũ chỉ hiện "đang xây dựng"; trả 404 |

**Các route UNKNOWN chia thành nhóm không chồng lấn** (mỗi route đúng một nhóm, tổng = 49; không đổi UNKNOWN để cho số liệu khớp):

| Nhóm | Số route |
|---|---|
| HSK cũ không bọc PrivateRoute và chưa có quyết định của chủ dự án | 17 |
| PrivateRoute chỉ cho role chưa xác minh (Teacher-manager, Collaborator) | 32 |
| PrivateRoute chỉ yêu cầu đăng nhập, không xác lập role | 0 |
| **Tổng** | **49** |

Role app mới hỗ trợ: ADMIN, TEACHER, MENTOR. "Role app mới enforce" = role HSK cũ cho phép ∩ role hỗ trợ; Teacher-manager và Collaborator chưa xác minh nên
không được cấp dù HSK cũ có liệt kê. "Quyết định chủ dự án (giao diện)" chỉ là phạm vi hiển thị của frontend mới, **không phải xác nhận quyền từ backend**.

## MIGRATED (41)

| Route | Component HSK cũ | Guard cũ | Role cũ (nguyên văn) | Trạng thái | Role app mới enforce | Nguồn quyền | Căn cứ |
|---|---|---|---|---|---|---|---|
| `/admin/dashboard` | AdminDashboard | roles | ADMIN | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/membership-management` | MembershipManagement | roles | ADMIN | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/analytics` | AdminAnalyticsDashboard | roles | ADMIN | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/class-management` | AdminClassManagementPage | roles | ADMIN | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/class-management/students` | AdminClassStudentsPage | roles | ADMIN | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/teacher-management` | TeacherManagementPage | roles | ADMIN | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/statements` | InstructorFinancialStatement | roles | ADMIN | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/tickets` | TeacherManagerTickets | roles | ADMIN | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/settings/notifications` | AdminNotification | roles | ADMIN | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/instructor/welcome` | InstructorWelcome | none | — | **MIGRATED** | TEACHER, MENTOR | Quyết định chủ dự án (giao diện) | Quyết định chủ dự án (M3B.2, 2026-10-24): giao diện chỉ TEACHER, MENTOR; HSK cũ không có PrivateRoute; chưa phải xác nhận quyền từ backend |
| `/instructor/list-class` | ClassListPage | roles | TEACHER, MENTOR | **MIGRATED** | TEACHER, MENTOR | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR |
| `/instructor/list-class/list-lesson` | LessonListPage | roles | TEACHER, MENTOR | **MIGRATED** | TEACHER, MENTOR | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR |
| `/instructor/list-class/lesson-detail` | LessonDetailPage | roles | TEACHER, MENTOR | **MIGRATED** | TEACHER, MENTOR | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR |
| `/instructor/list-class/submissions` | SubmissionListPage | roles | TEACHER, MENTOR | **MIGRATED** | TEACHER, MENTOR | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR |
| `/instructor/list-class/grading` | GradingWorkspacePage | roles | TEACHER, MENTOR | **MIGRATED** | TEACHER, MENTOR | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR |
| `/instructor/list-class/learning-analysis` | LearningAnalysisListPage | roles | TEACHER, MENTOR | **MIGRATED** | TEACHER, MENTOR | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR |
| `/instructor/list-class/learning-analysis/detail` | LearningAnalysisDetailPage | roles | TEACHER, MENTOR | **MIGRATED** | TEACHER, MENTOR | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR |
| `/instructor/instructor-tickets` | InstructorTickets | roles | TEACHER, MENTOR, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, COLLABORATOR |
| `/instructor/instructor-notifications` | InstructorNotification | none | — | **MIGRATED** | TEACHER, MENTOR | Quyết định chủ dự án (giao diện) | Quyết định chủ dự án (M3B.2, 2026-10-24): giao diện chỉ TEACHER, MENTOR (Admin dùng /admin/settings/notifications); HSK cũ không có PrivateRoute; chưa phải xác nhận quyền từ backend |
| `/sets/create` | CreateSetPage | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/sets/:id/edit` | UpdateSetPage | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/flashcard/manage` | ManageFlashcard | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/flashcard/create-package` | ManageFlashcard | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/flashcard/manage-learning-path` | ManageFlashcard | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/flashcard/manage-learning` | ManageFlashcard | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/vocab-set/manage` | ManageVocabularySet | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/instructor/manage-storage` | ManageStorage | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/hanzi/create` | HanziCreateSetPage | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/hanzi/manage/create-package` | HanziCreatePackage | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/hanzi/manage` | ManageHanzi | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/hanzi/manage/select-type` | HanziSelectTypePage | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/hanzi/edit/:id` | HanziCreateSetPage | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/vocabulary/manage` | ManageVocabulary | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/learning-path/syllabus/manage` | SyllabusManagementPage | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/learning-path/online-course/manage` | OnlineCourseManagementPage | roles | ADMIN, TEACHER_MANAGER | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN, TEACHER_MANAGER |
| `/learning-path/online-course/leads` | OnlineCourseLeadManagementPage | roles | ADMIN, TEACHER_MANAGER | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN, TEACHER_MANAGER |
| `/learning-path/lesson-materials/manage` | LessonMaterialManagementPage | roles | ADMIN, TEACHER_MANAGER | **MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN, TEACHER_MANAGER |
| `/pronunciation/manage` | ManagePronunciation | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/pronunciation/manage/select-type` | PronunciationSelectTypePage | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/quiz/manage` | ManageQuiz | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/grammar/manage` | ManageGrammar | roles | TEACHER, MENTOR, COLLABORATOR, ADMIN, TEACHER_MANAGER | **MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, COLLABORATOR, ADMIN, TEACHER_MANAGER |

## NOT_MIGRATED (34)

Phục vụ trang placeholder dùng chung. Khi chuyển xong: tạo `page.tsx` ở đúng URL + thêm vào `MIGRATED_ROUTES`.

| Route | Component HSK cũ | Guard cũ | Role cũ (nguyên văn) | Trạng thái | Role app mới enforce | Nguồn quyền | Căn cứ |
|---|---|---|---|---|---|---|---|
| `/admin/profile` | AdminProfile | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/learning-path/manage` | LPManageLearningPath | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/syllabus/manage` | SyllabusManagementPage | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/flashcard/manage` | ManageFlashcard | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/hanzi/manage` | ManageHanzi | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/vocabulary/manage` | ManageVocabulary | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/online-course/manage` | OnlineCourseManagementPage | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/online-course/leads` | OnlineCourseLeadManagementPage | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/storage/manage` | ManageStorage | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/learning-path/listening-practice/manage` | ManageListeningPractice | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/grammar/manage` | ManageGrammar | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/pronunciation/manage` | ManagePronunciation | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/kanji-origin/manage` | ManageKanjiOrigin | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/admin-user-management` | AdminUserManagement | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/quiz` | AdminQuiz | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/ai-practice/manage` | ManageAiPractice | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/quiz-results` | AdminQuizResult | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/quiz-questions` | AdminQuizQuestions | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/certificates` | AdminCertificate | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/earnings` | AdminEarning | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/payouts` | AdminPayout | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/settings/profile` | AdminProfileSettings | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/settings/change-password` | AdminChangePassword | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/settings/plans` | AdminPlanSettings | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/settings/social-profiles` | AdminSocialprofileSettings | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/settings/linked-accounts` | AdminLinkedAccounts | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/settings/integrations` | AdminIntegrations | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/admin/settings/withdraw` | AdminWithdraw | roles | ADMIN | **NOT_MIGRATED** | ADMIN | PrivateRoute HSK cũ | PrivateRoute: ADMIN |
| `/learning-path/create` | LPCreateLearningPathPage | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **NOT_MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/learning-path/manage` | LPManageLearningPath | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **NOT_MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/learning-path/listening-practice/manage` | ManageListeningPractice | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **NOT_MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/kanji-origin/manage` | ManageKanjiOrigin | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **NOT_MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/kanji-origin/manage/select-type` | KanjiOriginSelectTypePage | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **NOT_MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |
| `/ai-practice/manage` | ManageAiPractice | roles | TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR | **NOT_MIGRATED** | TEACHER, MENTOR, ADMIN | PrivateRoute HSK cũ | PrivateRoute: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR |

## UNKNOWN (49)

KHÔNG được phục vụ. Cần bằng chứng/quyết định của chủ dự án (`UI_ROLE_DECISIONS`) để chuyển sang NOT_MIGRATED.

| Route | Component HSK cũ | Guard cũ | Role cũ (nguyên văn) | Trạng thái | Role app mới enforce | Nguồn quyền | Căn cứ |
|---|---|---|---|---|---|---|---|
| `/teacher-manager/dashboard` | TeacherManagerDashboard | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/profile` | TeacherManagerProfile | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/quiz` | TeacherManagerQuiz | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/ai-practice/manage` | ManageAiPractice | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/quiz-results` | TeacherManagerQuizResult | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/quiz-questions` | TeacherManagerQuizQuestions | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/certificates` | TeacherManagerCertificate | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/earnings` | TeacherManagerEarning | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/payouts` | TeacherManagerPayout | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/statements` | InstructorFinancialStatement | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/tickets` | TeacherManagerTickets | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/settings/profile` | TeacherManagerProfileSettings | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/settings/change-password` | TeacherManagerChangePassword | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/settings/plans` | TeacherManagerPlanSettings | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/settings/social-profiles` | TeacherManagerSocialprofileSettings | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/settings/linked-accounts` | TeacherManagerLinkedAccounts | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/settings/notifications` | TeacherManagerNotification | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/settings/integrations` | TeacherManagerIntegrations | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/settings/withdraw` | TeacherManagerWithdraw | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/teacher-management` | TeacherManagementPage | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/learning-path/manage` | LPManageLearningPath | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/syllabus/manage` | SyllabusManagementPage | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/flashcard/manage` | ManageFlashcard | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/hanzi/manage` | ManageHanzi | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/vocabulary/manage` | ManageVocabulary | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/online-course/manage` | OnlineCourseManagementPage | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/online-course/leads` | OnlineCourseLeadManagementPage | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/storage/manage` | ManageStorage | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/learning-path/listening-practice/manage` | ManageListeningPractice | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/grammar/manage` | ManageGrammar | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/pronunciation/manage` | ManagePronunciation | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/teacher-manager/kanji-origin/manage` | ManageKanjiOrigin | roles | TEACHER_MANAGER | **UNKNOWN** | — | — | Chỉ dành cho role chưa xác minh (TEACHER_MANAGER) |
| `/instructor/instructor-dashboard` | InstructorDashboard | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-profile` | InstructorProfile | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-quiz` | InstructorQuiz | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-quiz-results` | InstructorQuizResult | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-certificate` | InstructorCertificate | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-earnings` | InstructorEarning | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-payout` | InstructorPayout | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-statements` | InstructorFinancialStatement | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-support-tickets` | InstructorSupportTickets | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-change-password` | InstructorChangePassoword | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-plans` | InstructorPlanSettings | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-social-profiles` | InstructorSocialprofileSettings | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-linked-accounts` | InstructorLinkedAccounts | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-integrations` | InstructorIntegrations | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-withdraw` | InstructorWithdraw | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-quiz-questions` | InstructorQuizQuestions | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |
| `/instructor/instructor-settings` | InstructorProfileSettings | none | — | **UNKNOWN** | — | — | HSK cũ không bọc PrivateRoute: không có guard ở tầng route, quyền chưa được xác lập |

## OUT_OF_SCOPE (24)

KHÔNG được phục vụ.

| Route | Component HSK cũ | Guard cũ | Role cũ (nguyên văn) | Trạng thái | Role app mới enforce | Nguồn quyền | Căn cứ |
|---|---|---|---|---|---|---|---|
| `/teacher-manager/courses` | UnderConstructionContent | roles | TEACHER_MANAGER | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/teacher-manager/courses-grid` | UnderConstructionContent | roles | TEACHER_MANAGER | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/teacher-manager/announcements` | UnderConstructionContent | roles | TEACHER_MANAGER | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/teacher-manager/assignments` | UnderConstructionContent | roles | TEACHER_MANAGER | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/teacher-manager/students-grid` | UnderConstructionContent | roles | TEACHER_MANAGER | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/teacher-manager/students-list` | UnderConstructionContent | roles | TEACHER_MANAGER | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/teacher-manager/students-details` | UnderConstructionContent | roles | TEACHER_MANAGER | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/teacher-manager/messages` | UnderConstructionContent | roles | TEACHER_MANAGER | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/admin/courses` | UnderConstructionContent | roles | ADMIN | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/admin/courses-grid` | UnderConstructionContent | roles | ADMIN | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/admin/announcements` | UnderConstructionContent | roles | ADMIN | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/admin/assignments` | UnderConstructionContent | roles | ADMIN | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/admin/students-grid` | UnderConstructionContent | roles | ADMIN | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/admin/students-list` | UnderConstructionContent | roles | ADMIN | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/admin/students-details` | UnderConstructionContent | roles | ADMIN | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/admin/messages` | UnderConstructionContent | roles | ADMIN | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/instructor/instructor-course` | UnderConstructionContent | none | — | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/instructor/instructor-announcements` | UnderConstructionContent | none | — | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/instructor/instructor-assignment` | UnderConstructionContent | none | — | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/instructor/students` | UnderConstructionContent | none | — | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/instructor/student-list` | UnderConstructionContent | none | — | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/instructor/instructor-message` | UnderConstructionContent | none | — | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/instructor/instructor-course-grid` | UnderConstructionContent | none | — | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
| `/instructor/students-details` | UnderConstructionContent | none | — | **OUT_OF_SCOPE** | — | — | HSK cũ chỉ hiện UnderConstructionContent (chưa từng có chức năng thật) |
