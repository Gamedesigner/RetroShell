// Settings panel functionality
// This file is bundled separately and loaded after terminal.js

// Use any type to avoid TypeScript issues with dynamic window properties
const win = window as any;

document.addEventListener('DOMContentLoaded', () => {
    const settingsOverlay = document.getElementById('settings-overlay');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsClose = document.getElementById('settings-close');
    const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
    const soundToggle = document.getElementById('sound-toggle') as HTMLInputElement;

    // Toggle settings panel
    function toggleSettings() {
        if (settingsOverlay) {
            settingsOverlay.classList.toggle('hidden');
            
            // Update controls when opening
            if (!settingsOverlay.classList.contains('hidden')) {
                updateSettingsUI();
            }
        }
    }

    function closeSettings() {
        if (settingsOverlay) {
            settingsOverlay.classList.add('hidden');
        }
    }

    function updateSettingsUI() {
        // Wait for retroShell to be available
        if (!win.retroShell) {
            setTimeout(updateSettingsUI, 100);
            return;
        }

        // Update theme select
        if (themeSelect && win.retroShell) {
            themeSelect.value = win.retroShell.getTheme();
        }

        // Update sound toggle
        if (soundToggle && win.retroShell) {
            soundToggle.checked = win.retroShell.isSoundEnabled();
        }
    }

    // Event listeners
    if (settingsBtn) {
        settingsBtn.addEventListener('click', toggleSettings);
    }

    if (settingsClose) {
        settingsClose.addEventListener('click', closeSettings);
    }

    // Close on overlay click (but not panel click)
    if (settingsOverlay) {
        settingsOverlay.addEventListener('click', (e) => {
            if (e.target === settingsOverlay) {
                closeSettings();
            }
        });
    }

    // Theme change
    if (themeSelect) {
        themeSelect.addEventListener('change', () => {
            if (win.retroShell) {
                win.retroShell.setTheme(themeSelect.value);
            }
        });
    }

    // Sound toggle
    if (soundToggle) {
        soundToggle.addEventListener('change', () => {
            if (win.retroShell) {
                win.retroShell.setSoundEnabled(soundToggle.checked);
            }
        });
    }

    // Keyboard shortcut: Ctrl+, to open settings
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === ',') {
            e.preventDefault();
            toggleSettings();
        }
        // Escape to close
        if (e.key === 'Escape' && settingsOverlay && !settingsOverlay.classList.contains('hidden')) {
            closeSettings();
        }
    });

    // Initial UI update
    updateSettingsUI();
});

// Export something to make this a module
export {};
