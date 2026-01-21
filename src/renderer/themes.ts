import { ITheme } from '@xterm/xterm';

export interface RetroTheme extends ITheme {
  name: string;
  glow: string;  // For CRT text-shadow effect
}

// DOS Blue - Classic IBM PC style
export const dosBlue: RetroTheme = {
  name: 'DOS Blue',
  foreground: '#CCCCCC',
  background: '#0000AA',
  cursor: '#FFFFFF',
  cursorAccent: '#0000AA',
  selectionBackground: 'rgba(255, 255, 255, 0.3)',
  selectionForeground: '#FFFFFF',
  glow: 'rgba(204, 204, 204, 0.5)',
  black: '#0C0C0C',
  brightBlack: '#767676',
  red: '#C50F1F',
  brightRed: '#E74C3C',
  green: '#13A10E',
  brightGreen: '#2ECC71',
  yellow: '#C19C00',
  brightYellow: '#F1C40F',
  blue: '#0037DA',
  brightBlue: '#3498DB',
  magenta: '#881798',
  brightMagenta: '#9B59B6',
  cyan: '#3A96DD',
  brightCyan: '#1ABC9C',
  white: '#CCCCCC',
  brightWhite: '#FFFFFF'
};

// Amber Phosphor - Classic amber monochrome monitor
export const amber: RetroTheme = {
  name: 'Amber',
  foreground: '#FFB000',
  background: '#1A1200',
  cursor: '#FFB000',
  cursorAccent: '#1A1200',
  selectionBackground: 'rgba(255, 176, 0, 0.3)',
  selectionForeground: '#FFB000',
  glow: 'rgba(255, 176, 0, 0.5)',
  // Amber-tinted ANSI colors
  black: '#1A1200',
  brightBlack: '#5C4000',
  red: '#FF6600',
  brightRed: '#FF8833',
  green: '#CCAA00',
  brightGreen: '#FFCC00',
  yellow: '#FFB000',
  brightYellow: '#FFDD55',
  blue: '#CC8800',
  brightBlue: '#FFAA33',
  magenta: '#FF7700',
  brightMagenta: '#FF9944',
  cyan: '#DDAA00',
  brightCyan: '#FFCC33',
  white: '#FFB000',
  brightWhite: '#FFDD88'
};

// Green Phosphor - Classic green monochrome monitor (P1 phosphor)
export const greenPhosphor: RetroTheme = {
  name: 'Green Phosphor',
  foreground: '#33FF00',
  background: '#0D1A00',
  cursor: '#33FF00',
  cursorAccent: '#0D1A00',
  selectionBackground: 'rgba(51, 255, 0, 0.3)',
  selectionForeground: '#33FF00',
  glow: 'rgba(51, 255, 0, 0.5)',
  // Green-tinted ANSI colors
  black: '#0D1A00',
  brightBlack: '#1A4000',
  red: '#66FF00',
  brightRed: '#88FF33',
  green: '#33FF00',
  brightGreen: '#66FF33',
  yellow: '#55FF00',
  brightYellow: '#88FF55',
  blue: '#22CC00',
  brightBlue: '#44DD22',
  magenta: '#44EE00',
  brightMagenta: '#66FF22',
  cyan: '#33DD00',
  brightCyan: '#55EE22',
  white: '#33FF00',
  brightWhite: '#88FF88'
};

// Holographic - Inspired by "Another World"
export const holographic: RetroTheme = {
  name: 'Holographic',
  foreground: '#00ff66',      // Bright green hologram text
  background: 'rgba(10, 22, 40, 0.85)', // Semi-transparent deep navy
  cursor: '#00ff66',
  cursorAccent: '#0a1628',
  selectionBackground: 'rgba(0, 255, 102, 0.3)',
  selectionForeground: '#ffffff',
  glow: 'rgba(0, 255, 102, 0.7)', // Strong green glow
  // Green-tinted ANSI colors for holographic look
  black: '#0a1628',
  brightBlack: '#1a365d',
  red: '#00ffcc',
  brightRed: '#33ffdd',
  green: '#00ff66',
  brightGreen: '#33ff88',
  yellow: '#ccff00',
  brightYellow: '#ddff33',
  blue: '#00ccff',
  brightBlue: '#33ddff',
  magenta: '#00ff99',
  brightMagenta: '#33ffaa',
  cyan: '#00ffcc',
  brightCyan: '#33ffdd',
  white: '#00ff66',
  brightWhite: '#ffffff'
};

export const themes: Record<string, RetroTheme> = {
  holographic,
  dosBlue,
  amber,
  greenPhosphor
};

export type ThemeName = keyof typeof themes;

export const defaultTheme: ThemeName = 'holographic';
