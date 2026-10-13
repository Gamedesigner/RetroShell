import { app, BrowserWindow, ipcMain, screen, shell, Rectangle, Point } from 'electron';
import * as path from 'path';
import { createPty } from './pty';
import { listDirectory, fileInfo } from './files';

let mainWindow: BrowserWindow | null = null;

const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

// Active edge drag from the renderer's resize handles
let resizeDrag: { edge: string; startBounds: Rectangle; startCursor: Point } | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 850,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
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

  // A transparent frameless window has no native resize border on Windows,
  // so the renderer's edge handles drive the bounds from here.
  ipcMain.on('window-resize-start', (event, edge: string) => {
    if (!mainWindow || mainWindow.isMaximized()) return;
    resizeDrag = {
      edge,
      startBounds: mainWindow.getBounds(),
      startCursor: screen.getCursorScreenPoint(),
    };
  });

  ipcMain.on('window-resize-move', () => {
    if (!mainWindow || !resizeDrag) return;
    const { edge, startBounds, startCursor } = resizeDrag;
    const cursor = screen.getCursorScreenPoint();
    const dx = cursor.x - startCursor.x;
    const dy = cursor.y - startCursor.y;

    // Clamp to our own minimum: Electron resets a transparent window's minimum
    // size to its current size on every setBounds, so getMinimumSize() would
    // only ever let the window grow.
    let { x, y, width, height } = startBounds;
    if (edge.includes('e')) width = Math.max(MIN_WIDTH, startBounds.width + dx);
    if (edge.includes('s')) height = Math.max(MIN_HEIGHT, startBounds.height + dy);
    if (edge.includes('w')) {
      width = Math.max(MIN_WIDTH, startBounds.width - dx);
      x = startBounds.x + startBounds.width - width;
    }
    if (edge.includes('n')) {
      height = Math.max(MIN_HEIGHT, startBounds.height - dy);
      y = startBounds.y + startBounds.height - height;
    }
    mainWindow.setBounds({ x, y, width, height });
  });

  ipcMain.on('window-resize-end', () => {
    resizeDrag = null;
  });

  ipcMain.handle('fs-list-dir', (event, dirPath: string) => listDirectory(dirPath));

  ipcMain.handle('fs-file-info', (event, filePath: string) => fileInfo(filePath));

  // Opens the containing folder in Explorer with the file selected
  ipcMain.on('fs-show-in-explorer', (event, filePath: string) => {
    shell.showItemInFolder(filePath);
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
