# StudyHub

A student workspace built with HTML, CSS and JavaScript. Plan study sessions, explore sample notes and practice with original multiple-choice questions.

## Current features

- **Home:** an overview of the workspace with light and dark themes.
- **Notes library:** sample note cards, title search and course filtering. File selection and the submission form are demos; no files are uploaded or available to download.
- **Practice Hub:** a working quiz demo at `exams.html`. Choose a subject, topic, difficulty and question count, answer at your own pace, and review results with explanations. The former exam upload/download archive has been replaced.
- **Study Planner:** a responsive monthly calendar and daily workspace for tasks, editable notes and exam/deadline markers, saved in the browser's `localStorage`. Month statistics and the Monthly Overview are calculated directly from tasks. Upcoming deadlines cover the next five days, with urgent items due within three days.

## Practice Hub

The fixed question bank contains **36 original questions** across Mathematics, Computer Science and Physics, with two topics per subject and Easy, Medium and Hard difficulty levels. Each topic/difficulty combination contains two questions; choosing All topics provides four questions for that subject/difficulty.

Questions are not taken from university exams. A test draws unique questions from the matching pool without generating new content. If a request exceeds the pool, the interface explains the limit instead of starting an incomplete test.

Answers can be changed, cleared or left blank. Results include correct, incorrect and blank counts, plus accuracy rounded to the nearest whole percent (correct answers divided by all questions, including blanks). Restarting repeats the same questions with cleared answers; creating a new test returns to the setup form.

Practice sessions stay in memory and reset on page reload. Suggested Reviews group incorrect and unanswered questions by topic, including each topic separately in All topics tests. Fully correct tests produce no review tasks. These deterministic suggestions describe only the short demo test; they are not AI output or an assessment of overall knowledge.

Choose suggestions and use **Plan Reviews** to continue to Planner in the same tab. Planner shows a preview with selectable reviews and a study date. Only **Add selected tasks** writes to Planner; dismissing the preview never changes existing tasks. Unselected reviews are discarded after a successful save.

The handoff uses `sessionStorage` key `studyHubPracticeReviews`: version 1, an `attemptId`, and bounded review records containing stable IDs, subject/topic IDs, and incorrect/blank counts. Both pages validate the contract; display text comes from known question-bank metadata. Practice Hub never accesses `studyHubPlannerData`. Each new or restarted attempt gets a new ID; suggestions for that attempt retain their IDs.

Imported tasks retain the existing Planner fields and add optional `source: { type: "practice-review", id, attemptId }` metadata. Duplicate source IDs are checked across every saved date, including completed tasks. Deleting a task also removes its duplicate marker; there is no separate attempt history. Legacy tasks and other metadata are preserved.

Failed Planner writes keep both the previous saved record and the pending suggestions. Editing and dismissal pause until the pending save is retried or the page is reloaded. Successful writes clear the handoff; if session cleanup fails, source IDs prevent duplicate additions. Invalid handoffs leave the saved Planner untouched. Use a consistent origin and the same tab; no cross-device sync or Practice session history is provided.

## Run locally

Open `index.html` in a modern browser, or serve this directory with an existing local static server. There is no build step and no package installation is required. A consistent local HTTP origin is preferable for reliable theme and Planner storage; browser handling of `localStorage` on `file:` URLs can vary.

## Source layout

- `index.html`, `notes.html`, `exams.html`, `planner.html`: main pages.
- `styles.css`: shared design tokens, theme colors and components.
- `notes.css`, `exams.css`, `planner.css`: page-specific Notes, Practice Hub and Planner styles.
- `theme.js`: system-aware theme selection and saved preference.
- `script.js`: shared navigation, Notes demo and existing Planner behavior.
- `practice-questions.js`: original question bank and subject/topic metadata.
- `practice.js`: test selection, question navigation, scoring and solution review.
- `practice-transfer.js`: review rules, versioned handoff validation and Planner import preview. Planner also loads question-bank metadata to validate topic IDs.
- `notesUpdate.html`: an older standalone Notes prototype, outside the main navigation flow.

## Checks

With Node.js installed, run `node --test tests/planner.test.cjs tests/practice.test.cjs` to check Planner validation, safe text rendering, storage failures, legacy compatibility, calendar keyboard navigation, monthly statistics, deadline ordering, Practice Hub questions/scoring, topic-based suggestions, user confirmation, invalid handoffs and duplicate prevention. These unit tests use a small DOM substitute.

For optional real-browser checks with an already installed Chrome/Chromium browser, run `node tests/planner-layout.browser.cjs "C:\Program Files\Google\Chrome\Application\chrome.exe"` (adjust the executable path as needed). It uses a temporary browser profile and local HTTP server, checks calendar/dashboard dimensions and exercises the same-tab Practice-to-Planner flow, including storage failure/retry and replay. It does not access your normal browser profile. Manual visual, touch, download and screen-reader testing is still useful.

Planner rejects malformed saved records without replacing them and offers a raw JSON download when the saved text can be read. Failed writes leave the last saved record unchanged and pause editing until the operation is retried or the page is reloaded. Export the saved record before attempting manual recovery; partial or automatic repair is not implemented.

## Current limits

There is no backend, database, authentication, cloud sync, AI service or paid API integration. Account and information-page links are placeholders. Planner storage is local to the browser and is not a backup; keep separate copies of important plans. Main-page interfaces use English. Planner dates can be selected with arrow keys or the native date buttons; notes save when their fields lose focus. Navigating dates never moves tasks or rewrites saved records.
