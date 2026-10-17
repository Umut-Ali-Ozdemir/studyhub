// Optional real-browser layout check using an installed Chromium browser.
// Run: node tests/planner-layout.browser.cjs "C:\path\to\chrome.exe"
// Uses a temporary browser profile and local fixtures, never your saved plans.
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const browser = process.argv[2];
if (!browser || !fs.existsSync(browser)) throw new Error('Pass the path to an installed Chromium browser.');

async function checkLayout() {
    const results = [];
    const baselines = new Map();
    let current;
    function check(condition, message) { if (!condition) throw new Error(message); }
    for (const width of [1200, 1040, 900, 390, 320]) {
        for (const theme of ['light', 'dark']) {
            for (const date of ['2021-02-14', '2026-10-17', '2026-03-17']) {
                for (const count of [0, 5, 15]) {
                    const frame = document.createElement('iframe');
                    frame.style.cssText = `width:${width}px;height:1100px;border:0;display:block`;
                    try {
                        const loaded = new Promise((resolve, reject) => {
                            frame.onload = resolve; frame.onerror = reject;
                        });
                        frame.src = `/planner.html?layoutTest=1&date=${date}&count=${count}&theme=${theme}`;
                        document.body.appendChild(frame);
                        await loaded;
                        const doc = frame.contentDocument;
                        const win = frame.contentWindow;
                        const calendar = doc.querySelector('.calendar-main');
                        const panel = doc.getElementById('daily-panel');
                        const list = doc.getElementById('task-list');
                        const cell = doc.querySelector('button.calendar-day');
                        const a = calendar.getBoundingClientRect(), b = panel.getBoundingClientRect();
                        current = { width, theme, date, count, calendarHeight: a.height, panelHeight: b.height, cellHeight: cell.getBoundingClientRect().height };
                        const expected = width > 1000 ? 82 : width > 600 ? 88 : 70;
                        for (const day of doc.querySelectorAll('.calendar-day')) {
                            check(Math.abs(day.getBoundingClientRect().height - expected) < 1, 'Cell height changed');
                        }
                        check(doc.documentElement.scrollWidth <= width + 1, 'Horizontal page overflow');
                        const baselineKey = `${width}/${theme}/${date}`;
                        if (!count) baselines.set(baselineKey, a.height);
                        check(Math.abs(a.height - baselines.get(baselineKey)) < 1, 'Task count changed calendar height');
                        if (width > 1000) {
                            check(Math.abs(a.top - b.top) < 1, 'Card tops differ');
                            check(Math.abs(a.bottom - b.bottom) < 1, 'Card bottoms differ');
                            check(panel.scrollHeight <= panel.clientHeight + 1, 'Panel contents overflow');
                        } else check(b.top >= a.bottom, 'Stacked cards overlap');
                        for (const selector of ['#new-task-input', '#add-task-form button', '#day-general-note']) {
                            const r = doc.querySelector(selector).getBoundingClientRect();
                            check(r.top >= b.top && r.bottom <= b.bottom, `${selector} outside daily card`);
                        }
                        if (count === 15) {
                            check(list.scrollHeight > list.clientHeight && list.clientHeight > 0, 'Task list does not scroll');
                            list.scrollTop = list.scrollHeight;
                            check(list.scrollTop > 0, 'Task list cannot scroll vertically');
                            const row = list.lastElementChild;
                            row.querySelector('.task-note-toggle').click();
                            check(!row.querySelector('.task-note-editor').hidden, 'Note did not expand');
                            check(doc.activeElement === row.querySelector('.task-note-input'), 'Note input did not receive focus');
                            check(Math.abs(calendar.getBoundingClientRect().height - a.height) < 1, 'Opening note resized calendar');
                            check(panel.scrollHeight <= panel.clientHeight + 1, 'Expanded note overflowed daily card');
                        }
                        results.push({ ...current, passed: true });
                        if (count === 15) {
                            win.Storage.prototype.setItem = () => { throw new Error('Simulated quota failure'); };
                            doc.getElementById('new-task-input').value = 'Unsaved task';
                            doc.getElementById('add-task-form').requestSubmit();
                            const failedPanel = panel.getBoundingClientRect();
                            check(!doc.getElementById('planner-day-storage-notice').hidden, 'Missing save failure notice');
                            check(panel.scrollHeight <= panel.clientHeight + 1, 'Save error overflowed daily card');
                            for (const selector of ['#planner-day-retry-save', '#new-task-input', '#day-general-note']) {
                                const r = doc.querySelector(selector).getBoundingClientRect();
                                check(r.top >= failedPanel.top && r.bottom <= failedPanel.bottom, `${selector} outside failed-save card`);
                            }
                            if (width > 1000) check(Math.abs(calendar.getBoundingClientRect().bottom - failedPanel.bottom) < 1, 'Save error misaligned cards');
                            results.push({ width, theme, date, count, mode: 'failed-save', passed: true });
                        }
                    } catch (error) {
                        results.push({ width, theme, date, count, ...current, passed: false, error: error.message });
                    } finally { frame.remove(); }
                }
            }
        }
    }
    for (const width of [1200, 390]) {
        const frame = document.createElement('iframe');
        frame.style.cssText = `width:${width}px;height:1100px;border:0;display:block`;
        try {
            const loaded = new Promise(resolve => { frame.onload = resolve; });
            frame.src = '/planner.html?layoutTest=1&date=2021-02-14&count=0&theme=light&invalid=1';
            document.body.appendChild(frame);
            await loaded;
            const doc = frame.contentDocument;
            const panel = doc.getElementById('daily-panel');
            check(!doc.getElementById('planner-storage-notice').hidden, 'Missing invalid-record warning');
            check(panel.scrollHeight <= panel.clientHeight + 1, 'Invalid-record controls overflowed');
            check(frame.contentWindow.localStorage.getItem('studyHubPlannerData') === '{', 'Invalid record was changed');
            if (width > 1000) check(Math.abs(panel.getBoundingClientRect().bottom - doc.querySelector('.calendar-main').getBoundingClientRect().bottom) < 1, 'Invalid-record cards misaligned');
            results.push({ width, mode: 'invalid-record', passed: true });
        } catch (error) { results.push({ width, mode: 'invalid-record', passed: false, error: error.message }); }
        finally { frame.remove(); }
    }
    document.body.textContent = '';
    const output = document.createElement('pre');
    output.id = 'layout-results';
    output.textContent = btoa(JSON.stringify(results));
    document.body.appendChild(output);
}

const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/layout-check') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(`<html><body><script>(${checkLayout.toString()})()</script></body></html>`);
        return;
    }
    const file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404); response.end(); return;
    }
    let content = fs.readFileSync(file, 'utf8');
    if (url.pathname === '/planner.html' && url.searchParams.has('layoutTest')) {
        const date = url.searchParams.get('date');
        const count = Number(url.searchParams.get('count'));
        const tasks = Array.from({ length: count }, (_, id) => ({
            id, text: 'Review calculus chapter ' + id, note: 'Keep this task note', completed: false, isDeadline: true
        }));
        const data = url.searchParams.has('invalid') ? '{' : JSON.stringify({ [date]: { generalNote: 'Keep this daily note', tasks } });
        const fixture = `localStorage.setItem('studyHubPlannerData', ${JSON.stringify(data)});
            localStorage.setItem('studyHubTheme', ${JSON.stringify(url.searchParams.get('theme'))});
            window.Date = class extends Date { constructor(...args) { super(...(args.length ? args : [${JSON.stringify(date + 'T12:00:00')} ])); } };`;
        content = content.replace('<head>', `<head><script>${fixture}</script>`);
    }
    response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
    response.end(content);
});

(async () => {
    const temporaryRoot = os.tmpdir();
    const profile = fs.mkdtempSync(path.join(temporaryRoot, 'studyhub-layout-'));
    try {
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const output = await new Promise((resolve, reject) => {
            const child = spawn(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
                `--user-data-dir=${profile}`, '--dump-dom', '--virtual-time-budget=30000', '--window-size=1400,1200',
                `http://127.0.0.1:${server.address().port}/layout-check`], { windowsHide: true });
            let stdout = '', stderr = '';
            const timeout = setTimeout(() => { child.kill(); reject(new Error('Browser check timed out')); }, 60000);
            child.stdout.on('data', chunk => { stdout += chunk; });
            child.stderr.on('data', chunk => { stderr += chunk; });
            child.on('error', reject);
            child.on('exit', code => {
                clearTimeout(timeout);
                if (code) reject(new Error(`Browser exited ${code}: ${stderr.slice(-1000)}`));
                else resolve(stdout);
            });
        });
        const match = output.match(/<pre id="layout-results">([^<]+)<\/pre>/);
        assert.ok(match, 'Browser did not finish all layout scenarios');
        const results = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
        const failures = results.filter(item => !item.passed);
        console.log(JSON.stringify({ scenarios: results.length, failures, desktopMeasurements: results.filter(item => item.width === 1200 && item.theme === 'light' && !item.mode) }, null, 2));
        if (failures.length) process.exitCode = 1;
    } finally {
        server.close();
        // Delete only the unique temporary profile created by this run.
        assert.equal(path.dirname(path.resolve(profile)), path.resolve(temporaryRoot));
        assert.ok(path.basename(profile).startsWith('studyhub-layout-'));
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
