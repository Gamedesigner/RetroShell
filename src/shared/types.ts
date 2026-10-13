export interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
}

export interface DirectoryListing {
  path: string;
  entries: DirectoryEntry[];
  error?: string;
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
