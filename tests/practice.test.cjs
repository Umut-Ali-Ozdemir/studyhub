const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// A small DOM substitute exercises user flows; it does not validate browser layout,
// native form constraints, keyboard radio behavior or screen-reader announcements.
class Element {
    constructor(tag = 'div') {
        this.tagName = tag;
        this.children = [];
        this.events = {};
        this.attributes = {};
        this.value = '';
        this.hidden = false;
        this.disabled = false;
    }
    set textContent(value) { this.text = String(value); this.children = []; }
    get textContent() { return this.text ?? this.children.map(child => child.textContent).join(' '); }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.text = undefined; this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, handler) { this.events[name] = handler; }
    focus() { this.focused = true; }
    fire(name, extra = {}) {
        this.events[name]?.({ target: this, preventDefault() {}, ...extra });
    }
}

function boot() {
    const nodes = {};
    for (const match of read('exams.html').matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
        nodes[match[2]] = new Element(match[1]);
        nodes[match[2]].hidden = /\bhidden\b/.test(match[0]);
    }
    nodes['practice-difficulty'].value = 'medium';
    nodes['practice-count'].value = '4';
    const context = vm.createContext({
        document: {
            getElementById: id => nodes[id] || null,
            createElement: tag => new Element(tag),
            addEventListener() {}
        },
        localStorage: {
            getItem() { throw new Error('Practice must not read browser storage'); },
            setItem() { throw new Error('Practice must not write browser storage'); },
            removeItem() { throw new Error('Practice must not remove browser storage'); }
        },
        fetch() { throw new Error('Practice must not make network requests'); }
    });
    vm.runInContext(read('practice-questions.js'), context);
    vm.runInContext(read('practice.js'), context);
    vm.runInContext('initPracticeHub()', context);
    const bank = vm.runInContext('practiceQuestionBank', context);
    function currentQuestion() {
        return bank.questions.find(question => question.text === nodes['question-title'].textContent);
    }
    function choose(index) {
        const radios = nodes['answer-options'].children.slice(1).map(label => label.children[0]);
        radios.forEach((radio, position) => { radio.checked = position === index; });
        nodes['answer-options'].fire('change', { target: radios[index] });
    }
    return { nodes, context, bank, choose, currentQuestion };
}

test('bank has 36 unique questions and a complete, bounded pool', () => {
    const { bank, context } = boot();
    assert.equal(bank.questions.length, 36);
    assert.equal(new Set(bank.questions.map(question => question.id)).size, 36);
    for (const subject of bank.subjects) {
        for (const topic of ['all', ...subject.topics.map(item => item.id)]) {
            for (const difficulty of ['easy', 'medium', 'hard']) {
                context.filter = { subject: subject.id, topic, difficulty };
                const pool = vm.runInContext('getPracticeQuestions(filter)', context);
                assert.equal(pool.length, topic === 'all' ? 4 : 2);
                assert.equal(new Set(pool.map(question => question.id)).size, pool.length);
            }
        }
    }
    for (const question of bank.questions) {
        assert.equal(question.options.length, 4);
        assert.equal(new Set(question.options).size, 4);
        assert.ok(Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < 4);
        assert.ok(question.explanation.length > 30);
        assert.ok(bank.subjects.find(subject => subject.id === question.subject).topics.some(topic => topic.id === question.topic));
    }
});

test('answer keys agree with independently checked calculations and definitions', () => {
    const { bank } = boot();
    const expected = {
        'alg-e1': String((20 - 5) / 3), 'alg-e2': String(2 * 4 - 1),
        'alg-m1': '2 and 3', 'alg-m2': String((7 + 1) / 2),
        'alg-h1': 'x < -2 or x > 1', 'alg-h2': '4 only',
        'der-e1': '3x²', 'der-e2': '7', 'der-m1': '6(2x + 1)²',
        'der-m2': '3e', 'der-h1': '2', 'der-h2': '(-1, 2)',
        'algo-e1': 'Queue', 'algo-e2': 'n', 'algo-m1': 'n(n + 1) / 2',
        'algo-m2': 'O(log n)', 'algo-h1': 'Θ(n log n)', 'algo-h2': 'O(V + E)',
        'bin-e1': String(parseInt('1010', 2)), 'bin-e2': (5).toString(2),
        'bin-m1': (parseInt('1011', 2) + parseInt('0110', 2)).toString(2) + '₂',
        'bin-m2': String(2 ** 8 - 1), 'bin-h1': String(parseInt('11110110', 2) - 256),
        'bin-h2': '10000000; yes',
        'mot-e1': `${6 * 5} m`, 'mot-e2': '0 m/s²', 'mot-m1': `${0.5 * 2 * 3 ** 2} m`,
        'mot-m2': `${4 + 3 * 2} m/s`, 'mot-h1': `${20 ** 2 / (2 * 10)} m`,
        'mot-h2': `${12 ** 2 / (2 * 3)} m`,
        'for-e1': `${12 / 3} m/s²`, 'for-e2': `${2 * 10} N`,
        'for-m1': `${(20 - 5) / 5} m/s² rightward`, 'for-m2': `${10 * 3} J`,
        'for-h1': `${4 * (10 + 2)} N`, 'for-h2': `${2 * 6 ** 2 / 3} N`
    };
    assert.equal(Object.keys(expected).length, bank.questions.length);
    for (const question of bank.questions) {
        assert.equal(question.options[question.correctIndex], expected[question.id], question.id);
    }
    // Domain and stationary-point checks supplement the symbolic answer keys.
    assert.equal(4 * (4 - 2), 8);
    assert.equal(3 * (-1) ** 2 - 3, 0);
    assert.ok(6 * -1 < 0);
    assert.equal((-1) ** 3 - 3 * -1, 2);
});

test('scoring counts blanks in the denominator and retains selection metadata', () => {
    const { context, bank } = boot();
    context.questions = bank.questions.slice(0, 3);
    context.selection = { subject: 'math', subjectName: 'Mathematics', topic: 'algebra', topicName: 'Algebra', difficulty: 'easy' };
    context.answers = [context.questions[0].correctIndex, (context.questions[1].correctIndex + 1) % 4, null];
    let result = vm.runInContext('calculatePracticeResult(questions, answers, selection)', context);
    assert.equal(result.correct, 1); assert.equal(result.incorrect, 1); assert.equal(result.blank, 1);
    assert.equal(result.percentage, 33); assert.equal(result.subject, 'math'); assert.equal(result.topic, 'algebra');
    assert.equal(result.correct + result.incorrect + result.blank, result.total);
    context.answers = context.questions.map(question => question.correctIndex);
    assert.equal(vm.runInContext('calculatePracticeResult(questions, answers, selection).percentage', context), 100);
    context.answers = [null, null, null];
    assert.equal(vm.runInContext('calculatePracticeResult(questions, answers, selection).blank', context), 3);
    context.answers = context.questions.map(question => (question.correctIndex + 1) % 4);
    assert.equal(vm.runInContext('calculatePracticeResult(questions, answers, selection).incorrect', context), 3);
    assert.equal(vm.runInContext('calculatePracticeResult([], [], selection).percentage', context), 0);
});

test('complete a test, change and clear answers, review solutions, restart and create a new test', () => {
    const { nodes, choose, currentQuestion } = boot();
    nodes['practice-form'].fire('submit');
    assert.equal(nodes['practice-setup'].hidden, true);
    assert.equal(nodes['practice-session'].hidden, false);
    assert.equal(nodes['previous-question'].disabled, true);
    const first = currentQuestion();
    assert.ok(first);
    choose((first.correctIndex + 1) % 4);
    choose(first.correctIndex);
    nodes['next-question'].fire('click');
    const second = currentQuestion();
    choose((second.correctIndex + 1) % 4);
    nodes['previous-question'].fire('click');
    assert.equal(currentQuestion().id, first.id);
    const restored = nodes['answer-options'].children[first.correctIndex + 1].children[0];
    assert.equal(restored.checked, true);
    nodes['clear-answer'].fire('click');
    assert.equal(nodes['clear-answer'].disabled, true);
    choose(first.correctIndex);
    nodes['next-question'].fire('click');
    nodes['next-question'].fire('click');
    nodes['next-question'].fire('click');
    assert.equal(nodes['next-question'].disabled, true);
    assert.equal(nodes['practice-progress'].value, 2);
    nodes['finish-practice'].fire('click');
    assert.equal(nodes['practice-results'].hidden, false);
    assert.equal(nodes['practice-session'].hidden, true);
    assert.equal(nodes['score-correct'].textContent, '1');
    assert.equal(nodes['score-incorrect'].textContent, '1');
    assert.equal(nodes['score-blank'].textContent, '2');
    assert.equal(nodes['score-percentage'].textContent, '25%');
    assert.equal(nodes['practice-review'].children.length, 4);
    assert.ok(nodes['practice-review'].textContent.includes(first.explanation));
    assert.ok(nodes['practice-review'].textContent.includes(second.explanation));
    assert.ok(nodes['practice-review'].textContent.includes('Not answered'));
    nodes['restart-practice'].fire('click');
    assert.equal(currentQuestion().id, first.id);
    assert.equal(nodes['practice-progress'].value, 0);
    assert.equal(nodes['practice-review'].children.length, 0);
    assert.ok(nodes['answer-options'].children.slice(1).every(label => !label.children[0].checked));
    nodes['finish-practice'].fire('click');
    assert.equal(nodes['score-blank'].textContent, '4');
    assert.equal(nodes['score-percentage'].textContent, '0%');
    nodes['new-practice'].fire('click');
    assert.equal(nodes['practice-setup'].hidden, false);
    assert.equal(nodes['practice-results'].hidden, true);
    assert.equal(nodes['practice-review'].children.length, 0);
});

test('insufficient pools and invalid counts never start an incomplete test', () => {
    const { nodes } = boot();
    nodes['practice-topic'].value = 'algebra';
    nodes['practice-topic'].fire('change');
    assert.ok(nodes['practice-availability'].textContent.startsWith('2 demo questions'));
    nodes['practice-form'].fire('submit');
    assert.ok(nodes['practice-error'].textContent.includes('Only 2 demo questions'));
    assert.equal(nodes['practice-session'].hidden, true);
    for (const count of ['0', '-1', '1.5', '37', '']) {
        nodes['practice-count'].value = count;
        nodes['practice-form'].fire('submit');
        assert.ok(nodes['practice-error'].textContent.includes('whole number'));
        assert.equal(nodes['practice-session'].hidden, true);
    }
    nodes['practice-subject'].value = 'physics';
    nodes['practice-subject'].fire('change');
    assert.equal(nodes['practice-topic'].value, 'all');
    assert.ok(nodes['practice-topic'].children.some(option => option.value === 'forces'));
    assert.ok(!nodes['practice-topic'].children.some(option => option.value === 'algebra'));
    nodes['practice-count'].value = '2';
    nodes['practice-difficulty'].value = 'hard';
    nodes['practice-difficulty'].fire('change');
    nodes['practice-form'].fire('submit');
    assert.equal(nodes['practice-session'].hidden, false);
    assert.equal(nodes['practice-progress'].max, 2);
});

test('single-question boundaries, unique selection and an empty matching pool', () => {
    const { nodes, choose, currentQuestion, bank } = boot();
    const originalIds = bank.questions.map(question => question.id).join(',');
    nodes['practice-form'].fire('submit');
    const seen = new Set();
    for (let index = 0; index < 4; index++) {
        seen.add(currentQuestion().id);
        nodes['next-question'].fire('click');
    }
    assert.equal(seen.size, 4);
    assert.equal(bank.questions.map(question => question.id).join(','), originalIds);
    nodes['finish-practice'].fire('click');
    nodes['new-practice'].fire('click');
    nodes['practice-count'].value = '1';
    nodes['practice-form'].fire('submit');
    assert.equal(nodes['previous-question'].disabled, true);
    assert.equal(nodes['next-question'].disabled, true);
    choose(currentQuestion().correctIndex);
    nodes['finish-practice'].fire('click');
    assert.equal(nodes['score-percentage'].textContent, '100%');
    nodes['new-practice'].fire('click');
    bank.questions = bank.questions.filter(question => question.subject !== 'math');
    nodes['practice-topic'].fire('change');
    assert.ok(nodes['practice-availability'].textContent.startsWith('0 demo questions'));
    nodes['practice-form'].fire('submit');
    assert.ok(nodes['practice-error'].textContent.includes('Only 0 demo questions'));
    assert.equal(nodes['practice-session'].hidden, true);
});
