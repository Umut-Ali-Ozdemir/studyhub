# StudyHub

A student workspace built with HTML, CSS and JavaScript. Plan study sessions, explore sample notes and practice with original multiple-choice questions.

## Current features

- **Home:** an overview of the workspace with light and dark themes.
- **Notes library:** sample note cards, title search and course filtering. File selection and the submission form are demos; no files are uploaded or available to download.
- **Practice Hub:** a working quiz demo at `exams.html`. Choose a subject, topic, difficulty and question count, answer at your own pace, and review results with explanations. The former exam upload/download archive has been replaced.
- **Study Planner:** a calendar with daily tasks, notes, completion tracking and upcoming deadlines, saved in the browser's `localStorage`. Its monthly analysis uses predefined messages, not AI.

## Practice Hub

The fixed question bank contains **36 original questions** across Mathematics, Computer Science and Physics, with two topics per subject and Easy, Medium and Hard difficulty levels. Each topic/difficulty combination contains two questions; choosing All topics provides four questions for that subject/difficulty.

Questions are not taken from university exams. A test draws unique questions from the matching pool without generating new content. If a request exceeds the pool, the interface explains the limit instead of starting an incomplete test.

Answers can be changed, cleared or left blank. Results include correct, incorrect and blank counts, plus accuracy rounded to the nearest whole percent (correct answers divided by all questions, including blanks). Restarting repeats the same questions with cleared answers; creating a new test returns to the setup form.

Practice sessions stay in memory and reset on page reload. They do not read or write Planner data, and no Planner integration is implemented.

## Run locally

Open `index.html` in a modern browser, or serve this directory with an existing local static server. There is no build step and no package installation is required. A consistent local HTTP origin is preferable for reliable theme and Planner storage; browser handling of `localStorage` on `file:` URLs can vary.

## Source layout

- `index.html`, `notes.html`, `exams.html`, `planner.html`: main pages.
- `styles.css`: shared design tokens, theme colors and existing Planner styles.
- `notes.css`, `exams.css`: page-specific Notes and Practice Hub styles.
- `theme.js`: system-aware theme selection and saved preference.
- `script.js`: shared navigation, Notes demo and existing Planner behavior.
- `practice-questions.js`: original question bank and subject/topic metadata.
- `practice.js`: test selection, question navigation, scoring and solution review.
- `notesUpdate.html`: an older standalone Notes prototype, outside the main navigation flow.

## Checks

With Node.js installed, run `node --test tests/practice.test.cjs` to check the question bank, answer keys, selection, scoring, navigation and restart flows. The UI tests use a small DOM substitute; they do not replace real-browser responsive, keyboard or screen-reader testing.

## Current limits

There is no backend, database, authentication, cloud sync, AI service or paid API integration. Account and information-page links are placeholders. Planner storage is local to the browser and is not a backup; keep separate copies of important plans. User-facing text is being standardized in English; the existing Planner still includes Turkish text.
