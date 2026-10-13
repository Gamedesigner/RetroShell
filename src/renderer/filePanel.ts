import { ElectronAPI } from '../shared/types';
import { FILE_KIND_LABELS, fileExtension, fileKind } from './fileKinds';

declare const window: Window & { electronAPI: ElectronAPI };

// Info panel docked beside the 3D file graph. Opens on a file double-click and
// offers to root the graph at the file's folder or show it in Explorer.

function splitPath(filePath: string): { folder: string; name: string } {
    const cut = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    let folder = filePath.slice(0, cut);
    // "C:" on its own means the drive's current folder, not its top
    if (/^[A-Za-z]:$/.test(folder)) folder += '\\';
    return { folder, name: filePath.slice(cut + 1) };
}

function formatSize(bytes: number): string {
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    if (unit === 0) return `${bytes.toLocaleString()} bytes`;
    return `${value.toFixed(1)} ${units[unit]} (${bytes.toLocaleString()} bytes)`;
}

export function initFilePanel(onOpenFolder: (folder: string) => void) {
    const panel = document.getElementById('holo-file-panel');
    const nameEl = document.getElementById('holo-file-name');
    const detailsEl = document.getElementById('holo-file-details');
    const closeBtn = document.getElementById('holo-file-close');
    const rootBtn = document.getElementById('holo-file-root');
    const explorerBtn = document.getElementById('holo-file-explorer');

    let current: string | null = null;

    function setDetails(rows: [string, string][]) {
        if (!detailsEl) return;
        detailsEl.textContent = '';
        for (const [label, value] of rows) {
            const dt = document.createElement('dt');
            dt.textContent = label;
            const dd = document.createElement('dd');
            dd.textContent = value;
            detailsEl.append(dt, dd);
        }
    }

    async function open(filePath: string) {
        if (!panel) return;
        current = filePath;
        const { folder, name } = splitPath(filePath);
        const extension = fileExtension(name);
        const kind = FILE_KIND_LABELS[fileKind(name)] + (extension ? ` (.${extension})` : '');

        if (nameEl) nameEl.textContent = name;
        setDetails([['KIND', kind], ['FOLDER', folder]]);
        panel.classList.add('open');

        const info = await window.electronAPI.getFileInfo(filePath);
        // Another file may have been opened while this one was being read
        if (current !== filePath) return;
        setDetails(info
            ? [
                ['KIND', kind],
                ['SIZE', formatSize(info.size)],
                ['MODIFIED', new Date(info.modified).toLocaleString()],
                ['CREATED', new Date(info.created).toLocaleString()],
                ['FOLDER', folder],
            ]
            : [['KIND', kind], ['FOLDER', folder], ['', 'Details are not available for this file.']]);
    }

    function close() {
        current = null;
        panel?.classList.remove('open');
    }

    // Buttons give up focus after a click so keystrokes keep going to the terminal
    closeBtn?.addEventListener('click', () => {
        close();
        closeBtn.blur();
    });
    rootBtn?.addEventListener('click', () => {
        if (current) onOpenFolder(splitPath(current).folder);
        rootBtn.blur();
    });
    explorerBtn?.addEventListener('click', () => {
        if (current) window.electronAPI.showInExplorer(current);
        explorerBtn.blur();
    });

    return { open, close };
}
