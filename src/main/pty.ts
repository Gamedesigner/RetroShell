import * as pty from 'node-pty';
import * as os from 'os';

export function createPty(onData: (data: string) => void) {
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: os.homedir(),
    env: process.env as { [key: string]: string },
  });

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

  // Wait for PowerShell to fully initialize, THEN show banner
  let bannerShown = false;
  let suppressWelcome = false; // Flag to suppress PowerShell welcome message after banner
  let welcomeSuppressionCount = 0; // Count messages to suppress
  const bannerLineCount = 10; // Number of lines in our banner (including empty lines)
  const psPromptRow = 6; // Row where PowerShell thinks the prompt is
  const ourPromptRow = bannerLineCount + 1; // Row where we actually put the prompt (11)
  const rowOffset = ourPromptRow - psPromptRow; // Offset to apply (11 - 6 = 5)
  
  // Track if banner is currently visible (can be cleared by user)
  let bannerVisible = false;
  
  // Function to offset cursor positioning commands by the difference
  const offsetCursorPositions = (data: string): string => {
    // If we detect a clear screen command, the banner will be wiped
    // Allow the clear and stop offsetting until banner is shown again
    if (data.includes('\x1b[2J') || data.includes('\x1b[3J')) {
      bannerVisible = false;
      // Pass through the clear command without modification
      return data;
    }
    
    // If banner is not visible, don't apply offsets
    if (!bannerVisible) {
      return data;
    }
    
    let result = data;
    
    // Handle cursor home (ESC[H with no arguments) - offset to below banner
    result = result.replace(/\x1b\[H(?!\d)/g, `\x1b[${ourPromptRow};1H`);
    
    // Handle cursor position with row only: ESC[rowH
    result = result.replace(/\x1b\[(\d+)H(?!;|\d)/g, (match, row) => {
      const newRow = parseInt(row) + rowOffset;
      return `\x1b[${newRow}H`;
    });
    
    // Handle cursor position with row and col: ESC[row;colH
    result = result.replace(/\x1b\[(\d+);(\d+)H/g, (match, row, col) => {
      const newRow = parseInt(row) + rowOffset;
      return `\x1b[${newRow};${col}H`;
    });
    
    return result;
  };
  
  ptyProcess.onData((data) => {
    if (!bannerShown) {
      // Wait for the first prompt - this means PowerShell is fully initialized
      const hasPS = data.includes('PS ');
      const hasGt = data.includes('>');
      if (hasPS && hasGt) {
        bannerShown = true;
        bannerVisible = true; // Banner is now on screen
        suppressWelcome = true;
        welcomeSuppressionCount = 0;
        
        // Build complete initial output as ONE string to avoid IPC race conditions
        const offsetPrompt = offsetCursorPositions(data);
        const initialOutput = 
          '\x1b[2J\x1b[H' +           // Clear screen, cursor home
          banner +                     // Banner
          `\x1b[${ourPromptRow};1H` + // Position cursor below banner
          offsetPrompt;                // Prompt
        
        // Send as single atomic write
        onData(initialOutput);
      }
      // Suppress all PowerShell init output (copyright, etc)
    } else {
      // Suppress the PowerShell welcome message that comes right after we show our banner
      if (suppressWelcome) {
        welcomeSuppressionCount++;
        if (data.includes('Windows PowerShell') || data.includes('Copyright')) {
          // Suppress this welcome message - don't pass to terminal
          if (welcomeSuppressionCount >= 2) {
            suppressWelcome = false;
          }
          return;
        }
        // After first prompt, stop suppression mode
        if (data.includes('PS ') && data.includes('>')) {
          suppressWelcome = false;
        }
      }
      
      // After banner is shown, pass through all data with cursor offsets
      onData(offsetCursorPositions(data));
    }
  });

  return ptyProcess;
}
