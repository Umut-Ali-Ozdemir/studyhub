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
        this.classList = {
            add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' ').trim(); },
            remove: name => { this.className = this.className.split(' ').filter(item => item !== name).join(' '); }
        };
    }
    set textContent(value) { this.text = String(value); this.children = []; }
    get textContent() { return this.text ?? this.children.map(child => child.textContent).join(' '); }
    set innerHTML(value) {
        // The untouched monthly summary uses fixed templates. Task/alert text must never enter them.
        assert.ok(!String(value).includes('INJECTION_MARKER'), 'User text entered an HTML sink');
        this.html = String(value); this.children = [];
    }
    get innerHTML() { return this.html || ''; }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.text = undefined; this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
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
    remove() { this.removed = true; }
}

function boot(initial = null, faults = {}) {
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
        constructor(...args) { super(...(args.length ? args : ['2026-10-17T12:00:00+03:00'])); }
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
        assert.equal(app.nodes['btn-ai-analyze'].disabled, true);
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
    assert.equal(app.nodes['planner-modal-storage-notice'].hidden, false);
    assert.equal(app.nodes['planner-modal-retry-save'].hidden, false);
    assert.ok(app.nodes['planner-save-status'].textContent.includes('Not saved'));
    app.nodes['planner-export-raw'].click(); assert.equal(app.blobs[0], raw);
    faults.write = false; app.nodes['planner-modal-retry-save'].click();
    const day = JSON.parse(app.stored())[date];
    assert.equal(day.tasks.length, 2); assert.equal(day.generalNote, 'Keep this day note');
    assert.equal(app.writes.length, 1); assert.equal(app.nodes['new-task-input'].value, '');
    assert.equal(app.nodes['new-task-input'].readOnly, false);
    assert.equal(app.nodes['planner-storage-notice'].hidden, true);
    app.nodes['planner-modal-retry-save'].click(); assert.equal(app.writes.length, 1);
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
    assert.equal(app.nodes['alerts-container'].children.length, 1);
    app.open(); assert.equal(app.nodes['stat-total'].textContent, '2');
    const checkbox = app.nodes['task-list'].children[0].querySelector('.task-checkbox');
    checkbox.checked = true; checkbox.fire('change');
    assert.ok(app.days()[16].querySelector('.completed-all'));
    assert.equal(app.nodes['alerts-container'].children.length, 0);
    app.nodes['btn-ai-analyze'].click(); assert.ok(app.nodes['ai-analysis-content'].innerHTML.includes('%67'));
    app.nodes['next-month'].click(); assert.equal(app.days().length, 30);
    app.nodes['prev-month'].click(); assert.equal(app.days().length, 31);
});
