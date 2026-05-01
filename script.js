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
    renderNotes(sampleNotes);
    
    const courseSelect = document.getElementById('course-select');
    const searchInput = document.getElementById('search-notes');
    
    courseSelect.addEventListener('change', filterNotes);
    searchInput.addEventListener('input', filterNotes);
    
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
});
