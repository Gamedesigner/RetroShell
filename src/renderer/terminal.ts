import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { retroTheme } from './theme';
import { ElectronAPI } from '../shared/types';

declare const window: Window & { electronAPI: ElectronAPI };

const terminalContainer = document.getElementById('terminal-container');

if (terminalContainer) {
    const term = new Terminal({
        cursorBlink: true,
        fontFamily: '"Perfect DOS VGA 437", monospace',
        fontSize: 18,
        theme: retroTheme,
        allowTransparency: true,
        linkHandler: {
            activate: (event: MouseEvent, uri: string) => {
                window.open(uri, '_blank');
            }
        }
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalContainer);
    fitAddon.fit();
    
    // Focus the terminal
    term.focus();

    window.electronAPI.onPtyData((data: string) => {
        term.write(data);
    });

    term.onData((data) => {
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
