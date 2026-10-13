import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DirectoryListing, FileInfo } from '../shared/types';

// Names that `dir` would show. Windows hides entries carrying the Hidden or
// System attribute (.git, NTUSER.DAT, the legacy profile junctions...), and
// Node's fs API cannot read those attributes.
function visibleNamesWindows(dirPath: string): Promise<Set<string> | null> {
  return new Promise((resolve) => {
    execFile(
      'cmd.exe',
      ['/d', '/u', '/c', `dir /b /a:-h-s "${dirPath}"`],
      { encoding: 'buffer', windowsVerbatimArguments: true, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        // An empty folder makes dir exit non-zero with nothing on stdout
        if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
          resolve(null);
          return;
        }
        const names = (stdout as Buffer).toString('utf16le').split(/\r?\n/).filter(Boolean);
        resolve(new Set(names));
      }
    );
  });
}

// List a folder for the 3D file graph. Falls back to the home folder when the
// path is not usable (e.g. the shell is sitting in a registry drive).
export async function listDirectory(dirPath: string): Promise<DirectoryListing> {
  const isWindows = process.platform === 'win32';
  const target = dirPath && path.isAbsolute(dirPath) ? path.normalize(dirPath) : os.homedir();
  const parent = path.dirname(target) !== target ? path.dirname(target) : null;

  try {
    const [dirents, visible] = await Promise.all([
      fs.promises.readdir(target, { withFileTypes: true }),
      isWindows ? visibleNamesWindows(target) : Promise.resolve(null),
    ]);

    const shown = dirents.filter((d) => {
      if (visible) return visible.has(d.name);
      return isWindows || !d.name.startsWith('.');
    });

    const entries = await Promise.all(shown.map(async (d) => {
      let isDirectory = d.isDirectory();
      if (d.isSymbolicLink()) {
        // Follow links and junctions to see what they point at
        isDirectory = await fs.promises.stat(path.join(target, d.name)).then((s) => s.isDirectory(), () => false);
      }
      return { name: d.name, isDirectory };
    }));

    return { path: target, parent, entries };
  } catch (err) {
    return { path: target, parent, entries: [], error: (err as NodeJS.ErrnoException).code || 'error' };
  }
}

// Size and dates for the file info panel
export async function fileInfo(filePath: string): Promise<FileInfo | null> {
  try {
    const stats = await fs.promises.stat(filePath);
    return { size: stats.size, modified: stats.mtimeMs, created: stats.birthtimeMs };
  } catch {
    return null;
  }
}
