## Current behavior (2026-11-14)

The notes below include historical read-only milestones. Current lesson pages support explicit attempt submission for students; admins only preview:

- Admin only previews attached assessments (read from the draft, or published fallback). There is no admin attempt endpoint: admins cannot start, answer or submit, and no attempt history is shown for them.
- Students read their classroom history for a lesson. Only a confirmed SUBMITTED attempt marks completion; a browser draft does not. Opening pages/tabs does not create or submit attempts.
- Browser drafts persist by user, lesson, skill, resource/package version and attempt. A question is checked only after leaving it. Submit is available only on the last question after every required response is filled.
- Submission uses the same flow for all four skill tabs and all sessions. Payloads cover all eight question types. Audio/file responses require configured and enabled storage and are complete only after upload confirmation. Sentence-builder answers preserve chunk indices; multiple-select preserves the selected option indices. Submitted question ticks come from the API, independent of browser drafts. Result polling follows nextPollMs and stops on completion/error/unmount.
- Package reads paginate all matches; an empty new package cannot hide older attached data. Admin reads draft (or published fallback) separately from student published snapshots.
- The timetable reads actual classes/sessions for admins (`/classes`) and enrolled classes for students (`/me/classes`); class and month filters compose, while whole-course scope ignores the month. Syllabus content is joined to each class session.
- Vocabulary mastery uses the authenticated user's `/user-learning-resources/states` and `/vocabulary-state` endpoints; only a server-confirmed KNOWN state marks completion. A failed save remains incomplete.
- Timetable reads use a memory-only cache isolated by user/role/class/session: 60 seconds for class lists, 30 seconds for session details. Successful submissions/vocabulary writes invalidate cached reads locally and in other tabs of the same user. In-flight reads invalidated by a write cannot overwrite the newer response. Logout clears the cache.
- Review buttons open Slides consistently; Continue selects an attached incomplete skill. Results open `/quiz-session/[attemptId]/result`, resolving submitted attempts from the actual session and rendering only answer keys/feedback supplied by the result API.
- Backend must be restarted for the new admin practice endpoints. Tests use mocked APIs/repositories and never submit real account answers.

# Thời khóa biểu HSK local

Route: `/student/student-timetable`. Navigation in the student header, dashboard and course-detail modal now uses this route.

## Scope

Rebuilt from the public production bundle `index-BpRNhvI-.js` and timetable-specific rules from `index-JlnkUBDQ.css`, inspected 2026-11-06. Timetable image assets are stored locally under `public/assets/hocba/tkb-*`. No production session or personal student data was copied. The existing shared student header is retained.

Implemented: hero and course statistics, course filtering, month navigation, today action, whole-course range, card/list views, session statuses, preview/locked access, exam states, session detail dialog, materials and practice-module cards, practice progress, pending/graded mentor states and result preview. Filters use `courseId` and `month` query parameters, as on production.

The preview marker stays visible. Session data is generated in `src/components/student/timetable/timetable-data.ts` relative to today, with a dedicated typed interface. It does not call production or persist grades. Replace this adapter only after confirming the real source and permissions. Existing authentication remains required.

Materials, exercises, mentor results, support and AI currently open explicit local previews/unavailable states, not integrated learning flows. No meeting/exam URL is fabricated. The production homework viewer and result pages have not been migrated as part of this screen.

## Production source observations

The production timetable uses `GET /online-learning/students/me/timetable?start=...&end=...`, enriched with course/syllabus modules, session progress, student materials and grading attempts. This is different from the currently available local `/me/classes` adapter. Do not assume these data contracts are interchangeable.

Authenticated production tab could not be directly controlled in this session. Inspection used the supplied screenshot and publicly served frontend source.

## Validation

TypeScript, targeted ESLint, isolated Edge/Playwright browser checks with a mocked auth response: month navigation, course filter, full-course scope, card/list views, session detail, material preview and mobile overflow. Real Auth/API integration remains unverified.

## Live syllabus integration

The default source now calls real APIs; preview data is not used as a fallback. `timetable-source.ts` holds the adapter.

- `ROLE_ADMIN`: `GET /syllabuses`, then detail for each syllabus, including syllabuses not assigned to a class/student. All schedule rows are visible without a date filter. Undated rows say “Chưa xếp lịch”; dates are not generated. Teacher materials/tasks are admin-only. Optional syllabus filter does not restrict the default global scope.
- Other authenticated users: `/me/classes` and class details supplied by the server; join syllabus rows by `scheduleItemId`, then `sessionNo` only as fallback. Date/time comes from the actual class session.
- Session details fetch published `/content-packages/syllabus/{id}/session-resources?sessionNo=...`. Admin additionally reads existing draft-resource endpoints. All calls are reads. Unknown progress/grades stay unknown.
- Errors and partial syllabus failures are visible; retry is available. Requests are limited to five concurrent operations.
- Actual local backend responds 401 without a login session. Contract/UI tests use isolated mocked authenticated responses, not a real student/admin token. Real ERP data still needs confirmation in the user's logged-in browser.

## Progress, skill metadata and submitted results (2026-11-07)

- Student overview uses `/me/classes/{classId}/homework-progress`; modal refreshes `/me/classes/{classId}/sessions/{sessionId}/homework-progress`. Overall progress remains the backend metric; it is not calculated from grades. Aggregate class metrics are shown only when one class is in scope.
- Assessment module history uses `GET /assessment-attempts?learningResourceId=...&sessionId=...`. Only the authenticated user's history is returned. Submitted status indicates submission completion; earned points are not used as completion percentage.
- Existing result endpoint `/assessment-attempts/{attemptId}/result` shows points, question content released by backend, submitted answers, grader comments and provisional-score status. No start/submit/grading writes were added.
- Backend resource DTO now exposes additive `resourceTitle`/`assessmentType` metadata even when `withoutContent()` strips quiz content/settings. Backend restart is required for these fields.
- Skill labels/icons use explicit assessment type; syllabus declarations are suppressed when corresponding actual skill resources exist.
- Admin global syllabus scope remains unchanged: no personal progress/history requests, no arbitrary student's grades. Progress and grading blocks remain visible with unknown/not-selected states.
- Frontend validation: 14 unit tests, typecheck/lint, isolated browser scenarios for four skills, progress, graded results and role scope. Backend: 9 targeted metadata/syllabus tests pass. Browser API responses were mocked against the real contract; authenticated live ERP data was not verified.
- Production exercise-taking screens still need reference details before matching their full interactions. Existing result reading is now connected; starting/submitting new attempts remains outside this change.

## Empty lesson destinations (2026-11-09)

Per user instruction, every timetable session now shows five navigation slots: Slides, Listening, Reading, Writing and Speaking, even when no content is assigned. These are interface destinations, not fabricated resources. Cards use unknown-progress labels and do not show sample completion.

They navigate to `/learning-path/online-course/homework/{scheduleId}` with session context and a selected tab in the query, matching the production path shape. The workspace retains production lesson/sidebar styling and allows switching materials, all four skills and session comments. Each panel explicitly shows “Chưa có dữ liệu”. No dummy questions, slides, audio, scores or student submissions are created. Download/presentation/contact controls are disabled until content/services are attached.

The existing live syllabus/progress adapters remain available for later integration. This empty workspace deliberately does not fetch or start learning activities. Returning to timetable preserves filters and rejects external return URLs.

Production reference: public `index-EWKZyg3L.js`, stylesheet `index-JlnkUBDQ.css`, plus supplied screenshots. An authenticated production browser session was not available for interactive inspection.

## Live GT2 lesson content

The lesson workspace now loads actual syllabus/session resources instead of always showing an empty panel. Navigation includes `syllabusId` and `classId`; legacy admin URLs resolve the actual schedule row. A student uses their authorized class detail to determine the syllabus, ignoring any supplied alternative syllabus ID.

Slides and skill panes render only the corresponding assigned resources. Vocabulary/grammar without a skill classification appear separately under “Nội dung đã gắn”, not misclassified as Reading/Listening. The content renderer includes words, pinyin, meanings/examples, grammar structure, definitions and explanations. Missing tabs remain empty; API errors are separate from absence. Admin draft resources are labeled; no resources were published or created.

A read-only check of the configured dev database found GT2NEW (`01M5C6XHN4N9E9ZZG6AS786J6S`) has two draft resources attached to session 1: VOCABULARY and GRAMMAR. No slide or four skill assessments were attached in that check. This is a point-in-time observation, not hardcoded application data.

Validated: 24 frontend tests, typecheck/lint, and an isolated browser using a snapshot of those actual GT2 records plus the cached real syllabus. Verified actual vocabulary/grammar fields, draft label, missing listening state, reload and mobile. Actual user-session API delivery still requires the logged-in browser.
## Production session 6 inspection (2026-11-09)

Inspected the seven activities in TEST_GT1_K01, session 6, using a separately authorized production login. All non-read API requests outside authentication were blocked during inspection. No production answers or recordings are copied into this repository.

The local lesson workspace now separates listening, reading, writing and speaking layouts, with question navigation when question content is supplied. Vocabulary material navigation includes the word list, flip cards and handwriting practice using the existing stroke-order component. These panels use the existing syllabus resources; missing content stays empty. Local answer editing does not submit attempts or change progress. Speaking submission and server progress persistence are not connected by this visual change. The handwriting training controls open the existing practice modal rather than reproducing the production inline stroke engine.

Verified TypeScript, targeted ESLint, the existing 24 timetable/lesson tests and browser checks of seven views with the actual GT2 resource snapshot. Browser checks include mobile width and no write requests.
## Inline handwriting behavior (2026-11-10)

Replaced the timetable handwriting popup with inline character pads matching the production lesson layout. Verified production controls by drawing strokes through the browser: wrong strokes do not complete a word, a complete character increases the successful-practice count, reset clears the drawing but preserves completed counts, and a multi-character word exposes a separate pad per character. Production write requests were intercepted during this inspection.

Local behavior includes model animation, outline visibility without resetting an active quiz, correct-stroke checking using Hanzi Writer, replay/reset, completion only after all characters in a word, per-word repeat counts, card navigation and learned/unpracticed filters. Existing API completion flags are read; newly completed practice is held in the current page session. No writing-status persistence endpoint has been connected. Unsupported/non-Han characters have an explicit unavailable state and cannot start a fake exercise.

Validation: TypeScript and targeted ESLint pass; ten lesson source/navigation tests pass. A Playwright check performs actual incorrect/correct mouse strokes against the installed engine, repeats a word, resets it, completes a two-character word, switches filters, checks mobile overflow and verifies no backend writes.
## Lesson tab parity and API delivery (2026-11-11)

Inspected the production vocabulary list, word-detail action, flashcard flip, handwriting, matching-game intro/play and Blast intro/play. Production non-read requests were intercepted. Matching uses word/meaning pairs; Blast asks for a word by meaning and pinyin. The local menu now nests these under the same material/vocabulary branch.

Local data contract:
- Class membership and session: GET /me/classes/{classId}; schedule metadata: GET /syllabuses/{syllabusId}.
- Student content: GET /content-packages/syllabus/{syllabusId}/session-resources?sessionNo=N (published resources only).
- Admin additionally reads resources attached to draft/published package versions with sessionNo. No student identity is chosen for admin progress.
- Existing assessment question body: GET /assessment-attempts/{id} or GET /assessment-attempts/{id}/result after the authorized history lookup. The attempt DTO wraps questions in content; result DTO wraps them in question. Both are normalized and checked against learningResourceId.
- Metadata-only new assessments display a start action. Only a student's explicit click POSTs /assessment-attempts with the actual classId, sessionId, sessionNo, learningResourceId and contentPackageVersionId. Opening a tab never starts an attempt automatically.
- Vocabulary, flashcards and games consume the lesson's VOCABULARY resourceContent. Files use resourceContent fileId/fileName/mimeType or schedule materialLink. PPTX previews run locally using pptx-preview; PDF and images use native viewers. File fetch authorization is attached only to the configured storage /file/ endpoint, not arbitrary resource URLs.

Unknown progress is not replaced with 100%. Empty resources show an empty state; question delivery failures preserve the resource metadata and surface the API error. Handwriting/flashcard/game progress and unsent answers/recordings are local to the page; saving/submitting them is not implemented by this UI change.

Validation: TypeScript and targeted ESLint; 31 source/navigation/assessment tests. Browser checks with the recorded GT2 payload cover real resource-field rendering, word details, flip, game completion/return, empty skill and mobile. Separate contract fixtures cover submitted/in-progress/public-question DTOs, explicit start request IDs, blanks, writing, microphone recording, image display and a real two-slide PPTX with next-slide navigation. These fixture questions are not project/course data. Production account data and credentials were not copied into the repository.
## Blast motion and feedback (2026-11-12)

Re-inspected production moving targets, pointer-oriented bow, arrow travel and hit feedback, with production writes intercepted. The local Blast view now has continuous target motion, bow aiming, a flying arrow before evaluation, target burst/shake, floating score, short sound cues and a countdown bar. Inputs are locked during a shot; the next question waits for the impact sequence. Timers/audio are disposed on leaving; reduced-motion preference is supported. Vocabulary continues to come from lesson resources and game progress remains local.

Browser verification plays a wrong shot, attempts a second click during flight, completes all correct answers, replays, checks mobile/reduced-motion behavior and navigates away mid-shot. Verified no backend writes or browser runtime errors. TypeScript and targeted lint pass.
