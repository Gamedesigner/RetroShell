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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
