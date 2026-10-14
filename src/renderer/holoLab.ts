import * as THREE from 'three';
import { LAB_COLS, LAB_ROWS } from './labSize';

// LAB mode: the terminal on a scientist's holographic display, in a lab drawn in
// the flat-polygon style of the 1991 game Another World (Out of This World).
// Everything is flat colour with no lighting, the way the game was drawn.

const COLORS = {
    wall: 0x0c1a3d,
    floor: 0x081330,
    sidePanel: 0x10244d,
    door: 0x17305a,
    doorRim: 0x0e2045,
    doorSpoke: 0x23447a,
    doorHub: 0x2a4f88,
    consoleTop: 0x284778,
    consoleFront: 0x132a5a,
    boxFace: 0x1f7a26,
    boxEdge: 0x5fd35f,
    particle: 0xb6e35a,
    hair: 0xc41a10,
    hairLight: 0xe63c1e,
    hairDark: 0x86120a,
    skin: 0xe0a07a,
    skinShade: 0xb8765a,
    ear: 0xcc8763,
    shirt: 0x131b3b,
    shirtLight: 0x1d2a55,
};
const INDICATOR_COLORS = [0x5ff2f2, 0xffffff, 0x5ff2f2, 0xe24a3a, 0x5ff2f2, 0xffffff];

const TEXT_COLOR = '#a8f0a2';
const TEXT_DIM = 'rgba(130, 225, 130, 0.45)';
const TEXT_FONT = '"Perfect DOS VGA 437", Consolas, monospace';

// The display box, floating over the console
const BOX_SIZE = new THREE.Vector3(3.2, 2.2, 1.6);
const BOX_CENTER = new THREE.Vector3(0, 0.35, 0);

// Over the scientist's left shoulder, looking across at the box. His head sits
// in the left third of the frame, close to the camera.
const CAMERA_POSITION = new THREE.Vector3(-2.5, 0.85, 4.2);
const CAMERA_TARGET = new THREE.Vector3(0.35, 0.2, 0);
const HEAD_POSITION = new THREE.Vector3(-2.25, 0.62, 2.77);
const HEAD_SCALE = 0.56;

// Boot sequence timing, in seconds after entering the lab
const BOOT_ID_END = 1.7;
const BOOT_END = 3.1;

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 704;
const MARGIN = 26;

function flat(color: number, opacity: number = 1): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
}

// A flat polygon from [x, y] pairs
function polygon(points: number[][], color: number, z: number = 0): THREE.Mesh {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), flat(color));
    mesh.position.z = z;
    return mesh;
}

export class HoloLabScene {
    public readonly group = new THREE.Group();

    private canvas = document.createElement('canvas');
    private ctx: CanvasRenderingContext2D;
    private texture: THREE.CanvasTexture;
    private particle: THREE.Mesh;
    private indicators: THREE.Mesh[] = [];

    private lines: string[] = [];
    private cursor = { row: 0, col: 0 };
    private drawnKey = '';
    private bootStart = -Infinity;
    private greeting = 'Good evening.';
    private nudge = { x: 0, y: 0 };

    constructor(parent: THREE.Object3D) {
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        this.ctx = this.canvas.getContext('2d')!;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        this.buildRoom();
        this.buildConsole();
        this.particle = this.buildBox();
        this.buildScientist();

        this.group.visible = false;
        parent.add(this.group);
    }

    private buildRoom() {
        // The room's walls and ceiling all round, so no view ever looks out of it
        const room = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 40), new THREE.MeshBasicMaterial({ color: COLORS.wall, side: THREE.BackSide }));
        room.position.set(0, 5, 11.95);
        this.group.add(room);

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), flat(COLORS.floor));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, -1.45, -2);
        this.group.add(floor);

        // The great round vault door of the accelerator, behind the desk
        const door = new THREE.Group();
        door.position.set(2.8, 1.5, -7.9);
        door.add(new THREE.Mesh(new THREE.RingGeometry(4.1, 4.7, 48), flat(COLORS.doorRim)));
        door.add(new THREE.Mesh(new THREE.CircleGeometry(4.1, 48), flat(COLORS.door)));
        for (let i = 0; i < 8; i++) {
            const spoke = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 3.2), flat(COLORS.doorSpoke));
            const angle = (i / 8) * Math.PI * 2;
            spoke.position.set(Math.sin(angle) * 2.5, Math.cos(angle) * 2.5, 0.01);
            spoke.rotation.z = -angle;
            door.add(spoke);
        }
        const hub = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), flat(COLORS.doorHub));
        hub.position.z = 0.02;
        door.add(hub);
        const hubRim = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 24), flat(COLORS.doorRim));
        hubRim.position.z = 0.02;
        door.add(hubRim);
        this.group.add(door);

        // Tall panels down the left side of the room
        for (let i = 0; i < 3; i++) {
            const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 6), flat(COLORS.sidePanel));
            panel.position.set(-5.2 + i * 1.3, 1.4, -7.6);
            this.group.add(panel);
        }
    }

    private buildConsole() {
        const top = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 1.5), flat(COLORS.consoleTop));
        top.position.set(0.1, -1.0, 0.55);
        top.rotation.x = 0.14;
        this.group.add(top);

        const front = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 0.1), flat(COLORS.consoleFront));
        front.position.set(0.1, -1.3, 1.3);
        this.group.add(front);

        // Rows of small indicator lights along the desk
        for (let i = 0; i < 18; i++) {
            const light = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.04), new THREE.MeshBasicMaterial({
                color: INDICATOR_COLORS[i % INDICATOR_COLORS.length], transparent: true, side: THREE.DoubleSide
            }));
            light.rotation.x = -Math.PI / 2 + 0.14;
            light.position.set(-1.6 + (i % 9) * 0.36, -0.93, 0.35 + Math.floor(i / 9) * 0.32);
            light.userData.phase = Math.random() * Math.PI * 2;
            this.indicators.push(light);
            this.group.add(light);
        }
    }

    // The translucent green display with the terminal text just inside its front face.
    // Returns the drifting particle inside it.
    private buildBox(): THREE.Mesh {
        const box = new THREE.Group();
        box.position.copy(BOX_CENTER);

        const geometry = new THREE.BoxGeometry(BOX_SIZE.x, BOX_SIZE.y, BOX_SIZE.z);
        const faces = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
            color: COLORS.boxFace, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false
        }));
        box.add(faces);
        box.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({
            color: COLORS.boxEdge, transparent: true, opacity: 0.55
        })));

        const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(BOX_SIZE.x * 0.94, BOX_SIZE.x * 0.94 * CANVAS_HEIGHT / CANVAS_WIDTH),
            new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false })
        );
        screen.position.z = BOX_SIZE.z / 2 - 0.04;
        screen.renderOrder = 1;
        box.add(screen);

        // A shard of the experiment drifting inside the box
        const particle = new THREE.Mesh(
            new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.07), new THREE.Vector2(0.2, -0.02), new THREE.Vector2(0.02, -0.05)])),
            new THREE.MeshBasicMaterial({ color: COLORS.particle, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
        );
        box.add(particle);

        this.group.add(box);
        return particle;
    }

    // The scientist, seen from behind his left shoulder: flat polygons on a plane
    // that faces the camera, like the game's 2D vector art
    private buildScientist() {
        const figure = new THREE.Group();
        const layer = (points: number[][], color: number, order: number) => figure.add(polygon(points, color, order * 0.002));

        // Shoulders and back
        layer([[-1.1, -1.4], [-1.05, -0.78], [-0.62, -0.5], [-0.12, -0.46], [0.3, -0.58], [0.62, -0.95], [0.75, -1.4]], COLORS.shirt, 0);
        layer([[-0.62, -0.5], [-0.12, -0.46], [-0.2, -0.7], [-0.75, -0.85]], COLORS.shirtLight, 1);
        // Neck, in the shadow of the head
        layer([[-0.15, -0.5], [0.11, -0.52], [0.15, -0.27], [-0.1, -0.23]], COLORS.skinShade, 2);
        // Head, face turned away towards the display
        layer([[-0.34, 0.02], [-0.3, -0.26], [-0.12, -0.38], [0.14, -0.36], [0.3, -0.2], [0.36, 0.02], [0.3, 0.22], [-0.24, 0.26]], COLORS.skin, 3);
        layer([[0.14, -0.36], [0.3, -0.2], [0.36, 0.02], [0.22, -0.02], [0.12, -0.2]], COLORS.skinShade, 4);
        // Ear
        layer([[-0.05, 0.04], [0.06, 0.06], [0.09, -0.08], [0.01, -0.15], [-0.06, -0.07]], COLORS.ear, 5);
        // Hair: a swept, spiky red mass in three tones
        layer([[-0.44, -0.08], [-0.48, 0.2], [-0.4, 0.44], [-0.2, 0.6], [0.06, 0.64], [0.3, 0.55], [0.44, 0.36],
            [0.42, 0.14], [0.28, 0.2], [0.16, 0.08], [0.04, 0.12], [-0.12, 0.0], [-0.22, -0.2], [-0.32, -0.16]], COLORS.hair, 6);
        layer([[-0.48, 0.2], [-0.4, 0.44], [-0.2, 0.6], [-0.26, 0.38], [-0.36, 0.18]], COLORS.hairDark, 7);
        layer([[0.06, 0.64], [0.3, 0.55], [0.44, 0.36], [0.24, 0.42], [0.08, 0.5]], COLORS.hairLight, 7);
        layer([[-0.12, 0.0], [0.04, 0.12], [0.16, 0.08], [0.06, 0.3], [-0.1, 0.26]], COLORS.hairDark, 7);
        layer([[0.28, 0.2], [0.42, 0.14], [0.5, 0.26], [0.44, 0.36]], COLORS.hairLight, 8);

        figure.position.copy(HEAD_POSITION);
        figure.scale.setScalar(HEAD_SCALE);
        figure.lookAt(CAMERA_POSITION);
        this.group.add(figure);
    }

    // Start the boot sequence, greeting the user by name
    public startBoot(userName: string) {
        const hour = new Date().getHours();
        const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        this.greeting = userName ? `Good ${part}, ${userName}.` : `Good ${part}.`;
        this.bootStart = performance.now();
        this.drawnKey = '';
    }

    public setText(lines: string[], cursorRow: number, cursorCol: number) {
        this.lines = lines;
        this.cursor = { row: cursorRow, col: cursorCol };
    }

    // Dragging only nudges the camera a little, so the framing never breaks
    public nudgeBy(dx: number, dy: number) {
        this.nudge.x = THREE.MathUtils.clamp(this.nudge.x - dx * 0.002, -0.3, 0.3);
        this.nudge.y = THREE.MathUtils.clamp(this.nudge.y + dy * 0.002, -0.2, 0.2);
    }

    // Ease back to the composed shot once the mouse is let go
    public relax() {
        this.nudge.x *= 0.92;
        this.nudge.y *= 0.92;
    }

    public update(camera: THREE.PerspectiveCamera) {
        const now = performance.now();
        const t = now / 1000;

        // A slow handheld drift around the composed shot
        camera.position.set(
            CAMERA_POSITION.x + Math.sin(t * 0.31) * 0.05 + this.nudge.x,
            CAMERA_POSITION.y + Math.sin(t * 0.23) * 0.035 + this.nudge.y,
            CAMERA_POSITION.z + Math.sin(t * 0.17) * 0.04
        );
        camera.lookAt(CAMERA_TARGET);

        this.particle.position.set(Math.sin(t * 0.4) * 1.1, Math.sin(t * 0.53) * 0.6 - 0.2, Math.cos(t * 0.37) * 0.45);
        this.particle.rotation.set(t * 0.7, t * 0.5, t * 0.3);

        for (const light of this.indicators) {
            (light.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.45 * Math.sin(t * 1.3 + light.userData.phase);
        }

        this.drawScreen(now);
    }

    private drawScreen(now: number) {
        const elapsed = (now - this.bootStart) / 1000;
        if (elapsed < BOOT_ID_END) {
            this.drawIdentification(elapsed);
        } else if (elapsed < BOOT_END) {
            this.drawBanner(elapsed - BOOT_ID_END, now);
        } else {
            this.drawTerminal(now);
        }
    }

    private beginFrame() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.strokeStyle = TEXT_DIM;
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, CANVAS_WIDTH - 20, CANVAS_HEIGHT - 20);
    }

    private cellHeight() {
        return (CANVAS_HEIGHT - MARGIN * 2) / LAB_ROWS;
    }

    private setFont(scale: number = 1, spacing: string = '0px') {
        this.ctx.font = `${Math.round(this.cellHeight() * 0.78 * scale)}px ${TEXT_FONT}`;
        this.ctx.letterSpacing = spacing;
        this.ctx.fillStyle = TEXT_COLOR;
        this.ctx.textBaseline = 'top';
    }

    // Identification: a scanned print on the left, a turning DNA helix on the right
    private drawIdentification(t: number) {
        const ctx = this.ctx;
        this.beginFrame();
        const divider = CANVAS_WIDTH * 0.46;
        const bottom = CANVAS_HEIGHT - 120;

        ctx.strokeStyle = TEXT_DIM;
        ctx.beginPath();
        ctx.moveTo(divider, 10);
        ctx.lineTo(divider, bottom);
        ctx.moveTo(10, bottom);
        ctx.lineTo(CANVAS_WIDTH - 10, bottom);
        ctx.stroke();

        // Print: nested octagons with a scan line sweeping down them
        const cx = divider / 2;
        const cy = bottom / 2;
        const octagon = (r: number) => {
            ctx.beginPath();
            for (let i = 0; i <= 8; i++) {
                const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
                const x = cx + Math.cos(a) * r * 0.8;
                const y = cy + Math.sin(a) * r;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        };
        ctx.strokeStyle = TEXT_COLOR;
        ctx.lineWidth = 6;
        octagon(200);
        ctx.lineWidth = 2;
        for (let r = 40; r < 190; r += 22) octagon(r);
        const scanY = cy - 200 + ((t * 260) % 400);
        ctx.fillStyle = 'rgba(168, 240, 162, 0.25)';
        ctx.fillRect(cx - 170, scanY - 3, 340, 6);

        // Helix: two strands of dots turning around each other, with rungs between
        this.setFont(1, '6px');
        const hx = divider + (CANVAS_WIDTH - divider) / 2;
        ctx.textAlign = 'center';
        ctx.fillText('IDENTIFICATION', hx, 40);
        ctx.textAlign = 'left';
        for (let i = 0; i < 16; i++) {
            const y = 110 + i * 24;
            const phase = i * 0.55 + t * 3;
            const x1 = hx + Math.sin(phase) * 70;
            const x2 = hx - Math.sin(phase) * 70;
            if (i % 2 === 0) {
                ctx.strokeStyle = TEXT_DIM;
                ctx.beginPath();
                ctx.moveTo(x1, y);
                ctx.lineTo(x2, y);
                ctx.stroke();
            }
            for (const [x, depth] of [[x1, Math.cos(phase)], [x2, -Math.cos(phase)]]) {
                ctx.fillStyle = depth > 0 ? TEXT_COLOR : TEXT_DIM;
                ctx.beginPath();
                ctx.arc(x, y, depth > 0 ? 7 : 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Greeting, typed out once the scan is under way
        this.setFont(1.25, '4px');
        const shown = this.greeting.slice(0, Math.max(0, Math.floor((t - 0.4) * 28)));
        ctx.fillText(shown, 60, bottom + 38);
        this.texture.needsUpdate = true;
    }

    // Boot banner typed out line by line
    private drawBanner(t: number, now: number) {
        const banner = ['RetroShell (c) 2026 Retro Systems.', 'All rights reserved.', '', 'RS-DOS Version 1.0'];
        this.beginFrame();
        this.setFont();
        let budget = Math.floor(t * 70);
        let row = 0;
        for (const line of banner) {
            const shown = line.slice(0, Math.max(0, budget));
            budget -= line.length;
            this.ctx.fillText(shown, MARGIN + 8, MARGIN + row * this.cellHeight());
            row++;
            if (budget <= 0) break;
        }
        this.drawCursor(row, 0, now);
        this.texture.needsUpdate = true;
    }

    private drawCursor(row: number, col: number, now: number) {
        if (Math.floor(now / 500) % 2 !== 0) return;
        const cellW = (CANVAS_WIDTH - MARGIN * 2) / LAB_COLS;
        this.ctx.fillStyle = TEXT_COLOR;
        this.ctx.fillRect(MARGIN + 8 + col * cellW, MARGIN + row * this.cellHeight() + 2, cellW * 0.9, this.cellHeight() * 0.8);
    }

    // The live terminal, redrawn only when its text or the cursor blink changes
    private drawTerminal(now: number) {
        const blink = Math.floor(now / 500) % 2;
        const key = `${blink}|${this.cursor.row},${this.cursor.col}|${this.lines.join('\n')}`;
        if (key === this.drawnKey) return;
        this.drawnKey = key;

        this.beginFrame();
        this.setFont();
        const cellW = (CANVAS_WIDTH - MARGIN * 2) / LAB_COLS;
        this.lines.slice(0, LAB_ROWS).forEach((line, row) => {
            // Place each character on the grid so columns line up whatever the font
            for (let col = 0; col < Math.min(line.length, LAB_COLS); col++) {
                const ch = line[col];
                if (ch !== ' ') this.ctx.fillText(ch, MARGIN + 8 + col * cellW, MARGIN + row * this.cellHeight());
            }
        });
        this.drawCursor(this.cursor.row, this.cursor.col, now);
        this.texture.needsUpdate = true;
    }

    public dispose() {
        this.group.parent?.remove(this.group);
        this.group.traverse((object) => {
            const mesh = object as THREE.Mesh;
            mesh.geometry?.dispose();
            const material = mesh.material as THREE.Material | undefined;
            material?.dispose();
        });
        this.texture.dispose();
    }
}
