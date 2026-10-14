import * as THREE from 'three';
import { LAB_COLS, LAB_ROWS } from './labSize';
import { HoloPalette } from './themes';

// LAB mode: the terminal (or the file graph) on a scientist's holographic display,
// in a lab drawn in the flat-polygon style of the 1991 game Another World (Out of
// This World). The room is flat colour with no lighting, the way the game was
// drawn; the scientist is low-poly and flat-shaded so he holds up from any angle.

export type LabContent = 'terminal' | 'files';

// The file graph in the display's own green
export const LAB_PALETTE: HoloPalette = { normal: 0x8ff08a, dim: 0x3f8f3f, prompt: 0xd2ffc8 };

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
    skin: 0xe0a07a,
    shirt: 0x2a3560,
    trousers: 0x1a2140,
    chair: 0x24365f,
    chairDark: 0x16223f,
    keyboard: 0x0e1a36,
};
const INDICATOR_COLORS = [0x5ff2f2, 0xffffff, 0x5ff2f2, 0xe24a3a, 0x5ff2f2, 0xffffff];

const TEXT_COLOR = '#a8f0a2';
const TEXT_DIM = 'rgba(130, 225, 130, 0.45)';
const TEXT_FONT = '"Perfect DOS VGA 437", Consolas, monospace';

// The display box, floating over the console. The file graph is scaled to stay
// within LAB_GRAPH_FIT of its centre.
const BOX_SIZE = new THREE.Vector3(3.2, 2.2, 2.2);
export const LAB_BOX_CENTER = new THREE.Vector3(0, 0.35, 0);
export const LAB_GRAPH_FIT = 1.0;

// The scientist's chair, in front of the console (1 unit is about a metre)
const SEAT_POSITION = new THREE.Vector3(-0.9, -1.0, 2.15);

// The camera orbits this point. Home is over the scientist's shoulder, his head
// in the left third of the frame and the display filling the rest.
const ORBIT_PIVOT = new THREE.Vector3(0.3, 0.2, 0.4);
const HOME_CAMERA = new THREE.Vector3(-0.94, -0.02, 3.54);
const YAW_RANGE = THREE.MathUtils.degToRad(60);
const PITCH_DOWN = THREE.MathUtils.degToRad(15);
const PITCH_UP = THREE.MathUtils.degToRad(25);
const ZOOM_RANGE = { min: 2.6, max: 8 };
// Swinging away from home pulls the camera back to this distance, so a side
// view takes in the whole box instead of staring into one wall of it
const SWING_RADIUS = 5.2;
const FLOOR_CLEARANCE = -1.25;

// Boot sequence timing, in seconds after entering the lab
const BOOT_ID_END = 1.7;
const BOOT_END = 3.1;

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 704;
const MARGIN = 26;

function flat(color: number, opacity: number = 1): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
}

// Camera placement around the pivot
interface Orbit {
    yaw: number;
    pitch: number;
    radius: number;
}

function orbitOf(position: THREE.Vector3): Orbit {
    const offset = position.clone().sub(ORBIT_PIVOT);
    const radius = offset.length();
    return { yaw: Math.atan2(offset.x, offset.z), pitch: Math.asin(offset.y / radius), radius };
}

const HOME_ORBIT = orbitOf(HOME_CAMERA);

export class HoloLabScene {
    public readonly group = new THREE.Group();

    private canvas = document.createElement('canvas');
    private ctx: CanvasRenderingContext2D;
    private texture: THREE.CanvasTexture;
    private screen!: THREE.Mesh;
    private particle: THREE.Mesh;
    private indicators: THREE.Mesh[] = [];
    private content: LabContent = 'terminal';

    // Where the camera is heading and where it is now, eased towards it
    private orbitGoal: Orbit = { ...HOME_ORBIT };
    private orbitNow: Orbit = { ...HOME_ORBIT };

    private lines: string[] = [];
    private cursor = { row: 0, col: 0 };
    private drawnKey = '';
    private bootStart = -Infinity;
    private greeting = 'Good evening.';

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

        // Only the scientist is lit: cool room light from behind him, and the
        // display's green glow on his face. (three.js lights need about pi times
        // the intensity for a surface to show its full colour.)
        this.group.add(new THREE.AmbientLight(0x8090c0, 1.6));
        const glow = new THREE.DirectionalLight(0xb0f5aa, 3.5);
        glow.position.set(LAB_BOX_CENTER.x, LAB_BOX_CENTER.y + 0.4, LAB_BOX_CENTER.z + 0.6);
        glow.target.position.set(SEAT_POSITION.x, SEAT_POSITION.y + 0.9, SEAT_POSITION.z);
        const fill = new THREE.DirectionalLight(0xa0b0e0, 3.0);
        fill.position.set(-1, 4, 8);
        this.group.add(glow, glow.target, fill);

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
        box.position.copy(LAB_BOX_CENTER);

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
        this.screen = screen;

        // A shard of the experiment drifting inside the box
        const particle = new THREE.Mesh(
            new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.07), new THREE.Vector2(0.2, -0.02), new THREE.Vector2(0.02, -0.05)])),
            new THREE.MeshBasicMaterial({ color: COLORS.particle, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
        );
        box.add(particle);

        this.group.add(box);
        return particle;
    }

    // The scientist in his chair at the console: low-poly solids with flat shading,
    // built facing +z with the seat top at y = 0 and the floor at y = -0.45
    private buildScientist() {
        const figure = new THREE.Group();
        const part = (
            geometry: THREE.BufferGeometry, color: number,
            position: [number, number, number], rotation: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]
        ) => {
            const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, flatShading: true }));
            mesh.position.set(...position);
            mesh.rotation.set(...rotation);
            mesh.scale.set(...scale);
            figure.add(mesh);
        };

        // Chair
        part(new THREE.BoxGeometry(0.5, 0.07, 0.48), COLORS.chair, [0, -0.035, 0]);
        // A low back, so his shoulders show above it
        part(new THREE.BoxGeometry(0.42, 0.3, 0.05), COLORS.chair, [0, 0.21, -0.26], [-0.12, 0, 0]);
        part(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 6), COLORS.chairDark, [0, -0.25, 0]);
        part(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 5), COLORS.chairDark, [0, -0.43, 0]);

        // Legs
        part(new THREE.BoxGeometry(0.36, 0.13, 0.46), COLORS.trousers, [0, 0.07, 0.12]);
        part(new THREE.BoxGeometry(0.32, 0.42, 0.12), COLORS.trousers, [0, -0.2, 0.36]);

        // Body, leaning a little towards the display
        part(new THREE.CylinderGeometry(0.17, 0.15, 0.48, 6), COLORS.shirt, [0, 0.38, -0.02], [0.1, 0, 0], [1, 1, 0.72]);
        part(new THREE.BoxGeometry(0.46, 0.11, 0.24), COLORS.shirt, [0, 0.61, 0], [0.1, 0, 0]);

        // Arms reaching forward to the keyboard
        for (const side of [-1, 1]) {
            part(new THREE.BoxGeometry(0.1, 0.32, 0.1), COLORS.shirt, [side * 0.25, 0.47, 0.08], [-0.55, 0, side * 0.08]);
            part(new THREE.BoxGeometry(0.09, 0.09, 0.32), COLORS.shirt, [side * 0.21, 0.33, 0.33]);
            part(new THREE.BoxGeometry(0.08, 0.04, 0.1), COLORS.skin, [side * 0.18, 0.32, 0.53]);
        }

        // Neck, head, nose and ears
        part(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 6), COLORS.skin, [0, 0.72, 0.01]);
        part(new THREE.IcosahedronGeometry(0.15, 1), COLORS.skin, [0, 0.88, 0.02], [0, 0, 0], [0.9, 1.12, 1]);
        part(new THREE.TetrahedronGeometry(0.035), COLORS.skin, [0, 0.87, 0.17], [0.6, 0.8, 0]);
        for (const side of [-1, 1]) {
            part(new THREE.BoxGeometry(0.03, 0.065, 0.05), COLORS.skin, [side * 0.135, 0.87, 0]);
        }

        // Hair: a big swept red mass with a tuft at the front
        part(new THREE.IcosahedronGeometry(0.17, 0), COLORS.hair, [0, 0.97, -0.03], [0.3, 0.2, 0], [1, 0.72, 1.12]);
        part(new THREE.IcosahedronGeometry(0.13, 0), COLORS.hair, [0, 0.87, -0.1], [0, 0.5, 0], [1.08, 1, 0.8]);
        part(new THREE.TetrahedronGeometry(0.12), COLORS.hair, [0.02, 1.06, 0.1], [-0.7, 0.4, 0.3]);
        for (const side of [-1, 1]) {
            part(new THREE.TetrahedronGeometry(0.08), COLORS.hair, [side * 0.12, 0.99, -0.02], [0.2, side, 0.3]);
        }

        // Keyboard ledge in front of him
        part(new THREE.BoxGeometry(1.0, 0.05, 0.36), COLORS.consoleTop, [0, 0.28, 0.62]);
        part(new THREE.BoxGeometry(0.52, 0.025, 0.16), COLORS.keyboard, [0, 0.315, 0.58]);

        figure.position.copy(SEAT_POSITION);
        figure.lookAt(new THREE.Vector3(LAB_BOX_CENTER.x, SEAT_POSITION.y, LAB_BOX_CENTER.z));
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

    // What the display shows once it has booted
    public setContent(content: LabContent) {
        this.content = content;
    }

    public isBooting(): boolean {
        return (performance.now() - this.bootStart) / 1000 < BOOT_END;
    }

    // Drag swings the camera around the display and it stays where it is left
    public orbitBy(dx: number, dy: number) {
        const goal = this.orbitGoal;
        goal.yaw = THREE.MathUtils.clamp(goal.yaw - dx * 0.005, HOME_ORBIT.yaw - YAW_RANGE, HOME_ORBIT.yaw + YAW_RANGE);
        goal.pitch = THREE.MathUtils.clamp(goal.pitch + dy * 0.004, HOME_ORBIT.pitch - PITCH_DOWN, HOME_ORBIT.pitch + PITCH_UP);
    }

    public zoomBy(deltaY: number) {
        const goal = this.orbitGoal;
        goal.radius = THREE.MathUtils.clamp(goal.radius * (1 + deltaY * 0.001), ZOOM_RANGE.min, ZOOM_RANGE.max);
    }

    // Back to the over-the-shoulder shot
    public resetView() {
        this.orbitGoal = { ...HOME_ORBIT };
    }

    public update(camera: THREE.PerspectiveCamera) {
        const now = performance.now();
        const t = now / 1000;

        // Ease towards the goal, with a slow handheld drift on top
        const view = this.orbitNow;
        for (const key of ['yaw', 'pitch', 'radius'] as const) {
            view[key] += (this.orbitGoal[key] - view[key]) * 0.15;
        }
        const swing = Math.min(Math.abs(view.yaw - HOME_ORBIT.yaw) / YAW_RANGE, 1);
        const radius = view.radius + Math.max(SWING_RADIUS - view.radius, 0) * swing;
        camera.position.set(
            ORBIT_PIVOT.x + radius * Math.cos(view.pitch) * Math.sin(view.yaw) + Math.sin(t * 0.31) * 0.03,
            ORBIT_PIVOT.y + radius * Math.sin(view.pitch) + Math.sin(t * 0.23) * 0.02,
            ORBIT_PIVOT.z + radius * Math.cos(view.pitch) * Math.cos(view.yaw) + Math.sin(t * 0.17) * 0.03
        );
        camera.position.y = Math.max(camera.position.y, FLOOR_CLEARANCE);
        camera.lookAt(ORBIT_PIVOT);

        // The boot sequence always shows; after it the box holds the terminal or the graph
        this.screen.visible = this.content === 'terminal' || this.isBooting();

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

    // Boot banner typed out line by line, in the middle of the display where the
    // shot over the shoulder always shows it
    private drawBanner(t: number, now: number) {
        const banner = ['RetroShell (c) 2026 Retro Systems.', 'All rights reserved.', '', 'RS-DOS Version 1.0'];
        this.beginFrame();
        this.setFont();
        let budget = Math.floor(t * 70);
        let row = Math.floor((LAB_ROWS - banner.length) / 2) - 2;
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
