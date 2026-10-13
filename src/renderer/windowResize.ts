import { ElectronAPI } from '../shared/types';

declare const window: Window & { electronAPI: ElectronAPI };

// Drag the window's edges and corners to resize it. The main process tracks
// the cursor and applies the new bounds; pointer capture keeps the drag alive
// when the cursor outruns the window edge.
document.querySelectorAll<HTMLElement>('.resize-handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        handle.setPointerCapture(e.pointerId);
        window.electronAPI.startWindowResize(handle.dataset.edge || '');
        e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
        if (handle.hasPointerCapture(e.pointerId)) {
            window.electronAPI.moveWindowResize();
        }
    });

    const endResize = (e: PointerEvent) => {
        if (handle.hasPointerCapture(e.pointerId)) {
            handle.releasePointerCapture(e.pointerId);
        }
        window.electronAPI.endWindowResize();
    };
    handle.addEventListener('pointerup', endResize);
    handle.addEventListener('pointercancel', endResize);
});
