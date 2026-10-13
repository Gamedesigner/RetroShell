import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { themes, defaultTheme, ThemeName, RetroTheme } from './themes';
import { soundManager } from './sounds';
import { ElectronAPI } from '../shared/types';
import { HoloCubeScene } from './holoCube';
import './windowResize';

declare const window: Window & { electronAPI: ElectronAPI };

const STORAGE_KEY_THEME = 'retro-shell-theme';
const STORAGE_KEY_CUBE_MODE = 'retro-shell-cube-mode';

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
    document.documentElement.style.setProperty('--theme-cursor', theme.cursor || '#FFFFFF');
    const { normal } = theme.holo;
    document.documentElement.style.setProperty('--holo-rgb', `${normal >> 16}, ${(normal >> 8) & 0xff}, ${normal & 0xff}`);

    // Toggle holographic class for specific effects
    if (theme.name === 'Holographic') {
        document.body.classList.add('holographic');
    } else {
        document.body.classList.remove('holographic');
    }
}

const terminalContainer = document.getElementById('terminal-container');
const holoCubeContainer = document.getElementById('holo-cube-container');
const cubeBtn = document.getElementById('cube-btn');

// Cube mode state
let cubeModeActive = false;
let holoCubeScene: HoloCubeScene | null = null;
let termBufferSyncInterval: ReturnType<typeof setInterval> | null = null;

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
            holoCubeScene?.setPalette(currentTheme.holo);
            localStorage.setItem(STORAGE_KEY_THEME, themeName);
        }
    }

    // Function to extract terminal buffer as lines with color info
    interface TerminalLineData {
        lines: string[];
        colors: number[][];
        cursorRow: number;
    }

    function getTerminalLinesWithColors(): TerminalLineData {
        const buffer = term.buffer.active;
        const lines: string[] = [];
        const colors: number[][] = [];
        const viewportRows = term.rows;
        const cursorY = buffer.cursorY;
        // 3D text colors: normal, dim (autocomplete) and prompt line
        const { normal: COLOR_NORMAL, dim: COLOR_DIM, prompt: COLOR_PROMPT } = currentTheme.holo;

        // Get visible viewport lines
        for (let i = 0; i < viewportRows; i++) {
            const bufferLine = buffer.getLine(buffer.viewportY + i);
            if (bufferLine) {
                let lineStr = '';
                const lineColors: number[] = [];
                
                for (let col = 0; col < bufferLine.length; col++) {
                    const cell = bufferLine.getCell(col);
                    if (cell) {
                        const char = cell.getChars() || ' ';
                        lineStr += char;
                        
                        // Check if this is dim/faint text (attribute bit for dim)
                        // In xterm.js, we can check fg color - dim text often has different fg
                        const fg = cell.getFgColor();
                        const isDim = cell.isDim();
                        const isCursorLine = (buffer.viewportY + i) === (buffer.baseY + cursorY);
                        
                        if (isDim || fg === 8 || fg === 240 || fg === 245 || fg === 250) {
                            // Dim/grey text - likely autocomplete
                            lineColors.push(COLOR_DIM);
                        } else if (isCursorLine) {
                            // Prompt/cursor line - slightly different color
                            lineColors.push(COLOR_PROMPT);
                        } else {
                            lineColors.push(COLOR_NORMAL);
                        }
                    } else {
                        lineStr += ' ';
                        lineColors.push(COLOR_NORMAL);
                    }
                }
                
                lines.push(lineStr.trimEnd());
                colors.push(lineColors);
            } else {
                lines.push('');
                colors.push([]);
            }
        }
        
        return { lines, colors, cursorRow: cursorY };
    }

    // Function to get lines ensuring cursor/prompt is always visible at bottom
    function getTerminalLinesForHolo(): { lines: string[], colors: number[][] } {
        const data = getTerminalLinesWithColors();
        const maxRows = 45; // Match holoText MAX_ROWS
        
        // Find the cursor line (prompt line) - it's typically where we're typing
        const cursorLineIndex = data.cursorRow;
        
        // We want to show lines ending at or just after the cursor
        // Take the last maxRows lines, ensuring cursor line is visible
        let startRow = Math.max(0, data.lines.length - maxRows);
        
        // If cursor is above our window, adjust
        if (cursorLineIndex < startRow) {
            startRow = cursorLineIndex;
        }
        
        const endRow = Math.min(startRow + maxRows, data.lines.length);
        
        return {
            lines: data.lines.slice(startRow, endRow),
            colors: data.colors.slice(startRow, endRow)
        };
    }

    // Cube mode toggle function
    function toggleCubeMode() {
        if (!holoCubeContainer || !terminalContainer) return;

        cubeModeActive = !cubeModeActive;
        
        if (cubeModeActive) {
            // Activate 3D cube mode
            terminalContainer.classList.add('hidden');
            holoCubeContainer.classList.remove('hidden');
            cubeBtn?.classList.add('active');

            // Initialize Three.js scene if not already
            if (!holoCubeScene) {
                const { init: initHoloCube } = (window as any).holoCube;
                holoCubeScene = initHoloCube(holoCubeContainer);
            }
            if (holoCubeScene) {
                holoCubeScene.setPalette(currentTheme.holo);
                holoCubeScene.start();
            }

            // Start syncing terminal buffer to 3D text
            syncTerminalToHolo();
            termBufferSyncInterval = setInterval(syncTerminalToHolo, 100); // ~10fps

            localStorage.setItem(STORAGE_KEY_CUBE_MODE, 'true');
        } else {
            // Deactivate 3D cube mode
            terminalContainer.classList.remove('hidden');
            holoCubeContainer.classList.add('hidden');
            cubeBtn?.classList.remove('active');

            // Stop animation and sync
            if (holoCubeScene) {
                holoCubeScene.stop();
            }
            if (termBufferSyncInterval) {
                clearInterval(termBufferSyncInterval);
                termBufferSyncInterval = null;
            }

            // Refocus and resize terminal (the window may have been resized while in 3D)
            term.focus();
            fitAddon.fit();
            window.electronAPI.resizePty(term.cols, term.rows);

            localStorage.setItem(STORAGE_KEY_CUBE_MODE, 'false');
        }
    }

    // Sync terminal content to holographic display
    function syncTerminalToHolo() {
        if (!holoCubeScene || !cubeModeActive) return;
        const { lines, colors } = getTerminalLinesForHolo();
        holoCubeScene.updateText(lines, colors);
    }

    // Cube button click handler
    cubeBtn?.addEventListener('click', toggleCubeMode);

    // Keyboard shortcut: Ctrl+3 for cube mode
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === '3') {
            e.preventDefault();
            toggleCubeMode();
            return;
        }
        
        // Forward keyboard input to terminal when in cube mode
        if (cubeModeActive && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Handle special keys
            if (e.key === 'Enter') {
                window.electronAPI.sendPtyInput('\r');
                soundManager.playReturn();
                e.preventDefault();
            } else if (e.key === 'Backspace') {
                window.electronAPI.sendPtyInput('\x7f');
                soundManager.playKeyDelete();
                e.preventDefault();
            } else if (e.key === 'Tab') {
                window.electronAPI.sendPtyInput('\t');
                soundManager.playKeyClick();
                e.preventDefault();
            } else if (e.key === 'Escape') {
                window.electronAPI.sendPtyInput('\x1b');
                e.preventDefault();
            } else if (e.key === 'ArrowUp') {
                window.electronAPI.sendPtyInput('\x1b[A');
                e.preventDefault();
            } else if (e.key === 'ArrowDown') {
                window.electronAPI.sendPtyInput('\x1b[B');
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                window.electronAPI.sendPtyInput('\x1b[C');
                e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
                window.electronAPI.sendPtyInput('\x1b[D');
                e.preventDefault();
            } else if (e.key.length === 1) {
                // Single printable character
                window.electronAPI.sendPtyInput(e.key);
                if (e.key === ' ') {
                    soundManager.playSpacebar();
                } else {
                    soundManager.playKeyClick();
                }
                e.preventDefault();
            }
        }
    });

    // Expose theme, sound, and cube API globally
    (window as any).retroShell = {
        setTheme,
        getTheme: () => currentThemeName,
        getThemes: () => Object.keys(themes),
        getThemeNames: () => Object.entries(themes).map(([key, theme]) => ({ key, name: theme.name })),
        setSoundEnabled: (enabled: boolean) => soundManager.setEnabled(enabled),
        isSoundEnabled: () => soundManager.isEnabled(),
        toggleCubeMode,
        isCubeModeActive: () => cubeModeActive
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
