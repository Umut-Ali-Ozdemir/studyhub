function initNavbar() {
    const navbar = document.querySelector('.main-nav');
    if (!navbar) return;

    const toggle = navbar.querySelector('.nav-toggle');
    const navigation = navbar.querySelector('.nav-right');
    if (!toggle || !navigation) return;

    const mobileViewport = window.matchMedia('(max-width: 1000px)');

    function setMenuOpen(isOpen) {
        navigation.classList.toggle('show', isOpen);
        toggle.setAttribute('aria-expanded', String(isOpen));
    }

    setMenuOpen(false);

    toggle.addEventListener('click', () => {
        if (mobileViewport.matches) {
            setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true');
        }
    });

    navbar.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
            setMenuOpen(false);
            toggle.focus();
        }
    });

    navigation.addEventListener('click', (event) => {
        if (event.target.closest('a')) setMenuOpen(false);
    });

    document.addEventListener('click', (event) => {
        if (!navbar.contains(event.target)) setMenuOpen(false);
    });

    mobileViewport.addEventListener('change', () => {
        setMenuOpen(false);
        if (mobileViewport.matches && navigation.contains(document.activeElement)) {
            toggle.focus();
        }
    });
}

// Sample notes data (in a real app, this would come from a backend)
const sampleNotes = [
    {
        id: 1,
        title: "Calculus: Derivatives",
        originalTitle: "Calculus Derivatives",
        course: "math",
        author: "John Doe",
        fileType: "PDF"
    },
    {
        id: 2,
        title: "Introduction to Machine Learning",
        originalTitle: "Machine Learning Basics",
        course: "cs",
        author: "Jane Smith",
        fileType: "PDF"
    }
];

const noteCourseNames = {
    math: 'Mathematics',
    cs: 'Computer Science',
    physics: 'Physics',
    biology: 'Biology'
};

// Notes rendering function
function renderNotes(notes) {
    const notesGrid = document.querySelector('.notes-grid');
    if (!notesGrid) return;
    notesGrid.innerHTML = ''; // Clear existing notes

    const resultsCount = document.getElementById('notes-results-count');
    if (resultsCount) {
        resultsCount.textContent = notes.length === 0
            ? 'No matching notes'
            : `${notes.length} sample ${notes.length === 1 ? 'note' : 'notes'} shown`;
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    }

    if (notes.length === 0) {
        const emptyState = createElement('div', 'notes-empty');
        emptyState.appendChild(createElement('span', 'notes-empty-label', 'NO RESULTS'));
        emptyState.appendChild(createElement('h3', '', 'No notes match your search.'));
        emptyState.appendChild(createElement('p', '', 'Try another title or change the course filter. To see all notes, clear the search field and select “All courses”.'));
        notesGrid.appendChild(emptyState);
        return;
    }

    notes.forEach(note => {
        const noteCard = createElement('article', 'note-card');
        const headingId = `note-title-${note.id}`;
        noteCard.setAttribute('aria-labelledby', headingId);

        const topRow = createElement('div', 'notes-card-top');
        topRow.appendChild(createElement('span', 'notes-file-type', note.fileType));
        topRow.appendChild(createElement('span', 'notes-demo-tag', 'Sample note'));
        noteCard.appendChild(topRow);

        const title = createElement('h3', 'notes-card-title', note.title);
        title.id = headingId;
        noteCard.appendChild(title);

        const details = createElement('dl', 'notes-card-details');
        [['Course', noteCourseNames[note.course] || note.course], ['Sample contributor', note.author]].forEach(([label, value]) => {
            const row = createElement('div');
            row.appendChild(createElement('dt', '', label));
            row.appendChild(createElement('dd', '', value));
            details.appendChild(row);
        });
        noteCard.appendChild(details);

        const availability = createElement('p', 'notes-card-availability', 'Demo entry. No PDF file is available to download.');
        availability.id = `note-availability-${note.id}`;
        noteCard.appendChild(availability);

        const downloadButton = createElement('button', 'button button-secondary notes-download', 'Download PDF');
        downloadButton.type = 'button';
        downloadButton.disabled = true;
        downloadButton.setAttribute('aria-describedby', availability.id);
        noteCard.appendChild(downloadButton);
        notesGrid.appendChild(noteCard);
    });
}

// Filter notes by course and search
function filterNotes() {
    const courseSelect = document.getElementById('course-select');
    const searchInput = document.getElementById('search-notes');
    if (!courseSelect || !searchInput) return;

    const normalizeTitle = value => value.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const searchTerm = normalizeTitle(searchInput.value.trim());
    
    const filteredNotes = sampleNotes.filter(note => {
        const matchesCourse = courseSelect.value === '' || note.course === courseSelect.value;
        const matchesSearch = [note.title, note.originalTitle || '']
            .some(title => normalizeTitle(title).includes(searchTerm));
        
        return matchesCourse && matchesSearch;
    });

    renderNotes(filteredNotes);
}

// Upload form handling
function setupUploadForm() {
    const uploadForm = document.getElementById('upload-form');
    if (!uploadForm) return;
    const fileInput = document.getElementById('note-file');
    const fileName = document.getElementById('note-file-name');

    if (fileInput && fileName) {
        fileInput.addEventListener('change', () => {
            fileName.textContent = fileInput.files[0]?.name || 'No file selected';
        });
    }
    
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const feedback = document.getElementById('upload-feedback');
        if (feedback) {
            feedback.textContent = 'Demo complete. Your file was not uploaded or saved, and no note was added to the library.';
        }
        uploadForm.reset();
        if (fileName) fileName.textContent = 'No file selected';
    });

    uploadForm.addEventListener('input', () => {
        const feedback = document.getElementById('upload-feedback');
        if (feedback) feedback.textContent = '';
    });

    const demoButton = document.getElementById('try-note-upload');
    if (demoButton) demoButton.disabled = false;
}

// Initialize notes page
function initNotesPage() {
    const notesGrid = document.querySelector('.notes-grid');
    if (!notesGrid) return; // Exit if not on notes page

    renderNotes(sampleNotes);
    
    const courseSelect = document.getElementById('course-select');
    const searchInput = document.getElementById('search-notes');
    
    if (courseSelect) courseSelect.addEventListener('change', filterNotes);
    if (searchInput) searchInput.addEventListener('input', filterNotes);
    
    setupUploadForm();
}

// Run initializations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initNotesPage();
    initStudyPlanner(); // Initialize planner if on planner page
});

// --- STUDY PLANNER LOGIC ---

// Validate before displaying or writing. Missing legacy optional fields get safe
// defaults in memory; validation never repairs or replaces the saved record.
function validatePlannerData(value) {
    const isRecord = item => item !== null && typeof item === 'object' && !Array.isArray(item);
    if (!isRecord(value)) throw new Error('Invalid planner root');
    const ids = new Set();
    const normalized = {};
    for (const [date, day] of Object.entries(value)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid planner date');
        const [year, month, number] = date.split('-').map(Number);
        const parsedDate = new Date(0);
        parsedDate.setFullYear(year, month - 1, number);
        if (year < 1 || parsedDate.getFullYear() !== year ||
            parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== number) {
            throw new Error('Invalid planner date');
        }
        if (!isRecord(day) || !Array.isArray(day.tasks) ||
            (day.generalNote !== undefined && typeof day.generalNote !== 'string')) {
            throw new Error('Invalid planner day');
        }
        const tasks = day.tasks.map(task => {
            if (!isRecord(task) ||
                !(typeof task.id === 'number' && Number.isSafeInteger(task.id) && task.id >= 0 ||
                  typeof task.id === 'string' && task.id.trim() !== '') ||
                ids.has(task.id) || typeof task.text !== 'string' || !task.text.trim() ||
                typeof task.completed !== 'boolean' ||
                (task.note !== undefined && typeof task.note !== 'string') ||
                (task.isDeadline !== undefined && typeof task.isDeadline !== 'boolean')) {
                throw new Error('Invalid planner task');
            }
            ids.add(task.id);
            return { ...task, note: task.note ?? '', isDeadline: task.isDeadline ?? false };
        });
        normalized[date] = { ...day, generalNote: day.generalNote ?? '', tasks };
    }
    return normalized;
}

function initStudyPlanner() {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return; // Exit if not on planner page

    const currentDate = new Date();
    // Default to current local time for correct initial month view
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();
    
    let activeDateStr = dateKey(currentDate);

    const monthYearEl = document.getElementById('month-year');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    // Planner Data State
    // Format: { "YYYY-MM-DD": { generalNote: "", tasks: [ { id: 1, text: "Math", completed: false, note: "50 q" } ] } }
    const storageKey = 'studyHubPlannerData';
    let plannerData;
    let savedRaw;
    let exportRaw;
    let retrySave = null;
    let editingBlocked = false;
    let idSequence = 0;
    let expandedTaskId = null; // View state only; never added to saved Planner records.
    const storageNotice = document.getElementById('planner-storage-notice');
    const storageMessage = document.getElementById('planner-storage-message');
    const dayNotice = document.getElementById('planner-day-storage-notice');
    const dayMessage = document.getElementById('planner-day-storage-message');
    const exportButton = document.getElementById('planner-export-raw');
    const retryButtons = [document.getElementById('planner-retry-save'), document.getElementById('planner-day-retry-save')];
    const saveStatus = document.getElementById('planner-save-status');

    function lockEditing(blocked) {
        editingBlocked = blocked;
        prevMonthBtn.disabled = nextMonthBtn.disabled = blocked;
        calendarGrid.querySelectorAll('button').forEach(button => { button.disabled = blocked; });
        document.querySelectorAll('#add-task-form input, #add-task-form button, #task-list input, #task-list button, #day-general-note').forEach(control => {
            if (control.tagName === 'TEXTAREA' || control.tagName === 'INPUT' && control.type === 'text') {
                control.readOnly = blocked;
            } else control.disabled = blocked;
        });
    }

    function showStorageError(message, retry = null) {
        retrySave = retry;
        storageMessage.textContent = message;
        // The full error and raw-data export remain above the dashboard.
        dayMessage.textContent = 'Editing paused. Retry below or use the saved-data download above.';
        storageNotice.hidden = dayNotice.hidden = false;
        exportButton.disabled = typeof exportRaw !== 'string';
        retryButtons.forEach(button => { button.hidden = !retry; });
        saveStatus.textContent = 'Not saved. Editing is paused to protect your data.';
        lockEditing(true);
    }

    retryButtons.forEach(button => button.addEventListener('click', () => retrySave?.()));
    exportButton.addEventListener('click', () => {
        if (typeof exportRaw !== 'string') return;
        let url;
        let link;
        try {
            url = URL.createObjectURL(new Blob([exportRaw], { type: 'application/json' }));
            link = document.createElement('a');
            link.href = url;
            link.download = 'studyhub-planner-raw.json';
            document.body.appendChild(link);
            link.click();
        } catch {
            storageMessage.textContent = 'The saved record is still preserved, but the download could not start. Try another browser or allow downloads.';
        } finally {
            link?.remove();
            if (url) setTimeout(() => URL.revokeObjectURL(url), 0);
        }
    });

    try {
        savedRaw = localStorage.getItem(storageKey);
        exportRaw = savedRaw;
        plannerData = validatePlannerData(savedRaw === null ? {} : JSON.parse(savedRaw));
    } catch {
        showStorageError('Planner data could not be read or validated. The saved record has not been changed. Editing is disabled. Download the raw record if available before attempting recovery.');
        monthYearEl.textContent = 'Planner unavailable';
        prevMonthBtn.disabled = nextMonthBtn.disabled = true;
        return;
    }

    // Write a validated copy first. The live model and successful UI state only
    // change after setItem succeeds. A failed operation remains retryable.
    function savePlannerData(change, afterSave, isRetry = false) {
        if (editingBlocked && !isRetry) return;
        const retry = () => savePlannerData(change, afterSave, true);
        try {
            const latest = localStorage.getItem(storageKey);
            if (latest !== savedRaw) {
                exportRaw = latest;
                showStorageError('Saved data changed elsewhere. This change was not saved and the stored record was not overwritten. Download the saved record and reload before editing.');
                return;
            }
            const candidate = validatePlannerData(JSON.parse(JSON.stringify(plannerData)));
            change(candidate);
            const validCandidate = validatePlannerData(candidate);
            const serialized = JSON.stringify(validCandidate);
            localStorage.setItem(storageKey, serialized);
            plannerData = validCandidate;
            savedRaw = exportRaw = serialized;
        } catch {
            showStorageError('This change was not saved. The previous saved record is unchanged. Keep this page open and choose Retry save, or download the saved data.', retry);
            return;
        }
        retrySave = null;
        storageNotice.hidden = dayNotice.hidden = true;
        lockEditing(false);
        saveStatus.textContent = 'Changes saved in this browser.';
        afterSave();
    }

    function getDayData(dateStr, data = plannerData) {
        return data[dateStr] || { generalNote: '', tasks: [] };
    }

    function editDay(data, dateStr) {
        if (!data[dateStr]) data[dateStr] = { generalNote: '', tasks: [] };
        return data[dateStr];
    }

    function createTaskId() {
        const usedIds = new Set(Object.values(plannerData).flatMap(day => day.tasks.map(task => task.id)));
        let id;
        do {
            const random = globalThis.crypto?.randomUUID?.() || Date.now();
            id = `task-${random}-${++idSequence}`;
        } while (usedIds.has(id));
        return id;
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const taskList = document.getElementById('task-list');
    const addTaskForm = document.getElementById('add-task-form');
    const newTaskInput = document.getElementById('new-task-input');
    const dayGeneralNote = document.getElementById('day-general-note');
    const statCompleted = document.getElementById('stat-completed');
    const statTotal = document.getElementById('stat-total');

    function dateKey(date) {
        return [String(date.getFullYear()).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')].join('-');
    }

    function localDate(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(0);
        date.setFullYear(year, month - 1, day);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function formatDate(dateStr) {
        return localDate(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    function daysFromToday(dateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.round((localDate(dateStr) - today) / 86400000);
    }

    function selectDate(dateStr, focusCalendar = false) {
        if (editingBlocked) return;
        if (dateStr !== activeDateStr) {
            expandedTaskId = null;
            taskList.scrollTop = 0;
        }
        activeDateStr = dateStr;
        const date = localDate(dateStr);
        currentMonth = date.getMonth();
        currentYear = date.getFullYear();
        refreshPlanner();
        if (focusCalendar) calendarGrid.querySelector('.selected')?.focus();
    }

    function renderCalendar() {
        calendarGrid.replaceChildren();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const startDayIndex = (firstDay + 6) % 7;
        monthYearEl.textContent = monthNames[currentMonth] + ' ' + currentYear;
        for (let i = 0; i < startDayIndex; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            empty.setAttribute('aria-hidden', 'true');
            calendarGrid.appendChild(empty);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = String(currentYear).padStart(4, '0') + '-' + String(currentMonth + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
            const dayData = getDayData(dateStr);
            const completed = dayData.tasks.filter(task => task.completed).length;
            const total = dayData.tasks.length;
            const day = document.createElement('button');
            day.type = 'button';
            day.className = 'calendar-day';
            day.disabled = editingBlocked;
            day.setAttribute('aria-controls', 'daily-panel');
            day.setAttribute('aria-pressed', String(dateStr === activeDateStr));
            day.tabIndex = dateStr === activeDateStr ? 0 : -1;
            if (dateStr === activeDateStr) day.classList.add('selected');
            if (dateStr === dateKey(new Date())) {
                day.classList.add('today');
                day.setAttribute('aria-current', 'date');
            }
            const hasNote = !!dayData.generalNote.trim();
            const hasDeadline = dayData.tasks.some(task => task.isDeadline && !task.completed);
            day.setAttribute('aria-label', formatDate(dateStr) + ': ' + completed + ' of ' + total + ' tasks completed' +
                (hasNote ? ', daily note' : '') + (hasDeadline ? ', pending deadline' : ''));
            const number = document.createElement('span');
            number.className = 'day-number';
            number.textContent = i;
            day.appendChild(number);
            if (hasNote) {
                const note = document.createElement('span');
                note.className = 'day-note-icon';
                note.textContent = '\u2022';
                note.title = 'Daily note';
                day.appendChild(note);
            }
            if (total) {
                const dots = document.createElement('span');
                dots.className = 'day-preview-tasks';
                dots.setAttribute('aria-hidden', 'true');
                dayData.tasks.slice(0, 5).forEach(task => {
                    const dot = document.createElement('span');
                    dot.className = 'task-dot' + (task.completed ? ' done' : '') + (task.isDeadline && !task.completed ? ' exam-dot' : '');
                    dots.appendChild(dot);
                });
                day.appendChild(dots);
                const progress = document.createElement('span');
                progress.className = 'day-progress' + (completed === total ? ' completed-all' : '');
                progress.textContent = Math.round(completed / total * 100) + '%';
                day.appendChild(progress);
            }
            const diff = daysFromToday(dateStr);
            if (hasDeadline && diff >= 0 && diff <= 5) day.classList.add(diff <= 3 ? 'deadline-urgent' : 'deadline-near');
            day.addEventListener('click', () => selectDate(dateStr, true));
            day.addEventListener('keydown', event => {
                const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
                if (!offset || editingBlocked) return;
                event.preventDefault();
                const next = localDate(dateStr);
                next.setDate(next.getDate() + offset);
                if (next.getFullYear() >= 1 && next.getFullYear() <= 9999) selectDate(dateKey(next), true);
            });
            calendarGrid.appendChild(day);
        }
    }

    function renderDayPanel() {
        if (!activeDateStr) return;
        
        document.getElementById('selected-date-title').textContent = formatDate(activeDateStr);
        const dayData = getDayData(activeDateStr);
        document.getElementById('tasks-empty').hidden = dayData.tasks.length > 0;
        taskList.hidden = dayData.tasks.length === 0;
        dayGeneralNote.value = dayData.generalNote || "";
        
        const scrollTop = taskList.scrollTop;
        taskList.replaceChildren();
        const dateStr = activeDateStr;
        if (!dayData.tasks.some(task => task.id === expandedTaskId)) expandedTaskId = null;
        const noteEditors = new Map();
        
        let completedCount = 0;

        dayData.tasks.forEach((task, index) => {
            if (task.completed) completedCount++;
            
            const li = document.createElement('li');
            li.classList.add('task-item');
            if (task.completed) li.classList.add('completed');
            if (task.isDeadline) li.classList.add('is-exam');
            
            const header = document.createElement('div');
            header.className = 'task-item-header';
            const checkboxWrapper = document.createElement('label');
            checkboxWrapper.className = 'task-checkbox-wrapper';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'task-checkbox';
            checkbox.checked = task.completed;
            const text = document.createElement('span');
            text.className = 'task-text';
            text.textContent = task.text;
            text.title = task.text;
            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(text);
            header.appendChild(checkboxWrapper);
            if (task.isDeadline) {
                const badge = document.createElement('span');
                badge.className = 'task-deadline-label';
                badge.textContent = 'Due';
                badge.title = 'Exam or important deadline';
                header.appendChild(badge);
            }
            const noteToggle = document.createElement('button');
            noteToggle.type = 'button';
            noteToggle.setAttribute('aria-controls', `task-note-editor-${index}`);
            header.appendChild(noteToggle);
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-delete-task';
            deleteBtn.title = 'Delete task';
            deleteBtn.textContent = '\u00d7';
            deleteBtn.setAttribute('aria-label', 'Delete task: ' + task.text);
            header.appendChild(deleteBtn);
            li.appendChild(header);
            const noteEditor = document.createElement('div');
            noteEditor.className = 'task-note-editor';
            noteEditor.id = `task-note-editor-${index}`;
            noteEditor.hidden = task.id !== expandedTaskId;
            const noteLabel = document.createElement('label');
            noteLabel.textContent = 'Task note';
            noteLabel.setAttribute('for', `task-note-input-${index}`);
            noteEditor.appendChild(noteLabel);
            const noteInput = document.createElement('input');
            noteInput.type = 'text';
            noteInput.id = `task-note-input-${index}`;
            noteInput.className = 'task-note-input';
            noteInput.placeholder = 'Add a short task note';
            noteInput.setAttribute('aria-label', 'Task note: ' + task.text);
            noteInput.value = task.note;
            let savedInputValue = noteInput.value;
            noteEditor.appendChild(noteInput);
            li.appendChild(noteEditor);

            function updateNoteIndicator(note) {
                noteToggle.className = 'task-note-toggle' + (note.trim() ? ' has-note' : '');
                noteToggle.textContent = note.trim() ? 'Note \u2022' : 'Note';
                noteToggle.setAttribute('aria-label', (note.trim() ? 'Edit note: ' : 'Add note: ') + task.text);
            }
            updateNoteIndicator(task.note);
            noteToggle.setAttribute('aria-expanded', String(!noteEditor.hidden));

            function saveNote(afterSave = () => {}) {
                const note = noteInput.value;
                savePlannerData(data => {
                    data[dateStr].tasks.find(item => item.id === task.id).note = note;
                }, () => {
                    savedInputValue = note;
                    updateNoteIndicator(note);
                    afterSave();
                });
            }
            noteEditors.set(task.id, {
                panel: noteEditor, toggle: noteToggle,
                isDirty: () => noteInput.value !== savedInputValue, save: saveNote
            });
            noteToggle.addEventListener('click', () => {
                if (editingBlocked) return;
                const applyToggle = () => {
                    expandedTaskId = expandedTaskId === task.id ? null : task.id;
                    noteEditors.forEach((editor, id) => {
                        editor.panel.hidden = id !== expandedTaskId;
                        editor.toggle.setAttribute('aria-expanded', String(!editor.panel.hidden));
                    });
                    if (noteEditor.hidden) noteToggle.focus();
                    else noteInput.focus();
                };
                const previous = noteEditors.get(expandedTaskId);
                // A normal blur saves first; also protect drafts when a control
                // is activated without a blur (for example by assistive tools).
                if (previous?.isDirty()) previous.save(applyToggle);
                else applyToggle();
            });

            checkbox.addEventListener('change', (e) => {
                const completed = e.target.checked;
                e.target.checked = task.completed;
                savePlannerData(data => {
                    data[dateStr].tasks.find(item => item.id === task.id).completed = completed;
                }, () => {
                    refreshPlanner();
                    const index = getDayData(dateStr).tasks.findIndex(item => item.id === task.id);
                    taskList.children[index]?.querySelector('.task-checkbox')?.focus();
                });
            });

            deleteBtn.addEventListener('click', () => {
                const index = getDayData(dateStr).tasks.findIndex(item => item.id === task.id);
                savePlannerData(data => {
                    data[dateStr].tasks = data[dateStr].tasks.filter(item => item.id !== task.id);
                }, () => {
                    refreshPlanner();
                    const nextRow = taskList.children[Math.min(index, taskList.children.length - 1)];
                    (nextRow?.querySelector('.task-checkbox') || newTaskInput).focus();
                });
            });

            noteInput.addEventListener('change', () => {
                if (!editingBlocked) saveNote(); // Preserve row nodes while focus moves.
            });
            taskList.appendChild(li);
        });

        taskList.scrollTop = scrollTop;
        statTotal.textContent = dayData.tasks.length;
        statCompleted.textContent = completedCount;
        document.getElementById('day-progress-bar').value = dayData.tasks.length ? completedCount / dayData.tasks.length * 100 : 0;
        lockEditing(editingBlocked);
    }

    function refreshPlanner() {
        renderDayPanel();
        refreshOverview();
    }

    function refreshOverview() {
        renderCalendar();
        renderUpcomingDeadlines();
        renderMonthlyOverview();
    }

    addTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = newTaskInput.value.trim();
        const deadlineCheckbox = document.getElementById('new-task-deadline');
        const isDeadline = deadlineCheckbox ? deadlineCheckbox.checked : false;

        if (text && activeDateStr && !editingBlocked) {
            const dateStr = activeDateStr;
            const newTask = {
                id: createTaskId(),
                text: text,
                completed: false,
                note: "",
                isDeadline: isDeadline
            };
            savePlannerData(data => {
                editDay(data, dateStr).tasks.push(newTask);
            }, () => {
                newTaskInput.value = '';
                if (deadlineCheckbox) deadlineCheckbox.checked = false;
                refreshPlanner();
                taskList.scrollTop = taskList.scrollHeight;
                newTaskInput.focus();
            });
        }
    });

    dayGeneralNote.addEventListener('change', (e) => {
        if (activeDateStr && !editingBlocked) {
            const dateStr = activeDateStr;
            const note = e.target.value;
            savePlannerData(data => { editDay(data, dateStr).generalNote = note; }, () => {
                // Update only the marker: replacing calendar buttons here would
                // interrupt a date click that caused this field to lose focus.
                const day = calendarGrid.querySelector('.selected');
                day.querySelector('.day-note-icon')?.remove();
                if (note.trim()) {
                    const marker = document.createElement('span');
                    marker.className = 'day-note-icon';
                    marker.textContent = '\u2022';
                    marker.title = 'Daily note';
                    day.appendChild(marker);
                }
                const tasks = getDayData(dateStr).tasks;
                day.setAttribute('aria-label', formatDate(dateStr) + ': ' + tasks.filter(task => task.completed).length +
                    ' of ' + tasks.length + ' tasks completed' + (note.trim() ? ', daily note' : '') +
                    (tasks.some(task => task.isDeadline && !task.completed) ? ', pending deadline' : ''));
            });
        }
    });

    function changeMonth(offset) {
        if (editingBlocked) return;
        const date = localDate(activeDateStr);
        const day = date.getDate();
        date.setDate(1);
        date.setMonth(date.getMonth() + offset);
        if (date.getFullYear() < 1 || date.getFullYear() > 9999) return;
        date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
        selectDate(dateKey(date));
    }
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));

    function renderUpcomingDeadlines() {
        const container = document.getElementById('alerts-container');
        container.replaceChildren();
        const upcoming = [];
        Object.entries(plannerData).forEach(([dateStr, day]) => {
            const diff = daysFromToday(dateStr);
            if (diff < 0 || diff > 5) return;
            day.tasks.filter(task => task.isDeadline && !task.completed).forEach(task => upcoming.push({ dateStr, task, diff }));
        });
        upcoming.sort((a, b) => a.diff - b.diff);
        document.getElementById('deadlines-empty').hidden = upcoming.length > 0;
        upcoming.forEach(({ dateStr, task, diff }) => {
            const card = document.createElement('div');
            card.className = 'alert-card' + (diff <= 3 ? ' urgent' : '');
            const title = document.createElement('p');
            title.className = 'alert-title';
            title.textContent = task.text;
            const time = document.createElement('p');
            time.className = 'alert-time';
            time.textContent = (diff === 0 ? 'Due today' : diff === 1 ? 'Due tomorrow' : 'Due in ' + diff + ' days') + ' / ' + formatDate(dateStr);
            card.appendChild(title);
            card.appendChild(time);
            container.appendChild(card);
        });
    }

    function renderMonthlyOverview() {
        const prefix = String(currentYear).padStart(4, '0') + '-' + String(currentMonth + 1).padStart(2, '0') + '-';
        const tasks = Object.entries(plannerData).filter(([date]) => date.startsWith(prefix)).flatMap(([, day]) => day.tasks);
        const total = tasks.length;
        const completed = tasks.filter(task => task.completed).length;
        const remaining = total - completed;
        const rate = total ? Math.round(completed / total * 100) : 0;
        document.getElementById('month-total').textContent = total;
        document.getElementById('month-completed').textContent = completed;
        document.getElementById('month-remaining').textContent = remaining;
        document.getElementById('month-rate').textContent = rate + '%';
        document.getElementById('month-progress-bar').value = total ? completed / total * 100 : 0;
        document.getElementById('monthly-summary').textContent = !total
            ? 'No tasks planned this month yet. Select a day and add your first study goal.'
            : completed + ' of ' + total + ' tasks completed in ' + monthNames[currentMonth] + '. ' +
                (remaining ? remaining + (remaining === 1 ? ' task remains.' : ' tasks remain.') : 'Every planned task is complete.');
    }

    refreshPlanner();
}
