// Shared, versioned contract for an explicit same-tab Practice -> Planner handoff.
// No storage access occurs until a page calls the UI actions below.
const studyHubReviews = (() => {
    const key = 'studyHubPracticeReviews';
    let sequence = 0;
    const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    function attemptId() {
        const random = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        return 'attempt-' + random + '-' + (++sequence);
    }
    function metadata(review) {
        const subject = practiceQuestionBank.subjects.find(item => item.id === review.subject);
        const topic = subject?.topics.find(item => item.id === review.topic);
        if (!subject || !topic) throw new Error('Unknown review topic');
        return { subject: subject.name, topic: topic.name };
    }
    function describe(review) {
        const names = metadata(review);
        const count = review.incorrect + review.blank;
        return {
            title: 'Review ' + names.topic,
            reason: `Revisit ${count} incorrect or unanswered ${count === 1 ? 'question' : 'questions'} (${review.incorrect} incorrect, ${review.blank} unanswered).`,
            subject: names.subject
        };
    }
    function validate(value) {
        if (!record(value) || value.version !== 1 || typeof value.attemptId !== 'string' ||
            !/^attempt-[a-zA-Z0-9-]{1,100}$/.test(value.attemptId) ||
            !Array.isArray(value.reviews) || value.reviews.length < 1 || value.reviews.length > 6) {
            throw new Error('Invalid review transfer');
        }
        const seen = new Set();
        let count = 0;
        const reviews = value.reviews.map(review => {
            if (!record(review) || typeof review.subject !== 'string' || typeof review.topic !== 'string' ||
                review.subject.length > 32 || review.topic.length > 40 ||
                !Number.isInteger(review.incorrect) || !Number.isInteger(review.blank) ||
                review.incorrect < 0 || review.blank < 0 || review.incorrect + review.blank < 1 ||
                review.incorrect + review.blank > 36) throw new Error('Invalid review');
            metadata(review);
            const id = `${value.attemptId}:${review.subject}:${review.topic}`;
            if (review.id !== id || seen.has(id)) throw new Error('Invalid or duplicate review ID');
            seen.add(id);
            count += review.incorrect + review.blank;
            return { id, subject: review.subject, topic: review.topic, incorrect: review.incorrect, blank: review.blank };
        });
        if (count > 36) throw new Error('Review count exceeds the demo question bank');
        return { version: 1, attemptId: value.attemptId, reviews };
    }
    function parse(raw) {
        if (typeof raw !== 'string' || raw.length > 8192) throw new Error('Invalid review transfer length');
        return validate(JSON.parse(raw));
    }
    function suggest(questions, answers, id) {
        const groups = new Map();
        questions.forEach((question, index) => {
            const answer = answers[index];
            if (answer === question.correctIndex) return;
            const key = question.subject + ':' + question.topic;
            if (!groups.has(key)) groups.set(key, {
                id: `${id}:${key}`, subject: question.subject, topic: question.topic, incorrect: 0, blank: 0
            });
            groups.get(key)[answer === null || answer === undefined ? 'blank' : 'incorrect']++;
        });
        const reviews = [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
        return reviews.length ? validate({ version: 1, attemptId: id, reviews }).reviews : [];
    }
    function alreadyPlanned(data, id) {
        return Object.values(data).some(day => day.tasks.some(task => task.source?.type === 'practice-review' && task.source.id === id));
    }
    return Object.freeze({ key, attemptId, describe, validate, parse, suggest, alreadyPlanned });
})();

function initPlannerReviewImport({ getData, canEdit, save, createId, editDay, onAdded, initialDate }) {
    const panel = document.getElementById('review-import');
    const list = document.getElementById('review-import-list');
    const dateInput = document.getElementById('review-import-date');
    const form = document.getElementById('review-import-form');
    const add = document.getElementById('review-import-add');
    const cancel = document.getElementById('review-import-cancel');
    const feedback = document.getElementById('review-import-feedback');
    const status = document.getElementById('review-import-status');
    let transfer = null;
    let raw;
    let saving = false;
    const rows = [];
    dateInput.value = initialDate;
    function refresh() {
        cancel.disabled = saving;
        rows.forEach(({ review, checkbox, label }) => {
            const duplicate = studyHubReviews.alreadyPlanned(getData(), review.id);
            checkbox.disabled = duplicate || !canEdit();
            if (duplicate) checkbox.checked = false;
            label.textContent = duplicate ? 'Already planned' : studyHubReviews.describe(review).subject;
        });
        dateInput.disabled = !transfer || !canEdit();
        add.disabled = !transfer || !canEdit() || !rows.some(row => row.checkbox.checked && !row.checkbox.disabled);
        status.textContent = !transfer ? '' : !canEdit() ? 'Planner editing is paused. Resolve the storage warning before adding reviews.' :
            rows.every(row => studyHubReviews.alreadyPlanned(getData(), row.review.id)) ? 'These reviews are already in your planner.' :
                'Choose reviews and a date. Nothing is added until you confirm.';
    }
    try {
        raw = sessionStorage.getItem(studyHubReviews.key);
        if (raw !== null) transfer = studyHubReviews.parse(raw);
    } catch {
        panel.hidden = false;
        feedback.textContent = 'Review suggestions could not be read or validated. Your planner is unchanged. Return to Practice Hub to try again, or dismiss this transfer.';
    }
    if (transfer) {
        panel.hidden = false;
        transfer.reviews.forEach(review => {
            const row = document.createElement('label');
            row.className = 'review-choice';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            const details = studyHubReviews.describe(review);
            const text = document.createElement('span');
            const title = document.createElement('strong');
            title.textContent = details.title;
            const reason = document.createElement('span');
            reason.textContent = details.reason;
            const label = document.createElement('small');
            text.appendChild(title); text.appendChild(reason); text.appendChild(label);
            row.appendChild(checkbox); row.appendChild(text); list.appendChild(row);
            rows.push({ review, checkbox, label });
            checkbox.addEventListener('change', refresh);
        });
    }
    function clearTransfer(success) {
        try {
            const latest = sessionStorage.getItem(studyHubReviews.key);
            if (latest !== raw && latest !== null) throw new Error('Transfer changed');
            if (latest !== null) sessionStorage.removeItem(studyHubReviews.key);
            transfer = null;
            panel.hidden = true;
            feedback.textContent = success;
        } catch {
            feedback.textContent = success + ' The transfer could not be cleared. Already planned reviews will not be added again; you can try Dismiss again.';
        }
        refresh();
    }
    cancel.addEventListener('click', () => {
        if (!saving) clearTransfer('Transfer dismissed. Your existing planner tasks are unchanged.');
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!transfer || !canEdit()) return;
        const date = dateInput.value;
        // Native form validation is also backed by the Planner's date validator.
        try { validatePlannerData({ [date]: { tasks: [] } }); }
        catch { feedback.textContent = 'Choose a valid date for your review tasks.'; dateInput.focus(); return; }
        const selected = rows.filter(row => row.checkbox.checked && !studyHubReviews.alreadyPlanned(getData(), row.review.id)).map(row => row.review);
        if (!selected.length) { feedback.textContent = 'Select at least one review that is not already planned.'; return; }
        const attemptId = transfer.attemptId;
        saving = true;
        refresh();
        save(data => {
            selected.forEach(review => {
                if (studyHubReviews.alreadyPlanned(data, review.id)) return;
                const details = studyHubReviews.describe(review);
                editDay(data, date).tasks.push({
                    id: createId(), text: details.title, completed: false,
                    note: details.subject + '. ' + details.reason + ' Based only on a short StudyHub demo test.',
                    isDeadline: false,
                    source: { type: 'practice-review', id: review.id, attemptId }
                });
            });
        }, () => {
            saving = false;
            onAdded(date);
            clearTransfer('Selected review tasks were saved.');
        });
    });
    refresh();
    return { refresh };
}
