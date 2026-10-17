// Selection and scoring are independent of the DOM and do not persist any data.
function getPracticeQuestions(selection) {
    return practiceQuestionBank.questions.filter(question =>
        question.subject === selection.subject &&
        (selection.topic === 'all' || question.topic === selection.topic) &&
        question.difficulty === selection.difficulty
    );
}

function calculatePracticeResult(questions, answers, selection) {
    let correct = 0;
    let incorrect = 0;
    let blank = 0;
    questions.forEach((question, index) => {
        if (answers[index] === null || answers[index] === undefined) blank++;
        else if (answers[index] === question.correctIndex) correct++;
        else incorrect++;
    });
    return {
        subject: selection.subject,
        subjectName: selection.subjectName,
        topic: selection.topic,
        topicName: selection.topicName,
        difficulty: selection.difficulty,
        total: questions.length,
        correct,
        incorrect,
        blank,
        percentage: questions.length ? Math.round(correct / questions.length * 100) : 0
    };
}

function initPracticeHub() {
    const form = document.getElementById('practice-form');
    if (!form) return;

    const subjectInput = document.getElementById('practice-subject');
    const topicInput = document.getElementById('practice-topic');
    const difficultyInput = document.getElementById('practice-difficulty');
    const countInput = document.getElementById('practice-count');
    const error = document.getElementById('practice-error');
    const availability = document.getElementById('practice-availability');
    const setup = document.getElementById('practice-setup');
    const session = document.getElementById('practice-session');
    const results = document.getElementById('practice-results');
    const questionTitle = document.getElementById('question-title');
    const options = document.getElementById('answer-options');
    const previous = document.getElementById('previous-question');
    const next = document.getElementById('next-question');
    const clear = document.getElementById('clear-answer');
    let selectedQuestions = [];
    let answers = [];
    let currentIndex = 0;
    let selection = null;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function addOption(select, value, text) {
        const option = element('option', '', text);
        option.value = value;
        select.appendChild(option);
    }

    function readSelection() {
        const subject = practiceQuestionBank.subjects.find(item => item.id === subjectInput.value);
        const topic = subject?.topics.find(item => item.id === topicInput.value);
        if (!subject || (topicInput.value !== 'all' && !topic) ||
            !['easy', 'medium', 'hard'].includes(difficultyInput.value)) return null;
        return {
            subject: subject.id,
            subjectName: subject.name,
            topic: topic ? topic.id : 'all',
            topicName: topic ? topic.name : 'All topics',
            difficulty: difficultyInput.value,
            count: Number(countInput.value)
        };
    }

    function updateAvailability() {
        error.textContent = '';
        countInput.removeAttribute('aria-invalid');
        const requested = readSelection();
        const count = requested ? getPracticeQuestions(requested).length : 0;
        availability.textContent = `${count} demo ${count === 1 ? 'question is' : 'questions are'} available for this selection. No new questions are generated.`;
    }

    function updateTopics() {
        topicInput.replaceChildren();
        addOption(topicInput, 'all', 'All topics');
        const subject = practiceQuestionBank.subjects.find(item => item.id === subjectInput.value);
        subject?.topics.forEach(topic => addOption(topicInput, topic.id, topic.name));
        topicInput.value = 'all';
        updateAvailability();
    }

    function showView(view) {
        setup.hidden = view !== 'setup';
        session.hidden = view !== 'session';
        results.hidden = view !== 'results';
    }

    function renderProgress() {
        const count = answers.filter(answer => answer !== null).length;
        const progress = document.getElementById('practice-progress');
        progress.max = selectedQuestions.length;
        progress.value = count;
        document.getElementById('practice-answered').textContent = `${count} of ${selectedQuestions.length} answered`;
        clear.disabled = answers[currentIndex] === null;
    }

    function topicName(question) {
        return practiceQuestionBank.subjects.find(subject => subject.id === question.subject)
            .topics.find(topic => topic.id === question.topic).name;
    }

    function renderQuestion() {
        const question = selectedQuestions[currentIndex];
        document.getElementById('question-counter').textContent = `QUESTION ${currentIndex + 1} OF ${selectedQuestions.length}`;
        document.getElementById('question-topic').textContent = topicName(question);
        questionTitle.textContent = question.text;
        options.replaceChildren(element('legend', '', 'Choose one answer'));
        question.options.forEach((text, index) => {
            const label = element('label', 'practice-option');
            const radio = element('input');
            radio.type = 'radio';
            radio.name = 'practice-answer';
            radio.value = String(index);
            radio.checked = answers[currentIndex] === index;
            label.appendChild(radio);
            label.appendChild(element('span', 'practice-option-letter', String.fromCharCode(65 + index)));
            label.appendChild(element('span', 'practice-option-text', text));
            options.appendChild(label);
        });
        previous.disabled = currentIndex === 0;
        next.disabled = currentIndex === selectedQuestions.length - 1;
        renderProgress();
        questionTitle.focus();
    }

    function startSession() {
        answers = selectedQuestions.map(() => null);
        currentIndex = 0;
        const settings = document.getElementById('session-settings');
        settings.replaceChildren();
        [['Subject', selection.subjectName], ['Topic', selection.topicName], ['Difficulty', selection.difficulty]].forEach(([label, value]) => {
            const row = element('div');
            row.appendChild(element('dt', '', label));
            row.appendChild(element('dd', '', value));
            settings.appendChild(row);
        });
        document.getElementById('practice-review').replaceChildren();
        showView('session');
        renderQuestion();
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        const requested = readSelection();
        if (!requested) {
            error.textContent = 'Choose a valid subject, topic and difficulty.';
            return;
        }
        if (!Number.isInteger(requested.count) || requested.count < 1 || requested.count > practiceQuestionBank.questions.length) {
            error.textContent = `Choose a whole number from 1 to ${practiceQuestionBank.questions.length}.`;
            countInput.setAttribute('aria-invalid', 'true');
            countInput.focus();
            return;
        }
        const matches = getPracticeQuestions(requested);
        if (matches.length < requested.count) {
            error.textContent = `Only ${matches.length} demo ${matches.length === 1 ? 'question matches' : 'questions match'} this selection. Choose fewer questions or broaden your topic. No questions will be generated.`;
            countInput.setAttribute('aria-invalid', 'true');
            countInput.focus();
            return;
        }
        // Shuffle a copy of the available pool. Never duplicate or create questions.
        for (let i = matches.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [matches[i], matches[j]] = [matches[j], matches[i]];
        }
        selection = requested;
        selectedQuestions = matches.slice(0, requested.count);
        startSession();
    });

    options.addEventListener('change', event => {
        const index = Number(event.target.value);
        if (event.target.name !== 'practice-answer' || !Number.isInteger(index) ||
            index < 0 || index >= selectedQuestions[currentIndex].options.length) return;
        answers[currentIndex] = index;
        renderProgress();
    });
    document.getElementById('practice-answer-form').addEventListener('submit', event => event.preventDefault());
    previous.addEventListener('click', () => {
        if (currentIndex > 0) { currentIndex--; renderQuestion(); }
    });
    next.addEventListener('click', () => {
        if (currentIndex < selectedQuestions.length - 1) { currentIndex++; renderQuestion(); }
    });
    clear.addEventListener('click', () => {
        answers[currentIndex] = null;
        renderQuestion();
    });

    document.getElementById('finish-practice').addEventListener('click', () => {
        const result = calculatePracticeResult(selectedQuestions, answers, selection);
        document.getElementById('score-correct').textContent = result.correct;
        document.getElementById('score-incorrect').textContent = result.incorrect;
        document.getElementById('score-blank').textContent = result.blank;
        document.getElementById('score-percentage').textContent = `${result.percentage}%`;
        document.getElementById('results-context').textContent = `${result.subjectName} · ${result.topicName} · ${result.difficulty} · ${result.total} questions`;
        const review = document.getElementById('practice-review');
        review.replaceChildren();
        selectedQuestions.forEach((question, index) => {
            const answer = answers[index];
            const status = answer === null ? 'Blank' : answer === question.correctIndex ? 'Correct' : 'Incorrect';
            const item = element('li', `practice-review-item is-${status.toLowerCase()}`);
            const article = element('article');
            const heading = element('div', 'practice-review-top');
            heading.appendChild(element('p', 'practice-kicker', `QUESTION ${index + 1} · ${topicName(question)}`));
            heading.appendChild(element('span', 'practice-answer-status', status));
            article.appendChild(heading);
            article.appendChild(element('h3', '', question.text));
            const details = element('dl', 'practice-review-answers');
            const formatAnswer = option => `${String.fromCharCode(65 + option)}. ${question.options[option]}`;
            [['Your answer', answer === null ? 'Not answered' : formatAnswer(answer)],
                ['Correct answer', formatAnswer(question.correctIndex)]].forEach(([label, value]) => {
                const row = element('div');
                row.appendChild(element('dt', '', label));
                row.appendChild(element('dd', '', value));
                details.appendChild(row);
            });
            article.appendChild(details);
            const explanation = element('div', 'practice-explanation');
            explanation.appendChild(element('h4', '', 'Why this is correct'));
            explanation.appendChild(element('p', '', question.explanation));
            article.appendChild(explanation);
            item.appendChild(article);
            review.appendChild(item);
        });
        showView('results');
        document.getElementById('results-title').focus();
    });

    document.getElementById('restart-practice').addEventListener('click', startSession);
    document.getElementById('new-practice').addEventListener('click', () => {
        selectedQuestions = [];
        answers = [];
        selection = null;
        document.getElementById('practice-review').replaceChildren();
        showView('setup');
        updateAvailability();
        document.getElementById('setup-title').focus();
    });
    subjectInput.addEventListener('change', updateTopics);
    topicInput.addEventListener('change', updateAvailability);
    difficultyInput.addEventListener('change', updateAvailability);
    countInput.addEventListener('input', updateAvailability);
    subjectInput.replaceChildren();
    practiceQuestionBank.subjects.forEach(subject => addOption(subjectInput, subject.id, subject.name));
    subjectInput.value = practiceQuestionBank.subjects[0].id;
    countInput.max = String(practiceQuestionBank.questions.length);
    document.getElementById('practice-bank-size').textContent = practiceQuestionBank.questions.length;
    updateTopics();
    document.getElementById('practice-start').disabled = false;
}

document.addEventListener('DOMContentLoaded', initPracticeHub);
