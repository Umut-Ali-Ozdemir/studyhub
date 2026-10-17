const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'planner.html'), 'utf8');
const date = '2026-10-17';
const fixtureTask = (overrides = {}) => ({
    id: 123, text: 'Review derivatives', completed: false, note: 'Keep this note', isDeadline: true, ...overrides
});
const record = (tasks = [fixtureTask()], generalNote = 'Keep this day note') =>
    JSON.stringify({ [date]: { generalNote, tasks } });

// This DOM substitute tests data and event behavior, not browser layout/download UI.
class Element {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.events = {};
        this.attributes = {};
        this.style = {};
        this.type = tag === 'input' ? 'text' : '';
        this.value = '';
        this.disabled = false;
        this.hidden = false;
        this.checked = false;
        this.className = '';
        this.scrollTop = 0;
        this.scrollHeight = 0; // Geometry is supplied explicitly in scroll-state tests.
        this.classList = {
            add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' ').trim(); },
            remove: name => { this.className = this.className.split(' ').filter(item => item !== name).join(' '); }
        };
    }
    set textContent(value) { this.text = String(value); this.children = []; }
    set value(value) {
        // Native single-line inputs normalize line breaks; textareas do not.
        this.inputValue = this.tagName === 'INPUT' && this.type === 'text'
            ? String(value).replace(/[\r\n]/g, '') : value;
    }
    get value() { return this.inputValue; }
    get textContent() { return this.text ?? this.children.map(child => child.textContent).join(' '); }
    set innerHTML(value) {
        // User text must never enter an HTML sink.
        assert.ok(!String(value).includes('INJECTION_MARKER'), 'User text entered an HTML sink');
        this.html = String(value); this.children = [];
    }
    get innerHTML() { return this.html || ''; }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    replaceChildren(...children) { this.text = undefined; this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    focus() { this.focused = true; }
    addEventListener(name, handler) { this.events[name] = handler; }
    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }
    querySelectorAll(selector) {
        const found = [];
        const matches = node => selector.startsWith('.')
            ? node.className.split(' ').includes(selector.slice(1))
            : node.tagName === selector.toUpperCase();
        function visit(node) {
            for (const child of node.children) { if (matches(child)) found.push(child); visit(child); }
        }
        visit(this);
        return found;
    }
    fire(name, extra = {}) { this.events[name]?.({ target: this, preventDefault() {}, ...extra }); }
    click() { this.fire('click'); }
    remove() {
        this.removed = true;
        if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    }
}

function boot(initial = null, faults = {}, today = '2026-10-17') {
    const nodes = {};
    for (const match of html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
        const node = new Element(match[1]);
        node.hidden = /\bhidden\b/.test(match[0]);
        node.type = match[0].match(/\btype="([^"]+)"/)?.[1] || node.type;
        nodes[match[2]] = node;
    }
    const close = new Element('span');
    const body = new Element('body');
    const writes = [];
    const blobs = [];
    let stored = initial;
    class FixedDate extends Date {
        constructor(...args) { super(...(args.length ? args : [today + 'T12:00:00+03:00'])); }
        static now() { return 1000; }
    }
    const context = vm.createContext({
        Date: FixedDate,
        // Force a repeated UUID as well as a frozen clock to exercise collision defenses.
        crypto: { randomUUID: () => 'repeated-uuid' },
        document: {
            body,
            getElementById: id => nodes[id] || null,
            createElement: tag => new Element(tag),
            querySelector: selector => selector === '.close-modal' ? close : null,
            querySelectorAll: () => [nodes['new-task-input'], nodes['new-task-deadline'], nodes['day-general-note'],
                ...nodes['task-list'].querySelectorAll('input'), ...nodes['task-list'].querySelectorAll('button')],
            addEventListener() {}
        },
        window: { addEventListener() {} },
        localStorage: {
            getItem(key) { assert.equal(key, 'studyHubPlannerData'); if (faults.read) throw new Error('Blocked'); return stored; },
            setItem(key, value) {
                assert.equal(key, 'studyHubPlannerData');
                if (faults.write) throw new Error('Quota exceeded');
                stored = value; writes.push(value);
            },
            removeItem() { throw new Error('Saved data must never be deleted'); },
            clear() { throw new Error('Storage must never be cleared'); }
        },
        Blob: class { constructor(parts) { blobs.push(parts.join('')); } },
        URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
        setTimeout: callback => callback()
    });
    vm.runInContext(script, context);
    vm.runInContext('initStudyPlanner()', context);
    const days = () => nodes['calendar-grid'].children.filter(node => !node.className.split(' ').includes('empty'));
    const open = (day = 17) => days()[day - 1].click();
    const add = text => { nodes['new-task-input'].value = text; nodes['add-task-form'].fire('submit'); };
    return { nodes, context, writes, blobs, faults, days, open, add, stored: () => stored, externalWrite: value => { stored = value; } };
}

test('opens valid legacy data without rewriting it; numeric IDs still complete and delete', () => {
    const raw = record([fixtureTask(), fixtureTask({ id: 456, text: 'Second task' })]);
    const app = boot(raw);
    assert.equal(app.stored(), raw); assert.equal(app.writes.length, 0);
    app.open();
    assert.equal(app.nodes['day-general-note'].value, 'Keep this day note');
    assert.equal(app.nodes['task-list'].children.length, 2);
    const checkbox = app.nodes['task-list'].children[0].querySelector('.task-checkbox');
    checkbox.checked = true; checkbox.fire('change');
    assert.equal(JSON.parse(app.stored())[date].tasks[0].completed, true);
    assert.equal(JSON.parse(app.stored())[date].tasks[0].id, 123);
    app.nodes['task-list'].children[0].querySelector('.btn-delete-task').click();
    assert.equal(JSON.parse(app.stored())[date].tasks.length, 1);
    assert.equal(JSON.parse(app.stored())[date].tasks[0].id, 456);
});

test('legacy optional fields default only in memory and unknown metadata survives saving', () => {
    const raw = JSON.stringify({ [date]: { tasks: [{ id: 5, text: 'Legacy', completed: false, source: { custom: 'keep' } }], customDay: 'keep' } });
    const app = boot(raw); app.open();
    assert.equal(app.stored(), raw);
    app.add('New task');
    const day = JSON.parse(app.stored())[date];
    assert.equal(day.generalNote, ''); assert.equal(day.tasks[0].note, '');
    assert.equal(day.tasks[0].isDeadline, false); assert.equal(day.tasks[0].source.custom, 'keep');
    assert.equal(day.customDay, 'keep');
});

test('invalid JSON, roots, dates, days and task fields preserve raw records and block edits', () => {
    const invalid = ['{', '', 'null', '[]', 'false', '0', '"text"',
        JSON.stringify({ [date]: {} }), JSON.stringify({ [date]: { generalNote: 7, tasks: [] } }),
        JSON.stringify({ '2026-02-30': { tasks: [] } }), JSON.stringify({ '__invalid__': { tasks: [] } }),
        record([null]), record([{}]), record([fixtureTask({ id: null })]), record([fixtureTask({ text: 7 })]),
        record([fixtureTask({ text: '' })]), record([fixtureTask({ completed: 'false' })]),
        record([fixtureTask({ completed: undefined })]), record([fixtureTask({ note: [] })]),
        record([fixtureTask({ isDeadline: 'true' })]), record([fixtureTask(), fixtureTask()])];
    for (const raw of invalid) {
        const app = boot(raw);
        assert.equal(app.stored(), raw); assert.equal(app.writes.length, 0);
        assert.equal(app.nodes['planner-storage-notice'].hidden, false);
        assert.equal(app.nodes['prev-month'].disabled, true);
        assert.equal(app.nodes['next-month'].disabled, true);
        assert.equal(app.nodes['planner-retry-save'].hidden, true);
        app.nodes['planner-export-raw'].click();
        assert.equal(app.blobs[0], raw, 'Raw download must preserve every byte');
        app.nodes['add-task-form'].fire('submit');
        assert.equal(app.stored(), raw);
    }
});

test('missing storage starts empty, while blocked storage never becomes a writable empty planner', () => {
    const fresh = boot(null); fresh.open(); fresh.add('First task');
    assert.equal(JSON.parse(fresh.stored())[date].tasks.length, 1);
    const blocked = boot(record(), { read: true });
    assert.equal(blocked.writes.length, 0);
    assert.equal(blocked.nodes['planner-export-raw'].disabled, true);
    assert.equal(blocked.nodes['planner-storage-notice'].hidden, false);
});

test('HTML in titles, notes, daily notes and deadline cards stays literal text', () => {
    const hostile = '<img src=x onerror="INJECTION_MARKER"><script>INJECTION_MARKER</script>';
    const app = boot(record([fixtureTask({ text: hostile, note: hostile })], hostile)); app.open();
    const task = app.nodes['task-list'].children[0];
    assert.equal(task.querySelector('.task-text').textContent, hostile);
    assert.equal(task.querySelector('.task-note-input').value, hostile);
    assert.equal(app.nodes['day-general-note'].value, hostile);
    assert.equal(app.nodes['alerts-container'].children[0].querySelector('.alert-title').textContent, hostile);
    const note = task.querySelector('.task-note-input');
    note.value = hostile + ' updated'; note.fire('change');
    assert.equal(JSON.parse(app.stored())[date].tasks[0].note, hostile + ' updated');
});

test('new IDs remain unique under the same timestamp and repeated UUID, including reload', () => {
    const app = boot('{}'); app.open(); app.add('First'); app.add('Second');
    let tasks = JSON.parse(app.stored())[date].tasks;
    assert.equal(new Set(tasks.map(task => task.id)).size, 2);
    const reloaded = boot(app.stored()); reloaded.open(); reloaded.add('Third');
    tasks = JSON.parse(reloaded.stored())[date].tasks;
    assert.equal(new Set(tasks.map(task => task.id)).size, 3);
    reloaded.nodes['task-list'].children[0].querySelector('.btn-delete-task').click();
    assert.equal(JSON.parse(reloaded.stored())[date].tasks.length, 2);
    const fallback = boot('{}'); vm.runInContext('globalThis.crypto = undefined', fallback.context);
    fallback.open(); fallback.add('First'); fallback.add('Second');
    assert.equal(new Set(JSON.parse(fallback.stored())[date].tasks.map(task => task.id)).size, 2);
});

test('failed writes preserve saved data and typed input; retry commits only once', () => {
    const raw = record(); const faults = { write: true }; const app = boot(raw, faults); app.open();
    app.add('Unsaved task');
    assert.equal(app.stored(), raw); assert.equal(app.writes.length, 0);
    assert.equal(app.nodes['new-task-input'].value, 'Unsaved task');
    assert.equal(app.nodes['task-list'].children.length, 1);
    assert.equal(app.nodes['new-task-input'].readOnly, true);
    assert.equal(app.nodes['planner-day-storage-notice'].hidden, false);
    assert.equal(app.nodes['planner-day-retry-save'].hidden, false);
    assert.ok(app.nodes['planner-save-status'].textContent.includes('Not saved'));
    app.nodes['planner-export-raw'].click(); assert.equal(app.blobs[0], raw);
    faults.write = false; app.nodes['planner-day-retry-save'].click();
    const day = JSON.parse(app.stored())[date];
    assert.equal(day.tasks.length, 2); assert.equal(day.generalNote, 'Keep this day note');
    assert.equal(app.writes.length, 1); assert.equal(app.nodes['new-task-input'].value, '');
    assert.equal(app.nodes['new-task-input'].readOnly, false);
    assert.equal(app.nodes['planner-storage-notice'].hidden, true);
    app.nodes['planner-day-retry-save'].click(); assert.equal(app.writes.length, 1);
});

test('failed completion, deletion and notes do not mutate the committed model', () => {
    for (const action of ['complete', 'delete', 'taskNote', 'dayNote']) {
        const raw = record(); const faults = { write: true }; const app = boot(raw, faults); app.open();
        const row = app.nodes['task-list'].children[0];
        if (action === 'complete') { const input = row.querySelector('.task-checkbox'); input.checked = true; input.fire('change'); assert.equal(input.checked, false); }
        if (action === 'delete') row.querySelector('.btn-delete-task').click();
        if (action === 'taskNote') { const input = row.querySelector('.task-note-input'); input.value = 'New task note'; input.fire('change'); assert.equal(input.value, 'New task note'); }
        if (action === 'dayNote') { app.nodes['day-general-note'].value = 'New day note'; app.nodes['day-general-note'].fire('change'); }
        assert.equal(app.stored(), raw); assert.equal(app.nodes['task-list'].children.length, 1);
        faults.write = false; app.nodes['planner-retry-save'].click();
        const day = JSON.parse(app.stored())[date];
        if (action === 'complete') assert.equal(day.tasks[0].completed, true);
        if (action === 'delete') assert.equal(day.tasks.length, 0);
        if (action === 'taskNote') assert.equal(day.tasks[0].note, 'New task note');
        if (action === 'dayNote') assert.equal(day.generalNote, 'New day note');
    }
});

test('read failure during save and an externally changed record never overwrite saved data', () => {
    const raw = record(); const faults = {}; const app = boot(raw, faults); app.open();
    faults.read = true; app.add('Pending'); assert.equal(app.stored(), raw);
    faults.read = false; const external = record([fixtureTask({ text: 'Changed elsewhere' })]);
    app.externalWrite(external); app.nodes['planner-retry-save'].click();
    assert.equal(app.stored(), external); assert.equal(app.writes.length, 0);
    assert.equal(app.nodes['planner-retry-save'].hidden, true);
    app.nodes['planner-export-raw'].click(); assert.equal(app.blobs[0], external);
});

test('calendar, deadlines, notes, completion markers and monthly summary still update', () => {
    const raw = JSON.stringify({
        [date]: { generalNote: 'Today note', tasks: [fixtureTask(), fixtureTask({ id: 456, completed: true })] },
        '2026-10-21': { tasks: [fixtureTask({ id: 789 })] }
    });
    const app = boot(raw); assert.equal(app.days().length, 31);
    assert.ok(app.days()[16].className.includes('deadline-urgent'));
    assert.ok(app.days()[20].className.includes('deadline-near'));
    assert.ok(app.days()[16].querySelector('.day-note-icon'));
    assert.equal(app.nodes['alerts-container'].children.length, 2);
    app.open(); assert.equal(app.nodes['stat-total'].textContent, '2');
    const checkbox = app.nodes['task-list'].children[0].querySelector('.task-checkbox');
    checkbox.checked = true; checkbox.fire('change');
    assert.ok(app.days()[16].querySelector('.completed-all'));
    assert.equal(app.nodes['alerts-container'].children.length, 1);
    assert.equal(app.nodes['month-rate'].textContent, '67%');
    assert.equal(app.nodes['month-total'].textContent, '3');
    assert.equal(app.nodes['month-completed'].textContent, '2');
    assert.equal(app.nodes['month-remaining'].textContent, '1');
    app.nodes['next-month'].click(); assert.equal(app.days().length, 30);
    app.nodes['prev-month'].click(); assert.equal(app.days().length, 31);
});

test('dashboard opens today, exposes English accessible dates and handles empty states without saving', () => {
    const app = boot('{}');
    const selected = app.days()[16];
    assert.equal(selected.tagName, 'BUTTON');
    assert.equal(selected.type, 'button');
    assert.equal(selected.attributes['aria-pressed'], 'true');
    assert.equal(selected.attributes['aria-current'], 'date');
    assert.equal(selected.attributes['aria-controls'], 'daily-panel');
    assert.equal(selected.tabIndex, 0);
    assert.match(selected.attributes['aria-label'], /October 17, 2026/);
    assert.equal(app.nodes['selected-date-title'].textContent, 'October 17, 2026');
    assert.equal(app.nodes['month-year'].textContent, 'October 2026');
    assert.equal(app.nodes['tasks-empty'].hidden, false);
    assert.equal(app.nodes['deadlines-empty'].hidden, false);
    assert.equal(app.nodes['month-total'].textContent, '0');
    assert.equal(app.nodes['month-rate'].textContent, '0%');
    assert.match(app.nodes['monthly-summary'].textContent, /No tasks planned/);
    assert.equal(app.writes.length, 0);
});

test('arrow keys select dates across months and years without changing stored tasks', () => {
    const raw = record(); const app = boot(raw);
    app.days()[16].fire('keydown', { key: 'ArrowDown' });
    assert.equal(app.nodes['selected-date-title'].textContent, 'October 24, 2026');
    assert.equal(app.days()[23].focused, true);
    app.days()[23].fire('keydown', { key: 'ArrowUp' });
    assert.equal(app.nodes['selected-date-title'].textContent, 'October 17, 2026');
    app.open(31); app.days()[30].fire('keydown', { key: 'ArrowRight' });
    assert.equal(app.nodes['selected-date-title'].textContent, 'November 1, 2026');
    assert.equal(app.nodes['month-total'].textContent, '0');
    app.days()[0].fire('keydown', { key: 'ArrowLeft' });
    assert.equal(app.nodes['month-total'].textContent, '1');
    app.nodes['next-month'].click();
    assert.equal(app.nodes['selected-date-title'].textContent, 'November 30, 2026');
    app.nodes['next-month'].click(); app.open(31);
    app.days()[30].fire('keydown', { key: 'ArrowRight' });
    assert.equal(app.nodes['selected-date-title'].textContent, 'January 1, 2027');
    assert.equal(app.stored(), raw); assert.equal(app.writes.length, 0);
});

test('failed save locks date navigation and retains the pending note until retry', () => {
    const faults = { write: true }; const raw = record(); const app = boot(raw, faults);
    app.nodes['day-general-note'].value = 'Pending daily note';
    app.nodes['day-general-note'].fire('change');
    assert.equal(app.nodes['next-month'].disabled, true);
    assert.equal(app.days()[16].disabled, true);
    app.nodes['next-month'].click(); app.open(18);
    app.days()[16].fire('keydown', { key: 'ArrowRight' });
    assert.equal(app.nodes['selected-date-title'].textContent, 'October 17, 2026');
    assert.equal(app.nodes['day-general-note'].value, 'Pending daily note');
    assert.equal(app.nodes['month-total'].textContent, '1');
    assert.equal(app.stored(), raw);
    faults.write = false; app.nodes['planner-day-retry-save'].click();
    assert.equal(app.nodes['next-month'].disabled, false);
    assert.equal(app.days()[16].disabled, false);
    assert.equal(JSON.parse(app.stored())[date].generalNote, 'Pending daily note');
});

test('deadlines are ordered by urgency, exclude completed and distant tasks, and show an empty state', () => {
    const app = boot(JSON.stringify({
        '2026-10-22': { tasks: [fixtureTask({ id: 1, text: 'Five days away' })] },
        '2026-10-18': { tasks: [fixtureTask({ id: 2, text: 'Tomorrow' })] },
        [date]: { tasks: [fixtureTask({ id: 3, text: 'Today' }), fixtureTask({ id: 4, completed: true })] },
        '2026-10-23': { tasks: [fixtureTask({ id: 5 })] },
        '2026-10-16': { tasks: [fixtureTask({ id: 6 })] }
    }));
    const cards = app.nodes['alerts-container'].children;
    assert.deepEqual(cards.map(card => card.querySelector('.alert-title').textContent), ['Today', 'Tomorrow', 'Five days away']);
    assert.match(cards[0].className, /urgent/);
    assert.ok(!cards[2].className.includes('urgent'));
    assert.match(cards[0].querySelector('.alert-time').textContent, /Due today/);
    assert.equal(app.nodes['deadlines-empty'].hidden, true);
    const empty = boot(record([fixtureTask({ completed: true })]));
    assert.equal(empty.nodes['deadlines-empty'].hidden, false);
    assert.equal(empty.nodes['month-rate'].textContent, '100%');
    assert.match(empty.nodes['monthly-summary'].textContent, /Every planned task is complete/);
});

test('saving task notes keeps the task controls in place for subsequent clicks', () => {
    const app = boot(record());
    const row = app.nodes['task-list'].children[0];
    const note = row.querySelector('.task-note-input');
    note.value = 'Updated note'; note.fire('change');
    assert.equal(app.nodes['task-list'].children[0], row);
    assert.equal(JSON.parse(app.stored())[date].tasks[0].note, 'Updated note');
    const checkbox = row.querySelector('.task-checkbox');
    checkbox.checked = true; checkbox.fire('change');
    assert.equal(app.nodes['task-list'].children[0].querySelector('.task-checkbox').focused, true);
});

test('saving daily notes updates the marker without replacing a date button awaiting a click', () => {
    const app = boot(record());
    const selected = app.days()[16]; const nextDay = app.days()[17];
    app.nodes['day-general-note'].value = '';
    app.nodes['day-general-note'].fire('change');
    assert.equal(app.days()[16], selected);
    assert.equal(app.days()[17], nextDay);
    assert.equal(selected.querySelector('.day-note-icon'), null);
    assert.ok(!selected.attributes['aria-label'].includes('daily note'));
    app.nodes['day-general-note'].value = 'New reflection';
    app.nodes['day-general-note'].fire('change');
    assert.ok(selected.querySelector('.day-note-icon'));
    assert.match(selected.attributes['aria-label'], /daily note/);
    nextDay.click();
    assert.equal(app.nodes['selected-date-title'].textContent, 'October 18, 2026');
    assert.equal(JSON.parse(app.stored())[date].generalNote, 'New reflection');
});

test('task notes start collapsed, expand one at a time and preserve legacy notes without writing', () => {
    const raw = record([fixtureTask(), fixtureTask({ id: 'second', text: 'Second task', note: '' })]);
    const app = boot(raw);
    const [first, second] = app.nodes['task-list'].children;
    const firstToggle = first.querySelector('.task-note-toggle');
    const secondToggle = second.querySelector('.task-note-toggle');
    const firstPanel = first.querySelector('.task-note-editor');
    const secondPanel = second.querySelector('.task-note-editor');
    assert.equal(firstPanel.hidden, true); assert.equal(secondPanel.hidden, true);
    assert.match(firstToggle.className, /has-note/);
    assert.ok(!secondToggle.className.includes('has-note'));
    assert.equal(firstToggle.attributes['aria-controls'], firstPanel.id);
    firstToggle.click();
    assert.equal(firstPanel.hidden, false);
    assert.equal(firstToggle.attributes['aria-expanded'], 'true');
    assert.equal(first.querySelector('.task-note-input').focused, true);
    secondToggle.click();
    assert.equal(firstPanel.hidden, true); assert.equal(secondPanel.hidden, false);
    assert.equal(firstToggle.attributes['aria-expanded'], 'false');
    secondToggle.click();
    assert.equal(secondPanel.hidden, true); assert.equal(secondToggle.focused, true);
    firstToggle.click();
    assert.equal(first.querySelector('.task-note-input').value, 'Keep this note');
    assert.equal(app.stored(), raw); assert.equal(app.writes.length, 0);
});

test('closing a dirty note saves it and updates its indicator; reopening and reload keep the note', () => {
    const app = boot(record([fixtureTask({ note: '' })]));
    const row = app.nodes['task-list'].children[0];
    const toggle = row.querySelector('.task-note-toggle');
    const input = row.querySelector('.task-note-input');
    toggle.click(); input.value = 'Keep <literal> text';
    toggle.click(); // Exercise activation without a browser blur event.
    assert.equal(row.querySelector('.task-note-editor').hidden, true);
    assert.match(toggle.className, /has-note/);
    assert.equal(JSON.parse(app.stored())[date].tasks[0].note, 'Keep <literal> text');
    toggle.click(); assert.equal(input.value, 'Keep <literal> text');
    input.value = ''; input.fire('change');
    assert.ok(!toggle.className.includes('has-note'));
    assert.equal(app.nodes['task-list'].children[0], row);
    input.value = 'Restored note'; input.fire('change');
    const reloaded = boot(app.stored());
    assert.equal(reloaded.nodes['task-list'].children[0].querySelector('.task-note-input').value, 'Restored note');
    assert.equal(reloaded.nodes['task-list'].children[0].querySelector('.task-note-editor').hidden, true);
});

test('opening and closing a legacy multiline note never rewrites the original saved string', () => {
    const raw = record([fixtureTask({ note: 'First line\r\nSecond line' })]);
    const app = boot(raw);
    const toggle = app.nodes['task-list'].children[0].querySelector('.task-note-toggle');
    toggle.click(); toggle.click(); toggle.click(); toggle.click();
    assert.equal(app.stored(), raw); assert.equal(app.writes.length, 0);
});

test('a failed note switch keeps the draft visible and raw data intact until retry succeeds', () => {
    const raw = record([fixtureTask(), fixtureTask({ id: 456 })]);
    const faults = { write: true }; const app = boot(raw, faults);
    const [first, second] = app.nodes['task-list'].children;
    first.querySelector('.task-note-toggle').click();
    first.querySelector('.task-note-input').value = 'Pending note';
    second.querySelector('.task-note-toggle').click();
    assert.equal(first.querySelector('.task-note-editor').hidden, false);
    assert.equal(second.querySelector('.task-note-editor').hidden, true);
    assert.equal(first.querySelector('.task-note-input').value, 'Pending note');
    assert.equal(first.querySelector('.task-note-input').readOnly, true);
    assert.equal(second.querySelector('.task-note-toggle').disabled, true);
    assert.equal(app.stored(), raw);
    faults.write = false; app.nodes['planner-retry-save'].click();
    assert.equal(first.querySelector('.task-note-editor').hidden, true);
    assert.equal(second.querySelector('.task-note-editor').hidden, false);
    assert.equal(JSON.parse(app.stored())[date].tasks[0].note, 'Pending note');
    assert.equal(app.writes.length, 1);
});

test('completion preserves the open editor and scroll position; deletion and date changes manage focus', () => {
    const app = boot(record([fixtureTask(), fixtureTask({ id: 456 })]));
    const list = app.nodes['task-list'];
    list.children[0].querySelector('.task-note-toggle').click();
    list.scrollTop = 42;
    const checkbox = list.children[0].querySelector('.task-checkbox');
    checkbox.checked = true; checkbox.fire('change');
    assert.equal(list.scrollTop, 42);
    assert.equal(list.children[0].querySelector('.task-note-editor').hidden, false);
    assert.equal(list.children[1].querySelector('.task-note-editor').hidden, true);
    assert.equal(list.children[0].querySelector('.task-checkbox').focused, true);
    list.children[0].querySelector('.btn-delete-task').click();
    assert.equal(list.children[0].querySelector('.task-note-editor').hidden, true);
    assert.equal(list.children[0].querySelector('.task-checkbox').focused, true);
    app.open(18); assert.equal(list.scrollTop, 0); assert.equal(list.hidden, true);
    app.open(); assert.equal(list.children[0].querySelector('.task-note-editor').hidden, true);
    list.children[0].querySelector('.btn-delete-task').click();
    assert.equal(list.hidden, true);
    assert.equal(app.nodes['tasks-empty'].hidden, false);
    assert.equal(app.nodes['new-task-input'].focused, true);
});

test('a long task list remains editable and adding a task reveals the newest entry', () => {
    const tasks = Array.from({ length: 80 }, (_, id) => fixtureTask({ id, text: 'Long title '.repeat(30), note: 'Long note '.repeat(100) }));
    const app = boot(record(tasks));
    const list = app.nodes['task-list'];
    assert.equal(list.children.length, 80); assert.equal(list.hidden, false);
    assert.equal(list.children[0].querySelector('.task-text').title, tasks[0].text);
    list.scrollHeight = 4000; // Verify intent only; actual geometry requires a browser.
    app.add('Newest task');
    assert.equal(list.children.length, 81); assert.equal(list.scrollTop, 4000);
    assert.equal(app.nodes['new-task-input'].focused, true);
    assert.equal(app.nodes['stat-total'].textContent, '81');
    assert.equal(JSON.parse(app.stored())[date].tasks[0].note, tasks[0].note);
});

test('0, 1, 3, 5 and 15 daily tasks preserve calendar structure in four-, five- and six-week months', () => {
    // This checks DOM structure and behavior, not computed browser dimensions.
    for (const [today, weeks, dayCount] of [['2021-02-14', 4, 28], ['2026-10-17', 5, 31], ['2026-03-17', 6, 31]]) {
        let baseline;
        for (const count of [0, 1, 3, 5, 15]) {
            const tasks = Array.from({ length: count }, (_, id) => fixtureTask({ id }));
            const raw = JSON.stringify({ [today]: { generalNote: 'Accessible daily note', tasks } });
            const app = boot(raw, {}, today);
            const calendar = app.nodes['calendar-grid'];
            const structure = calendar.children.map(day => ({
                tag: day.tagName,
                empty: day.className.split(' ').includes('empty'),
                number: day.querySelector('.day-number')?.textContent
            }));
            if (!baseline) baseline = structure;
            assert.deepEqual(structure, baseline, `${today}: calendar structure changed with ${count} tasks`);
            assert.equal(Math.ceil(calendar.children.length / 7), weeks);
            assert.equal(app.days().length, dayCount);
            assert.equal(app.nodes['task-list'].children.length, count);
            assert.equal(app.nodes['task-list'].hidden, count === 0);
            assert.equal(app.nodes['day-general-note'].value, 'Accessible daily note');
            assert.equal(app.nodes['day-general-note'].readOnly, false);
            if (count) {
                const row = app.nodes['task-list'].children[0];
                row.querySelector('.task-note-toggle').click();
                assert.equal(row.querySelector('.task-note-editor').hidden, false);
                row.querySelector('.task-note-toggle').click();
                assert.equal(row.querySelector('.task-note-editor').hidden, true);
            }
            assert.equal(app.stored(), raw); assert.equal(app.writes.length, 0);
        }
    }
});
