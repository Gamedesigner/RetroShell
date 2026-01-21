import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  sendPtyInput: (data: string) => ipcRenderer.send('pty-input', data),
  onPtyData: (callback: (data: string) => void) => {
    ipcRenderer.on('pty-data', (_event, data) => callback(data));
  },
  resizePty: (cols: number, rows: number) => ipcRenderer.send('pty-resize', { cols, rows }),
  // Add window controls if needed since frame is false
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
});
