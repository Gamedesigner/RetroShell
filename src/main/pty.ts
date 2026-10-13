import * as pty from 'node-pty';
import * as os from 'os';

export function createPty(onData: (data: string) => void) {
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'powershell.exe' : 'bash';

  // Color codes
  const Y = '\x1b[1;33m'; // Yellow (border)
  const R = '\x1b[1;31m'; // Red
  const O = '\x1b[1;33m'; // Orange/Yellow  
  const G = '\x1b[1;32m'; // Green
  const C = '\x1b[1;36m'; // Cyan
  const B = '\x1b[1;34m'; // Blue
  const M = '\x1b[1;35m'; // Magenta
  const X = '\x1b[0m';    // Reset

  // Simple fixed-width banner - 60 chars content
  const W = 60;
  const line = (content: string) => {
    // Strip ANSI codes for visible length calculation
    const visible = content.replace(/\x1b\[[0-9;]*m/g, '');
    const pad = W - visible.length;
    return `${Y}║${content}${' '.repeat(pad > 0 ? pad : 0)}${Y}║`;
  };
  
  // OSC 8 hyperlink - the text "Ron Millar" is 10 chars visible
  // Format: \x1b]8;;URL\x1b\\VISIBLE_TEXT\x1b]8;;\x1b\\
  const ronMillarLink = `\x1b]8;;https://ronmillar.com\x1b\\${G}Ron Millar${C}\x1b]8;;\x1b\\`;
  
  // Build author line: "  (c) 2026 Retro Systems        Author: Ron Millar" = 50 visible chars
  // So we need 10 spaces of padding to reach 60
  const authorLineContent = `  ${C}(c) 2026 Retro Systems        Author: ${ronMillarLink}`;
  const authorLine = `${Y}║${authorLineContent}          ${Y}║`;
  
  const banner = [
    '',
    `${Y}╔${'═'.repeat(W)}╗`,
    line(`  ${R}█▀▀█ ${O}█▀▀▀ ${G}▀▀█▀▀ ${C}█▀▀█ ${B}█▀▀█ ${Y}═${M}█▀▀▀█ ${R}█  █ ${O}█▀▀▀ ${G}█    ${C}█   `),
    line(`  ${R}█▄▄▀ ${O}█▀▀▀ ${G}  █   ${C}█▄▄▀ ${B}█  █ ${Y}═${M}▀▀▀▄▄ ${R}█▀▀█ ${O}█▀▀▀ ${G}█    ${C}█   `),
    line(`  ${R}█  █ ${O}█▄▄▄ ${G}  █   ${C}█  █ ${B}█▄▄█ ${Y}═${M}█▄▄▄█ ${R}█  █ ${O}█▄▄▄ ${G}█▄▄█ ${C}█▄▄█`),
    line(``),
    authorLine,
    `${Y}╚${'═'.repeat(W)}╝${X}`,
    '',
  ].join('\r\n');

  // PowerShell prints the banner itself (in place of its own logo) so it is part
  // of the console's real screen. ConPTY repaints from that screen whenever the
  // terminal is resized, which wipes anything drawn behind its back.
  // Two trailing blank lines put the first prompt on row 11.
  const env = { ...process.env, RETROSHELL_BANNER: banner + '\r\n\r\n' } as { [key: string]: string };
  const args = isWindows
    ? ['-NoLogo', '-NoExit', '-Command', 'Clear-Host; Write-Host -NoNewline $env:RETROSHELL_BANNER; Remove-Item Env:RETROSHELL_BANNER']
    : [];

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: os.homedir(),
    env,
  });

  ptyProcess.onData(onData);

  return ptyProcess;
}
