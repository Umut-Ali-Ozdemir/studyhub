document.querySelector('.nav-toggle').addEventListener('click', () => {
    const navLinks = document.querySelector('.nav-links');
    navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
});

// Sample notes data (in a real app, this would come from a backend)
const sampleNotes = [
    {
        id: 1,
        title: "Calculus Derivatives",
        course: "math",
        author: "John Doe",
        downloadUrl: "#"
    },
    {
        id: 2,
        title: "Machine Learning Basics",
        course: "cs",
        author: "Jane Smith",
        downloadUrl: "#"
    }
];

// Notes rendering function
function renderNotes(notes) {
    const notesGrid = document.querySelector('.notes-grid');
    notesGrid.innerHTML = ''; // Clear existing notes

    notes.forEach(note => {
        const noteCard = document.createElement('div');
        noteCard.classList.add('note-card');
        noteCard.innerHTML = `
            <h3>${note.title}</h3>
            <p class="note-details">Course: ${note.course.toUpperCase()} | By ${note.author}</p>
            <a href="${note.downloadUrl}" class="download-btn" download>
              <span class="download-icon">⬇️</span> Download PDF
            </a>
        `;
        notesGrid.appendChild(noteCard);
    });
}

// Filter notes by course and search
function filterNotes() {
    const courseSelect = document.getElementById('course-select');
    const searchInput = document.getElementById('search-notes');
    
    const filteredNotes = sampleNotes.filter(note => {
        const matchesCourse = courseSelect.value === '' || note.course === courseSelect.value;
        const matchesSearch = searchInput.value === '' || 
            note.title.toLowerCase().includes(searchInput.value.toLowerCase());
        
        return matchesCourse && matchesSearch;
    });

    renderNotes(filteredNotes);
}

// Upload form handling
function setupUploadForm() {
    const uploadForm = document.getElementById('upload-form');
    
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // In a real app, this would be a file upload to a server
        alert('Note upload simulation: File would be processed');
        uploadForm.reset();
    });
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

// Sample exam data (would typically come from backend)
const sampleExams = [
    {
        id: 1,
        title: "Calculus Midterm 2022",
        university: "mit",
        course: "math",
        type: "midterm",
        topic: "Derivatives",
        downloadUrl: "#"
    },
    {
        id: 2,
        title: "Machine Learning Final",
        university: "stanford",
        course: "cs",
        type: "final",
        topic: "Neural Networks",
        downloadUrl: "#"
    }
];

// Exam rendering function
function renderExams(exams) {
    const examGrid = document.querySelector('.exam-grid');
    if (!examGrid) return; // Exit if not on exam page

    examGrid.innerHTML = ''; // Clear existing exams

    exams.forEach(exam => {
        const examCard = document.createElement('div');
        examCard.classList.add('exam-card');
        examCard.innerHTML = `
            <h3>${exam.title}</h3>
            <p class="exam-details">
                Course: ${exam.course.toUpperCase()} | 
                Type: ${exam.type.charAt(0).toUpperCase() + exam.type.slice(1)} | 
                Topic: ${exam.topic}
            </p>
            <a href="${exam.downloadUrl}" class="exam-download-btn" download>
              <span class="download-icon">⬇️</span> Download PDF
            </a>
        `;
        examGrid.appendChild(examCard);
    });
}

// Filter exams
function filterExams() {
    const courseFilter = document.getElementById('course-filter');
    const examTypeFilter = document.getElementById('exam-type-filter');
    const examSearch = document.getElementById('exam-search');

    if (!courseFilter || !examTypeFilter || !examSearch) return;

    const filteredExams = sampleExams.filter(exam => {
        const matchesCourse = courseFilter.value === '' || exam.course === courseFilter.value;
        const matchesType = examTypeFilter.value === '' || exam.type === examTypeFilter.value;
        const matchesSearch = examSearch.value === '' || 
            exam.title.toLowerCase().includes(examSearch.value.toLowerCase()) ||
            exam.topic.toLowerCase().includes(examSearch.value.toLowerCase());
        
        return matchesCourse && matchesType && matchesSearch;
    });

    renderExams(filteredExams);
}

// Exam upload handling
function setupExamUploadForm() {
    const uploadForm = document.getElementById('exam-upload-form');
    if (!uploadForm) return;
    
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // In a real app, this would be a file upload to a server
        alert('Exam upload simulation: File would be processed');
        uploadForm.reset();
    });
}

// Initialize exam page
function initExamArchivePage() {
    renderExams(sampleExams);
    
    const courseFilter = document.getElementById('course-filter');
    const examTypeFilter = document.getElementById('exam-type-filter');
    const examSearch = document.getElementById('exam-search');
    
    if (courseFilter) courseFilter.addEventListener('change', filterExams);
    if (examTypeFilter) examTypeFilter.addEventListener('change', filterExams);
    if (examSearch) examSearch.addEventListener('input', filterExams);
    
    setupExamUploadForm();
}

// Run initializations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initNotesPage();
    initExamArchivePage();
    initStudyPlanner(); // Initialize planner if on planner page
});

// --- STUDY PLANNER LOGIC ---

function initStudyPlanner() {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return; // Exit if not on planner page

    let currentDate = new Date();
    // Default to current local time for correct initial month view
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();
    
    let activeDateStr = null; // Currently opened date in modal

    const monthYearEl = document.getElementById('month-year');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    // Planner Data State
    // Format: { "YYYY-MM-DD": { generalNote: "", tasks: [ { id: 1, text: "Math", completed: false, note: "50 q" } ] } }
    let plannerData = JSON.parse(localStorage.getItem('studyHubPlannerData')) || {};

    function savePlannerData() {
        localStorage.setItem('studyHubPlannerData', JSON.stringify(plannerData));
    }

    function getDayData(dateStr) {
        if (!plannerData[dateStr]) {
            plannerData[dateStr] = { generalNote: "", tasks: [] };
        }
        return plannerData[dateStr];
    }

    function renderCalendar() {
        calendarGrid.innerHTML = '';
        
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        // Adjust for Monday as first day of week
        // getDay() returns 0 for Sunday, 1 for Monday...
        let startDayIndex = firstDay === 0 ? 6 : firstDay - 1;

        const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        monthYearEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;

        const today = new Date();
        const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

        // Empty cells before start of month
        for (let i = 0; i < startDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('calendar-day', 'empty');
            calendarGrid.appendChild(emptyCell);
        }

        // Days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            const dayCell = document.createElement('div');
            dayCell.classList.add('calendar-day');
            
            if (isCurrentMonth && i === today.getDate()) {
                dayCell.classList.add('today');
            }

            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            dayCell.innerHTML = `<div class="day-number">${i}</div>`;
            
            // Render preview tasks and notes
            const dayData = plannerData[dateStr];
            if (dayData) {
                // Check for general note
                if (dayData.generalNote && dayData.generalNote.trim() !== '') {
                    const noteIcon = document.createElement('div');
                    noteIcon.classList.add('day-note-icon');
                    noteIcon.textContent = '📝';
                    noteIcon.title = 'Günün Notu Var';
                    dayCell.appendChild(noteIcon);
                }

                if (dayData.tasks && dayData.tasks.length > 0) {
                    // Task dots
                    const previewContainer = document.createElement('div');
                    previewContainer.classList.add('day-preview-tasks');
                    
                    dayData.tasks.slice(0, 5).forEach(task => { // Show up to 5 dots
                        const taskDot = document.createElement('div');
                        taskDot.classList.add('task-dot');
                        if(task.completed) taskDot.classList.add('done');
                        if(task.isDeadline) taskDot.classList.add('exam-dot');
                        previewContainer.appendChild(taskDot);
                    });
                    
                    if (dayData.tasks.length > 5) {
                        const moreSpan = document.createElement('div');
                        moreSpan.classList.add('task-dot', 'more');
                        previewContainer.appendChild(moreSpan);
                    }
                    dayCell.appendChild(previewContainer);

                    // Progress percentage
                    const total = dayData.tasks.length;
                    const completed = dayData.tasks.filter(t => t.completed).length;
                    const percent = Math.round((completed / total) * 100);

                    const progressDiv = document.createElement('div');
                    progressDiv.classList.add('day-progress');
                    if (percent === 100) {
                        progressDiv.classList.add('completed-all');
                        progressDiv.textContent = '🌟 %100';
                    } else {
                        progressDiv.textContent = `%${percent}`;
                    }
                    dayCell.appendChild(progressDiv);
                }

                // Deadline Day Highlighting
                let hasUnfinishedDeadline = dayData.tasks.some(t => t.isDeadline && !t.completed);
                if (hasUnfinishedDeadline) {
                    const [y, m, d] = dateStr.split('-');
                    const taskDate = new Date(y, m - 1, d);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const diffTime = taskDate - today;
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays >= 0 && diffDays <= 3) {
                        dayCell.classList.add('deadline-urgent');
                    } else if (diffDays > 3 && diffDays <= 5) {
                        dayCell.classList.add('deadline-near');
                    }
                }
            }

            dayCell.addEventListener('click', () => openDayModal(dateStr, i, monthNames[currentMonth], currentYear));
            calendarGrid.appendChild(dayCell);
        }
    }

    // Modal Logic
    const modal = document.getElementById('day-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const modalDateTitle = document.getElementById('modal-date-title');
    const taskList = document.getElementById('task-list');
    const addTaskForm = document.getElementById('add-task-form');
    const newTaskInput = document.getElementById('new-task-input');
    const dayGeneralNote = document.getElementById('day-general-note');
    
    const statCompleted = document.getElementById('stat-completed');
    const statTotal = document.getElementById('stat-total');

    function openDayModal(dateStr, day, monthName, year) {
        activeDateStr = dateStr;
        modalDateTitle.textContent = `${day} ${monthName} ${year}`;
        modal.classList.add('show');
        renderModalContent();
    }

    function closeDayModal() {
        modal.classList.remove('show');
        activeDateStr = null;
    }

    closeModalBtn.addEventListener('click', closeDayModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeDayModal();
    });

    function renderModalContent() {
        if (!activeDateStr) return;
        
        const dayData = getDayData(activeDateStr);
        dayGeneralNote.value = dayData.generalNote || "";
        
        taskList.innerHTML = '';
        
        let completedCount = 0;

        dayData.tasks.forEach(task => {
            if (task.completed) completedCount++;
            
            const li = document.createElement('li');
            li.classList.add('task-item');
            if (task.completed) li.classList.add('completed');
            if (task.isDeadline) li.classList.add('is-exam');
            
            li.innerHTML = `
                <div class="task-item-header">
                    <div class="task-checkbox-wrapper">
                        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                        <span class="task-text">${task.text}</span>
                    </div>
                    <button class="btn-delete-task" title="Sil">×</button>
                </div>
                <input type="text" class="task-note-input" placeholder="Küçük not ekle (Örn: 50 soru çözüldü, 40dk çalışıldı...)" value="${task.note || ''}">
            `;
            
            const checkbox = li.querySelector('.task-checkbox');
            checkbox.addEventListener('change', (e) => {
                task.completed = e.target.checked;
                savePlannerData();
                renderModalContent(); // re-render to update stats and styles
                renderCalendar(); // update background calendar
                renderUpcomingDeadlines(); // update alerts panel
            });

            const deleteBtn = li.querySelector('.btn-delete-task');
            deleteBtn.addEventListener('click', () => {
                dayData.tasks = dayData.tasks.filter(t => t.id !== task.id);
                savePlannerData();
                renderModalContent();
                renderCalendar();
                renderUpcomingDeadlines(); // update alerts panel
            });

            const noteInput = li.querySelector('.task-note-input');
            noteInput.addEventListener('change', (e) => {
                task.note = e.target.value;
                savePlannerData();
            });

            taskList.appendChild(li);
        });

        statTotal.textContent = dayData.tasks.length;
        statCompleted.textContent = completedCount;
    }

    addTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = newTaskInput.value.trim();
        const deadlineCheckbox = document.getElementById('new-task-deadline');
        const isDeadline = deadlineCheckbox ? deadlineCheckbox.checked : false;

        if (text && activeDateStr) {
            const dayData = getDayData(activeDateStr);
            dayData.tasks.push({
                id: Date.now(),
                text: text,
                completed: false,
                note: "",
                isDeadline: isDeadline
            });
            savePlannerData();
            newTaskInput.value = '';
            if (deadlineCheckbox) deadlineCheckbox.checked = false;
            renderModalContent();
            renderCalendar();
            renderUpcomingDeadlines();
        }
    });

    dayGeneralNote.addEventListener('change', (e) => {
        if (activeDateStr) {
            const dayData = getDayData(activeDateStr);
            dayData.generalNote = e.target.value;
            savePlannerData();
            renderCalendar();
        }
    });

    prevMonthBtn.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });

    // Alert Panel Logic
    function renderUpcomingDeadlines() {
        const alertsContainer = document.getElementById('alerts-container');
        const alertsPanel = document.getElementById('deadline-alerts-panel');
        if (!alertsContainer || !alertsPanel) return;

        alertsContainer.innerHTML = '';
        let upcomingAlerts = [];
        const today = new Date();
        today.setHours(0,0,0,0);

        Object.keys(plannerData).forEach(dateStr => {
            const dayData = plannerData[dateStr];
            if (dayData && dayData.tasks) {
                dayData.tasks.forEach(task => {
                    if (task.isDeadline && !task.completed) {
                        const [y, m, d] = dateStr.split('-');
                        const taskDate = new Date(y, m - 1, d);
                        const diffTime = taskDate - today;
                        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays >= 0 && diffDays <= 3) { // Show up to 3 days away in the panel as requested
                            upcomingAlerts.push({
                                task: task,
                                dateStr: dateStr,
                                diffDays: diffDays
                            });
                        }
                    }
                });
            }
        });

        upcomingAlerts.sort((a, b) => a.diffDays - b.diffDays);

        if (upcomingAlerts.length === 0) {
            alertsPanel.style.display = 'none'; // Hide the panel completely
            return;
        } else {
            alertsPanel.style.display = 'block'; // Show if there are alerts
        }

        upcomingAlerts.forEach(alertItem => {
            const card = document.createElement('div');
            card.classList.add('alert-card');
            
            let timeText = alertItem.diffDays === 0 ? "Bugün!" : `Son ${alertItem.diffDays} Gün`;
            
            // Format date nicely
            const [y, m, d] = alertItem.dateStr.split('-');
            const dateNice = `${d}.${m}.${y}`;

            card.innerHTML = `
                <div class="alert-title">${alertItem.task.text}</div>
                <div class="alert-time">${timeText} <span style="color:#888; font-size:0.75rem; font-weight:normal;">(${dateNice})</span></div>
            `;
            alertsContainer.appendChild(card);
        });
    }

    // AI Analysis Logic
    renderCalendar();
    renderUpcomingDeadlines();
    const btnAiAnalyze = document.getElementById('btn-ai-analyze');
    const aiModal = document.getElementById('ai-modal');
    const closeAiModalBtn = document.getElementById('close-ai-modal');
    const aiAnalysisContent = document.getElementById('ai-analysis-content');

    function closeAiModal() {
        aiModal.classList.remove('show');
    }

    if (closeAiModalBtn) {
        closeAiModalBtn.addEventListener('click', closeAiModal);
    }
    window.addEventListener('click', (e) => {
        if (e.target === aiModal) closeAiModal();
    });

    if (btnAiAnalyze) {
        btnAiAnalyze.addEventListener('click', () => {
            // Calculate stats for the current month
            let totalTasks = 0;
            let completedTasks = 0;
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const dayData = plannerData[dateStr];
                if (dayData && dayData.tasks) {
                    totalTasks += dayData.tasks.length;
                    completedTasks += dayData.tasks.filter(t => t.completed).length;
                }
            }

            aiModal.classList.add('show');
            aiAnalysisContent.innerHTML = '<i>Düşünüyor...</i>';

            setTimeout(() => {
                if (totalTasks === 0) {
                    aiAnalysisContent.innerHTML = `Bu ay henüz hiç görev eklememişsin. Çalışma planını oluşturmak için takvimden günlere tıklayabilirsin! 🚀`;
                    return;
                }

                const completionRate = Math.round((completedTasks / totalTasks) * 100);
                let message = ``;

                if (completionRate === 100) {
                    message = `<b>Mükemmel bir performans!</b> Bu ay planladığın her şeyi başardın. Disiplinin gerçekten etkileyici. Kendinle gurur duymalısın! 🌟`;
                } else if (completionRate >= 80) {
                    message = `<b>Harika gidiyorsun!</b> Planlarına sadık kaldığın verimli bir ay geçirmişsin. Ufak tefek aksaklıklar olsa da genel tablon çok başarılı. Aynen böyle devam et! 🔥`;
                } else if (completionRate >= 50) {
                    message = `<b>Güzel bir çaba!</b> İşlerin yarısından fazlasını bitirmişsin ancak biraz daha odaklanmaya ihtiyacın olabilir. Hedeflerini küçük parçalara bölmeyi denemek ister misin? 💪`;
                } else {
                    message = `<b>Bu ay biraz zorlu geçmiş gibi görünüyor.</b> İşlerin birikmesi moralini bozmasın. Önümüzdeki ay için kendine daha gerçekçi ve ulaşılabilir hedefler koyarak yeni bir başlangıç yapabilirsin. Unutma, her gün yeni bir şanstır! 🌱`;
                }

                const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                
                aiAnalysisContent.innerHTML = `
                    <h4 style="margin-bottom: 1rem;">${monthNames[currentMonth]} ${currentYear} Özeti</h4>
                    <p>Toplam Görev: <b>${totalTasks}</b></p>
                    <p>Tamamlanan: <b>${completedTasks}</b></p>
                    <p style="margin-bottom: 1.5rem;">Başarı Oranı: <b>%${completionRate}</b></p>
                    <p>${message}</p>
                `;
            }, 800); // Simulate AI thinking delay
        });
    }

    renderCalendar();
}
