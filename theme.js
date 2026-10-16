// Apply before the stylesheet loads to avoid flashing the wrong theme.
(() => {
    const storageKey = 'studyHubTheme';
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    let preference = null;

    function validTheme(value) {
        return value === 'light' || value === 'dark' ? value : null;
    }

    try {
        preference = validTheme(localStorage.getItem(storageKey));
    } catch {
        // Theme switching still works when browser storage is unavailable.
    }

    function applyTheme() {
        const theme = preference || (systemTheme.matches ? 'dark' : 'light');
        document.documentElement.dataset.theme = theme;
        document.querySelectorAll('.theme-toggle').forEach(button => {
            const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
            button.setAttribute('aria-pressed', String(theme === 'dark'));
            button.setAttribute('aria-label', 'Dark theme');
            button.title = label;
        });
    }

    applyTheme();

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.theme-toggle').forEach(button => {
            button.hidden = false;
            button.addEventListener('click', () => {
                preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                try {
                    localStorage.setItem(storageKey, preference);
                } catch {
                    // Keep the choice for this page even if it cannot be saved.
                }
                applyTheme();
            });
        });
        applyTheme();
    });

    systemTheme.addEventListener('change', () => {
        if (!preference) applyTheme();
    });

    window.addEventListener('storage', event => {
        if (event.key === storageKey || event.key === null) {
            preference = validTheme(event.newValue);
            applyTheme();
        }
    });
})();
