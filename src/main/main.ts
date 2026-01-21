import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { createPty } from './pty';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false, // Custom frame for retro look
    transparent: true,
    resizable: true,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  createWindow();
  
  const ptyProcess = createPty((data: string) => {
    mainWindow?.webContents.send('pty-data', data);
  });

  ipcMain.on('pty-input', (event, data) => {
    ptyProcess.write(data);
  });

  ipcMain.on('pty-resize', (event, { cols, rows }) => {
    ptyProcess.resize(cols, rows);
  });

  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });

  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
