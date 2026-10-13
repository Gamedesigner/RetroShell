export interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
}

export interface DirectoryListing {
  path: string;
  parent: string | null; // null at the top of a drive
  entries: DirectoryEntry[];
  error?: string;
}

export interface FileInfo {
  size: number;
  modified: number; // ms since epoch
  created: number;
}

export interface ElectronAPI {
  sendPtyInput: (data: string) => void;
  onPtyData: (callback: (data: string) => void) => void;
  resizePty: (cols: number, rows: number) => void;
  closeWindow: () => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  startWindowResize: (edge: string) => void;
  moveWindowResize: () => void;
  endWindowResize: () => void;
  listDirectory: (dirPath: string) => Promise<DirectoryListing>;
  getFileInfo: (filePath: string) => Promise<FileInfo | null>;
  showInExplorer: (filePath: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
