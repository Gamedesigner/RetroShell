import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { themes, defaultTheme, ThemeName, RetroTheme } from './themes';
import { soundManager } from './sounds';
import { ElectronAPI } from '../shared/types';

declare const window: Window & { electronAPI: ElectronAPI };

const STORAGE_KEY_THEME = 'retro-shell-theme';

// Get saved theme or default
function getSavedTheme(): ThemeName {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved && saved in themes) {
        return saved as ThemeName;
    }
    return defaultTheme;
}

// Apply theme to CSS variables for CRT effects
function applyThemeToCss(theme: RetroTheme) {
    document.documentElement.style.setProperty('--glow-color', theme.glow);
    document.documentElement.style.setProperty('--theme-background', theme.background || '#0000AA');
    document.documentElement.style.setProperty('--theme-foreground', theme.foreground || '#CCCCCC');
    
    // Toggle holographic class for specific effects
    if (theme.name === 'Holographic') {
        document.body.classList.add('holographic');
    } else {
        document.body.classList.remove('holographic');
    }
}

const terminalContainer = document.getElementById('terminal-container');

if (terminalContainer) {
    let currentThemeName = getSavedTheme();
    let currentTheme = themes[currentThemeName];
    
    const term = new Terminal({
        cursorBlink: true,
        fontFamily: '"Perfect DOS VGA 437", monospace',
        fontSize: 18,
        theme: currentTheme,
        allowTransparency: true,
        linkHandler: {
            activate: (event: MouseEvent, uri: string) => {
                window.open(uri, '_blank');
            }
        }
    });

    // Apply initial theme CSS
    applyThemeToCss(currentTheme);

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalContainer);
    fitAddon.fit();
    
    // Focus the terminal
    term.focus();

    // Theme switching function
    function setTheme(themeName: ThemeName) {
        if (themeName in themes) {
            currentThemeName = themeName;
            currentTheme = themes[themeName];
            term.options.theme = currentTheme;
            applyThemeToCss(currentTheme);
            localStorage.setItem(STORAGE_KEY_THEME, themeName);
        }
    }

    // Expose theme and sound API globally for settings panel
    (window as any).retroShell = {
        setTheme,
        getTheme: () => currentThemeName,
        getThemes: () => Object.keys(themes),
        getThemeNames: () => Object.entries(themes).map(([key, theme]) => ({ key, name: theme.name })),
        setSoundEnabled: (enabled: boolean) => soundManager.setEnabled(enabled),
        isSoundEnabled: () => soundManager.isEnabled()
    };

    window.electronAPI.onPtyData((data: string) => {
        // Check for BEL character (ASCII 7) and play beep
        if (data.includes('\x07')) {
            soundManager.playBeep();
        }
        term.write(data);
    });

    term.onData((data) => {
        // Detect special keys for different sounds
        const isDelete = data === '\x7f' || data === '\x08' || data === '\x1b[3~';
        const isSpace = data === ' ';
        const isReturn = data === '\r' || data === '\n';
        
        if (isDelete) {
            soundManager.playKeyDelete();
        } else if (isSpace) {
            soundManager.playSpacebar();
        } else if (isReturn) {
            soundManager.playReturn();
        } else {
            soundManager.playKeyClick();
        }
        window.electronAPI.sendPtyInput(data);
    });

    window.addEventListener('resize', () => {
        fitAddon.fit();
        window.electronAPI.resizePty(term.cols, term.rows);
    });

    // Initial resize
    window.electronAPI.resizePty(term.cols, term.rows);
    
    // Update date and time in status bar
    const dateEl = document.getElementById('date');
    const timeEl = document.getElementById('time');
    
    const updateDateTime = () => {
        const now = new Date();
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        }
        if (timeEl) {
            timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    };
    
    updateDateTime();
    setInterval(updateDateTime, 1000);
}
