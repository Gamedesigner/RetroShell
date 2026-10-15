import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { themes, defaultTheme, ThemeName, RetroTheme } from './themes';
import { soundManager } from './sounds';
import { ElectronAPI } from '../shared/types';
import { HoloCubeScene, HoloSetting, HoloContent } from './holoCube';
import { initFilePanel } from './filePanel';
import { LAB_COLS, LAB_ROWS } from './labSize';
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
const holoSettingSwitch = document.getElementById('holo-setting-switch');
const holoContentSwitch = document.getElementById('holo-content-switch');
const holoPromptLine = document.getElementById('holo-prompt-line');
const holoPathBar = document.getElementById('holo-path-bar');
const holoPath = document.getElementById('holo-path');
const holoUpBtn = document.getElementById('holo-up-btn') as HTMLButtonElement | null;
const holoFade = document.getElementById('holo-fade');

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

    // The line the cursor is on, with wrapped rows joined back together
    function getCursorLine(): string {
        const buffer = term.buffer.active;
        let row = buffer.baseY + buffer.cursorY;
        while (row > 0 && buffer.getLine(row)?.isWrapped) row--;

        const rows: string[] = [];
        do {
            rows.push(buffer.getLine(row)?.translateToString(false) ?? '');
            row++;
        } while (buffer.getLine(row)?.isWrapped);
        return rows.join('').trimEnd();
    }

    // The shell's current folder, read from the PowerShell prompt ("PS C:\path>").
    // Keeps the last one seen while the prompt is not showing, e.g. when a program is running.
    let shellDirectory = '';
    function getShellDirectory(): string {
        const match = /^PS ([^>]+)>/.exec(getCursorLine());
        if (match) shellDirectory = match[1];
        return shellDirectory;
    }

    // Put a file's path on the command line, quoted for PowerShell when it needs it.
    // The trailing space keeps several picks in a row apart.
    function typePathAtPrompt(filePath: string) {
        const text = /[\s'&;(){}$`,]/.test(filePath) ? `'${filePath.replace(/'/g, "''")}'` : filePath;
        window.electronAPI.sendPtyInput(text + ' ');
        soundManager.playKeyClick();
    }

    // The file graph can be steered on its own (go up, dive into a folder), so it
    // is only pulled back to the shell's folder when the shell actually moves.
    let followedDirectory: string | null = null;
    function shellDirectoryIfMoved(): string {
        const directory = getShellDirectory();
        if (directory === followedDirectory) return '';
        followedDirectory = directory;
        return directory;
    }

    const filePanel = initFilePanel((folder) => holoCubeScene?.showFolder(folder));

    // UP button and the folder the graph is showing, beside the CUBE / FILES switch
    function updatePathBar() {
        if (!holoCubeScene || !holoPath || !holoUpBtn) return;
        const folder = holoCubeScene.getGraphFolder() ?? '';
        if (holoPath.title !== folder) {
            holoPath.title = folder;
            // Long paths keep their tail, cut at a folder boundary
            const tail = folder.slice(-57);
            holoPath.textContent = folder.length > 60 ? '...' + tail.slice(Math.max(tail.indexOf('\\'), 0)) : folder;
        }
        holoUpBtn.disabled = !holoCubeScene.canGoUp();
    }

    holoUpBtn?.addEventListener('click', () => {
        holoCubeScene?.goUp();
        holoUpBtn.blur(); // keep keystrokes going to the terminal
    });

    // What the 3D mode shows: a setting (open space or the lab) and its content
    // (the terminal or the file graph)
    let holoSetting: HoloSetting = 'space';
    let holoContent: HoloContent = 'terminal';

    // While in the lab, the terminal runs at the size of the lab's display;
    // otherwise it fills the window
    let sizeBeforeLab: { cols: number; rows: number } | null = null;
    function fitTerminal() {
        if (cubeModeActive && holoSetting === 'lab') {
            if (!sizeBeforeLab) sizeBeforeLab = { cols: term.cols, rows: term.rows };
            term.resize(LAB_COLS, LAB_ROWS);
        } else if (cubeModeActive && sizeBeforeLab) {
            // Hidden behind the 3D view the terminal cannot measure itself, so it
            // goes back to the size it had before the lab
            term.resize(sizeBeforeLab.cols, sizeBeforeLab.rows);
            sizeBeforeLab = null;
        } else {
            sizeBeforeLab = null;
            fitAddon.fit();
        }
        window.electronAPI.resizePty(term.cols, term.rows);
    }

    // The lab's boot sequence greets the user by name
    let userName = '';
    window.electronAPI.getUserName().then((name) => { userName = name; });

    // Cut through black, the way the game cuts between shots
    function fadeThroughBlack() {
        if (!holoFade) return;
        holoFade.style.transition = 'none';
        holoFade.style.opacity = '1';
        void holoFade.offsetWidth; // start the fade from fully black
        holoFade.style.transition = '';
        holoFade.style.opacity = '0';
    }

    // Switch the 3D view's setting and content. Going in or out of the lab cuts
    // through black and resizes the terminal for the lab's display.
    function setHoloView(setting: HoloSetting, content: HoloContent) {
        if (!holoCubeScene) return;
        const settingChanged = setting !== holoSetting;
        holoSetting = setting;
        holoContent = content;
        if (settingChanged) {
            fadeThroughBlack();
            fitTerminal();
        }
        holoCubeScene.setView(setting, content, content === 'files' ? shellDirectoryIfMoved() : '', userName);

        holoSettingSwitch?.querySelectorAll('button').forEach((button) => {
            button.classList.toggle('active', button.dataset.setting === setting);
        });
        holoContentSwitch?.querySelectorAll('button').forEach((button) => {
            button.classList.toggle('active', button.dataset.content === content);
        });
        updateHoloOverlays();
        syncTerminalToHolo();
    }

    // The file graph's input line and path bar show only while the graph is on
    // screen (in the lab, once its cube has been opened)
    function updateHoloOverlays() {
        const graphShowing = holoContent === 'files' && (holoSetting !== 'lab' || !!holoCubeScene?.labShowingProgram());
        holoPromptLine?.classList.toggle('hidden', !graphShowing);
        holoPathBar?.classList.toggle('hidden', !graphShowing);
        if (!graphShowing) filePanel.close();
    }

    holoSettingSwitch?.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
            setHoloView(button.dataset.setting as HoloSetting, holoContent);
            button.blur(); // keep keystrokes going to the terminal
        });
    });
    holoContentSwitch?.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
            setHoloView(holoSetting, button.dataset.content as HoloContent);
            button.blur();
        });
    });

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
                if (holoCubeScene) {
                    holoCubeScene.onFilePicked = typePathAtPrompt;
                    holoCubeScene.onFileOpened = filePanel.open;
                    holoCubeScene.onLabScreenChange = updateHoloOverlays;
                }
            }
            if (holoCubeScene) {
                holoCubeScene.setPalette(currentTheme.holo);
                holoCubeScene.start();
                // Coming back to the lab boots it again and shrinks the terminal to fit it
                if (holoSetting === 'lab') {
                    fadeThroughBlack();
                    fitTerminal();
                    holoCubeScene.bootLab(userName);
                }
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
            fitTerminal();

            localStorage.setItem(STORAGE_KEY_CUBE_MODE, 'false');
        }
    }

    // Sync terminal content to holographic display
    function syncTerminalToHolo() {
        if (!holoCubeScene || !cubeModeActive) return;

        if (holoSetting === 'lab' && holoContent === 'terminal') {
            const buffer = term.buffer.active;
            const lines: string[] = [];
            for (let row = 0; row < term.rows; row++) {
                lines.push(buffer.getLine(buffer.viewportY + row)?.translateToString(true) ?? '');
            }
            holoCubeScene.updateLab(lines, buffer.baseY + buffer.cursorY - buffer.viewportY, buffer.cursorX);
            return;
        }

        if (holoContent === 'files') {
            // The cube is out of sight: show the input line and follow the shell's folder
            if (holoPromptLine) holoPromptLine.textContent = getCursorLine();
            const moved = shellDirectoryIfMoved();
            if (moved) holoCubeScene.showFolder(moved);
            updatePathBar();
            return;
        }

        const { lines, colors } = getTerminalLinesForHolo();
        holoCubeScene.updateText(lines, colors);
    }

    // Cube button click handler
    cubeBtn?.addEventListener('click', toggleCubeMode);

    const TYPED_KEYS = ['Enter', 'Backspace', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft'];

    // Keyboard shortcut: Ctrl+3 for cube mode
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === '3') {
            e.preventDefault();
            toggleCubeMode();
            return;
        }
        
        // Forward keyboard input to terminal when in cube mode
        if (cubeModeActive && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // In the lab the scientist types along, and a key on the program
            // cubes opens the terminal
            if (e.key.length === 1 || TYPED_KEYS.includes(e.key)) holoCubeScene?.labKeyPressed();

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
        fitTerminal();
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
