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
  // Edge/corner resize handles, since a transparent frameless window has no native resize border
  startWindowResize: (edge: string) => ipcRenderer.send('window-resize-start', edge),
  moveWindowResize: () => ipcRenderer.send('window-resize-move'),
  endWindowResize: () => ipcRenderer.send('window-resize-end'),
  // Folder listing for the 3D file graph
  listDirectory: (dirPath: string) => ipcRenderer.invoke('fs-list-dir', dirPath),
  getFileInfo: (filePath: string) => ipcRenderer.invoke('fs-file-info', filePath),
  showInExplorer: (filePath: string) => ipcRenderer.send('fs-show-in-explorer', filePath),
});
