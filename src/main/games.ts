import { app, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// The DOS game played on the lab's display. The user picks their own copy once
// and it is kept in the app's data folder, never in the app or its repo.

function storedGamePath(): string {
  return path.join(app.getPath('userData'), 'games', 'out-of-this-world.zip');
}

// The stored game zip, or null when none has been picked yet
export async function loadGame(): Promise<Uint8Array | null> {
  try {
    return await fs.promises.readFile(storedGamePath());
  } catch {
    return null;
  }
}

// Ask for the game zip, keep a copy of it, and return it (null if cancelled)
export async function pickGame(window: BrowserWindow | null): Promise<Uint8Array | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Find your Out of This World game (a zip of its DOS files)',
    filters: [{ name: 'Zip archives', extensions: ['zip'] }],
    properties: ['openFile'],
  };
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return null;

  const target = storedGamePath();
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.copyFile(result.filePaths[0], target);
  return fs.promises.readFile(target);
}
