import type { CommandInterface, Emulators } from 'emulators';

// The DOS game on the lab's display, run in DOSBox compiled to WebAssembly
// (js-dos's emulators package). Its picture is drawn into a canvas that the lab
// shows on the display, and while it is on screen it takes the keyboard.

// The emulator's files, in the app's own node_modules
const EMULATORS_PATH = new URL('../../node_modules/emulators/dist/', location.href).href;

// The game's programs, the full game first, then the demo
const GAME_PROGRAMS = ['OOTW.EXE', 'ANOTHER.EXE', 'OOTWDEMO.EXE'];

const DOSBOX_CONF = `[sdl]
autolock=false

[dosbox]
machine=svga_s3
memsize=16

[cpu]
core=auto
cycles=auto

[autoexec]
echo off
mount c .
c:
`;

// The paths of the files in a zip, from its central directory
function zipFileNames(zip: Uint8Array): string[] {
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    let end = zip.length - 22;
    while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
    if (end < 0) return [];
    const count = view.getUint16(end + 10, true);
    let at = view.getUint32(end + 16, true);
    const names: string[] = [];
    for (let i = 0; i < count && view.getUint32(at, true) === 0x02014b50; i++) {
        const nameLength = view.getUint16(at + 28, true);
        names.push(new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength)));
        at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    }
    return names;
}

// Start-up commands that run the game's program, wherever in the zip it is,
// and close DOSBox when it quits. (Run from an IF line the game stalls.)
function autoexec(zip: Uint8Array): string | null {
    const names = zipFileNames(zip);
    for (const program of GAME_PROGRAMS) {
        const found = names.find((name) => name.toUpperCase().split('/').pop() === program);
        if (!found) continue;
        const folder = found.split('/').slice(0, -1).join('\\');
        return (folder ? `cd ${folder}\n` : '') + `${program}\nexit\n`;
    }
    return null;
}

const TEXT_FONT = '"Perfect DOS VGA 437", Consolas, monospace';

// Browser key positions to DOSBox's key codes (the GLFW numbering js-dos uses)
const KEY_CODES: Record<string, number> = {
    Space: 32, Quote: 39, Comma: 44, Minus: 45, Period: 46, Slash: 47, Semicolon: 59, Equal: 61,
    BracketLeft: 91, Backslash: 92, BracketRight: 93, Backquote: 96,
    Escape: 256, Enter: 257, Tab: 258, Backspace: 259, Insert: 260, Delete: 261,
    ArrowRight: 262, ArrowLeft: 263, ArrowDown: 264, ArrowUp: 265,
    PageUp: 266, PageDown: 267, Home: 268, End: 269, CapsLock: 280,
    NumpadDecimal: 330, NumpadDivide: 331, NumpadMultiply: 332, NumpadSubtract: 333, NumpadAdd: 334, NumpadEnter: 335,
    ShiftLeft: 340, ControlLeft: 341, AltLeft: 342, ShiftRight: 344, ControlRight: 345, AltRight: 346,
};

function keyCode(code: string): number | undefined {
    if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
    if (/^Digit\d$/.test(code)) return code.charCodeAt(5);
    const f = /^F(\d+)$/.exec(code);
    if (f && Number(f[1]) <= 12) return 289 + Number(f[1]);
    const numpad = /^Numpad(\d)$/.exec(code);
    if (numpad) return 320 + Number(numpad[1]);
    return KEY_CODES[code];
}

// The emulator's script, loaded the first time the game is played
let emulatorsReady: Promise<Emulators> | null = null;
function loadEmulators(): Promise<Emulators> {
    emulatorsReady ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = EMULATORS_PATH + 'emulators.js';
        script.onload = () => {
            const emulators = (window as any).emulators as Emulators;
            emulators.pathPrefix = EMULATORS_PATH;
            resolve(emulators);
        };
        script.onerror = () => {
            emulatorsReady = null;
            reject(new Error('could not load the emulator'));
        };
        document.head.appendChild(script);
    });
    return emulatorsReady;
}

export class LabGame {
    // What the lab shows: the game's picture at a fixed size
    public readonly canvas = document.createElement('canvas');
    private ctx: CanvasRenderingContext2D;
    // The emulator's frame at its own size (it changes with the video mode)
    private frame = document.createElement('canvas');
    private frameCtx: CanvasRenderingContext2D;
    private image: ImageData | null = null;

    private ci: CommandInterface | null = null;
    private starting = false;
    private active = false;
    private held = new Set<number>();

    public onFrame: (() => void) | null = null;
    public onKey: (() => void) | null = null;
    // The game quit, or no game was picked
    public onExit: (() => void) | null = null;

    private keyDown = (e: KeyboardEvent) => this.key(e, true);
    private keyUp = (e: KeyboardEvent) => this.key(e, false);

    constructor() {
        this.canvas.width = 640;
        this.canvas.height = 400;
        this.ctx = this.canvas.getContext('2d')!;
        this.frameCtx = this.frame.getContext('2d')!;
        // Ahead of the terminal's own key handling, so game keys never reach the shell
        window.addEventListener('keydown', this.keyDown, true);
        window.addEventListener('keyup', this.keyUp, true);
    }

    // Put the game on screen: start it the first time (asking for the game's
    // files if none are stored yet), or carry on from where it was left
    public async open() {
        this.active = true;
        if (this.ci) {
            this.ci.resume();
            this.applySound();
            return;
        }
        if (this.starting) return;
        this.starting = true;
        try {
            this.message('LOADING...');
            const game = (await window.electronAPI.loadGame()) ?? (await window.electronAPI.pickGame());
            if (!game) {
                this.message('');
                if (this.active) this.onExit?.();
                return;
            }
            const run = autoexec(game);
            if (!run) {
                this.message('NO OUT OF THIS WORLD PROGRAM IN THAT ZIP');
                return;
            }
            const emulators = await loadEmulators();
            const ci = await emulators.dosboxWorker([game, { dosboxConf: DOSBOX_CONF + run, jsdosConf: { version: '8' } }], { audioWorklet: true });
            this.ci = ci;
            ci.events().onFrame((rgb, rgba) => this.draw(rgb, rgba));
            ci.events().onExit(() => {
                this.ci = null;
                this.held.clear();
                this.message('');
                if (this.active) this.onExit?.();
            });
            if (this.active) this.applySound();
            else ci.pause();
        } catch (error) {
            console.error('game failed to start', error);
            this.message('THE GAME WOULD NOT START');
        } finally {
            this.starting = false;
        }
    }

    // Off the screen: the game pauses, and any keys still held are let go
    public close() {
        this.active = false;
        if (!this.ci) return;
        for (const code of this.held) this.ci.sendKeyEvent(code, false);
        this.held.clear();
        this.ci.pause();
    }

    // Follow RetroShell's own sound setting
    private applySound() {
        const soundOn = (window as any).retroShell?.isSoundEnabled?.() ?? true;
        if (soundOn) this.ci?.unmute();
        else this.ci?.mute();
    }

    private key(e: KeyboardEvent, pressed: boolean) {
        if (!this.active) return;
        // Ctrl+3 still leaves the 3D view
        if (e.ctrlKey && e.key === '3') return;
        const code = keyCode(e.code);
        if (code === undefined) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!this.ci) return;
        if (pressed) {
            // DOS repeats held keys itself
            if (e.repeat) return;
            this.held.add(code);
            this.onKey?.();
        } else {
            this.held.delete(code);
        }
        this.ci.sendKeyEvent(code, pressed);
    }

    private draw(rgb: Uint8Array | null, rgba: Uint8Array | null) {
        const ci = this.ci;
        if (!ci) return;
        const width = ci.width();
        const height = ci.height();
        if (!width || !height) return;
        if (!this.image || this.frame.width !== width || this.frame.height !== height) {
            this.frame.width = width;
            this.frame.height = height;
            this.image = this.frameCtx.createImageData(width, height);
        }
        const data = this.image.data;
        if (rgba) {
            data.set(rgba.subarray(0, data.length));
        } else if (rgb) {
            for (let i = 0, j = 0; j < data.length; i += 3, j += 4) {
                data[j] = rgb[i];
                data[j + 1] = rgb[i + 1];
                data[j + 2] = rgb[i + 2];
                data[j + 3] = 255;
            }
        } else {
            return;
        }
        this.frameCtx.putImageData(this.image, 0, 0);
        // Scaled up with hard pixel edges, as on a VGA monitor
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.frame, 0, 0, this.canvas.width, this.canvas.height);
        this.onFrame?.();
    }

    private message(text: string) {
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.font = `28px ${TEXT_FONT}`;
        ctx.fillStyle = '#a8f0a2';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
        this.onFrame?.();
    }

    public dispose() {
        window.removeEventListener('keydown', this.keyDown, true);
        window.removeEventListener('keyup', this.keyUp, true);
        void this.ci?.exit();
        this.ci = null;
    }
}
