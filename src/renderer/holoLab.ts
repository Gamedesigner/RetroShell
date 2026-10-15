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
    ceiling: 0x081227,
    collar: 0x0a1a3c,
    bolt: 0x2b4f88,
    pipe: 0x35588f,
    pipeDark: 0x22406e,
    magnetRed: 0x7a2f3e,
    magnetBlue: 0x2c4a8c,
    tray: 0x1d3562,
    windowFrame: 0x0a1530,
    sky: 0x13244d,
    monitorCase: 0x22345f,
    deskTop: 0x2c4c80,
    deskSide: 0x16295a,
};

// What the room's flat colours brighten towards in a lightning flash
const FLASH_COLOR = new THREE.Color(0x5a7ab8);
const FLASH_SKY = new THREE.Color(0xe2ecff);

// Made-up status lines for the wall monitors
const MONITOR_LINES = [
    'BEAM CURRENT  #.# mA', 'MAGNET ##     OK', 'VACUUM  #.#E-9 TORR', 'RF CAVITY #   SYNC',
    'SHIELD 1      OFF', 'SHIELD 2      ON', 'TARGET TEMP   ### K', 'INJECTOR      READY',
    'LOOP ##       STABLE', 'ORBIT DRIFT   0.0#', 'CRYO LEVEL    ##%', 'STORM CELL    ## KM',
    'PARTICLE E    ##%', 'SYNCHROTRON   ON', 'DETECTOR #    LIVE', 'KICKER        ARMED',
];
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
const ZOOM_RANGE = { min: 2.6, max: 7 };
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

// Faceted, lit material for the room's solid machinery
function lit(color: number): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

// A cylinder lying along the x or z axis, or standing along y
function tube(radius: number, length: number, axis: 'x' | 'y' | 'z', segments: number = 10): THREE.CylinderGeometry {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
    if (axis === 'x') geometry.rotateZ(Math.PI / 2);
    if (axis === 'z') geometry.rotateX(Math.PI / 2);
    return geometry;
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

    // The storm: rain down the window and now and then a lightning flash that
    // lights up the room
    private flashMaterials: { material: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
    private skyMaterial!: THREE.MeshBasicMaterial;
    private rainTexture!: THREE.CanvasTexture;
    private bolt!: THREE.Mesh;
    private lightning!: THREE.DirectionalLight;
    private ambient!: THREE.AmbientLight;
    private flashStart = -Infinity;
    private nextFlash = performance.now() + 6000;
    private lastUpdate = performance.now();

    // Wall monitors scrolling status lines
    private monitors: { ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture; lines: string[]; next: number }[] = [];

    constructor(parent: THREE.Object3D) {
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        this.ctx = this.canvas.getContext('2d')!;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        this.buildRoom();
        this.buildMachinery();
        this.buildWindow();
        this.buildMonitors();
        this.buildConsole();
        this.particle = this.buildBox();
        this.buildScientist();

        // The scientist and the machinery are lit: cool room light from behind
        // him, the display's green glow on his face, and the lightning through
        // the window. (three.js lights need about pi times the intensity for a
        // surface to show its full colour.)
        this.ambient = new THREE.AmbientLight(0x8090c0, 1.6);
        this.group.add(this.ambient);
        const glow = new THREE.DirectionalLight(0xb0f5aa, 3.5);
        glow.position.set(LAB_BOX_CENTER.x, LAB_BOX_CENTER.y + 0.4, LAB_BOX_CENTER.z + 0.6);
        glow.target.position.set(SEAT_POSITION.x, SEAT_POSITION.y + 0.9, SEAT_POSITION.z);
        const fill = new THREE.DirectionalLight(0xa0b0e0, 3.0);
        fill.position.set(-1, 4, 8);
        this.lightning = new THREE.DirectionalLight(0xdfe8ff, 0);
        this.lightning.position.set(8, 3, -3);
        this.group.add(glow, glow.target, fill, this.lightning);

        this.group.visible = false;
        parent.add(this.group);
    }

    // A flat colour that brightens with the lightning
    private roomFlat(color: number): THREE.MeshBasicMaterial {
        const material = flat(color);
        this.flashMaterials.push({ material, base: material.color.clone() });
        return material;
    }

    private buildRoom() {
        // Walls all round, sized so swinging the camera shows them rather than empty space
        const roomMaterial = new THREE.MeshBasicMaterial({ color: COLORS.wall, side: THREE.BackSide });
        this.flashMaterials.push({ material: roomMaterial, base: roomMaterial.color.clone() });
        const room = new THREE.Mesh(new THREE.BoxGeometry(16, 8.6, 22), roomMaterial);
        room.position.set(0, 2.7, 2.95);
        this.group.add(room);

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 22), this.roomFlat(COLORS.floor));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, -1.45, 2.95);
        this.group.add(floor);

        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, 22), this.roomFlat(COLORS.ceiling));
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(0, 6.95, 2.95);
        this.group.add(ceiling);

        // The great round vault door of the accelerator, behind the desk, in a
        // heavy bolted collar with hinges down its left side
        const door = new THREE.Group();
        door.position.set(2.8, 1.5, -7.9);
        door.add(new THREE.Mesh(new THREE.RingGeometry(4.7, 5.3, 48), this.roomFlat(COLORS.collar)));
        door.add(new THREE.Mesh(new THREE.RingGeometry(4.1, 4.7, 48), this.roomFlat(COLORS.doorRim)));
        door.add(new THREE.Mesh(new THREE.CircleGeometry(4.1, 48), this.roomFlat(COLORS.door)));
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const boltHead = new THREE.Mesh(new THREE.CircleGeometry(0.13, 8), this.roomFlat(COLORS.bolt));
            boltHead.position.set(Math.sin(angle) * 5.0, Math.cos(angle) * 5.0, 0.02);
            door.add(boltHead);
        }
        for (let i = 0; i < 8; i++) {
            const spoke = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 3.2), this.roomFlat(COLORS.doorSpoke));
            const angle = (i / 8) * Math.PI * 2;
            spoke.position.set(Math.sin(angle) * 2.5, Math.cos(angle) * 2.5, 0.01);
            spoke.rotation.z = -angle;
            door.add(spoke);
        }
        const hub = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), this.roomFlat(COLORS.doorHub));
        hub.position.z = 0.02;
        door.add(hub);
        const hubRim = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 24), this.roomFlat(COLORS.doorRim));
        hubRim.position.z = 0.02;
        door.add(hubRim);
        for (const y of [2.6, -2.6]) {
            const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.5), lit(COLORS.pipeDark));
            hinge.position.set(-4.4, y, 0.2);
            door.add(hinge);
        }
        this.group.add(door);

        // Tall panels at the left end of the back wall
        for (let i = 0; i < 2; i++) {
            const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 6), this.roomFlat(COLORS.sidePanel));
            panel.position.set(-7.2 + i * 1.15, 1.6, -8.0);
            this.group.add(panel);
        }
    }

    // The accelerator's beam pipe along the back wall, with its magnets, collars
    // and legs, plus pipes up the walls and conduits across the ceiling
    private buildMachinery() {
        const add = (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => {
            const mesh = new THREE.Mesh(geometry, lit(color));
            mesh.position.set(x, y, z);
            this.group.add(mesh);
        };

        // Beam pipe, running out through both side walls
        add(tube(0.42, 16, 'x', 14), COLORS.pipe, 0, -0.85, -6.7);
        for (let x = -7.2; x <= 7.2; x += 1.6) add(tube(0.52, 0.16, 'x', 14), COLORS.collar, x, -0.85, -6.7);
        for (let x = -6.4; x <= 6.4; x += 3.2) add(new THREE.BoxGeometry(0.14, 0.6, 0.14), COLORS.pipeDark, x, -1.15, -6.7);
        // Bending magnets around the pipe
        add(new THREE.BoxGeometry(1.2, 1.25, 1.25), COLORS.magnetRed, -5.4, -0.85, -6.7);
        add(new THREE.BoxGeometry(1.2, 1.25, 1.25), COLORS.magnetBlue, -1.4, -0.85, -6.7);
        add(new THREE.BoxGeometry(1.2, 1.25, 1.25), COLORS.magnetRed, 6.1, -0.85, -6.7);

        // Pipes up the back wall beside the door, and along the right wall
        add(tube(0.15, 8.4, 'y'), COLORS.pipe, -3.0, 2.75, -7.75);
        add(tube(0.1, 8.4, 'y'), COLORS.pipeDark, -3.4, 2.75, -7.8);
        add(tube(0.16, 8.4, 'y'), COLORS.pipe, 7.75, 2.75, -6.9);
        add(tube(0.12, 15, 'z'), COLORS.pipeDark, 7.8, 5.7, -0.5);

        // Conduits and a cable tray across the ceiling
        add(tube(0.13, 22, 'z'), COLORS.pipe, -2.2, 6.6, 2.95);
        add(tube(0.09, 22, 'z'), COLORS.pipeDark, -1.8, 6.65, 2.95);
        add(tube(0.16, 22, 'z'), COLORS.pipe, 5.2, 6.55, 2.95);
        add(new THREE.BoxGeometry(0.9, 0.08, 22), COLORS.tray, 3.4, 6.7, 2.95);
        // ...and one dropping down the back wall to the beam pipe
        add(tube(0.13, 7.4, 'y'), COLORS.pipe, -2.2, 3.0, -7.7);
    }

    // A tall window in the right wall, with the storm outside: rain running down
    // the glass and a lightning bolt that shows during a flash
    private buildWindow() {
        const pane = new THREE.Group();
        pane.position.set(7.95, 2.1, -3.2);
        pane.rotation.y = -Math.PI / 2;

        this.skyMaterial = new THREE.MeshBasicMaterial({ color: COLORS.sky });
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.4), this.skyMaterial);
        sky.position.z = -0.03;
        pane.add(sky);

        this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide }));
        this.bolt.position.z = -0.02;
        pane.add(this.bolt);

        // Rain streaks on a texture that scrolls down the glass
        const rainCanvas = document.createElement('canvas');
        rainCanvas.width = 256;
        rainCanvas.height = 512;
        const rain = rainCanvas.getContext('2d')!;
        rain.strokeStyle = 'rgba(170, 195, 255, 0.3)';
        rain.lineWidth = 1.5;
        for (let i = 0; i < 90; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 512;
            const length = 18 + Math.random() * 34;
            rain.beginPath();
            rain.moveTo(x, y);
            rain.lineTo(x - length * 0.12, y + length);
            rain.stroke();
        }
        this.rainTexture = new THREE.CanvasTexture(rainCanvas);
        this.rainTexture.wrapS = this.rainTexture.wrapT = THREE.RepeatWrapping;
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.4), new THREE.MeshBasicMaterial({ map: this.rainTexture, transparent: true, depthWrite: false }));
        glass.position.z = -0.01;
        pane.add(glass);

        // Frame, split into four panes
        const frame = this.roomFlat(COLORS.windowFrame);
        for (const [w, h, x, y] of [[3.7, 0.16, 0, 2.2], [3.7, 0.16, 0, -2.2], [0.16, 4.5, -1.75, 0], [0.16, 4.5, 1.75, 0], [0.1, 4.4, 0, 0], [3.4, 0.1, 0, 0.4]]) {
            const bar = new THREE.Mesh(new THREE.PlaneGeometry(w, h), frame);
            bar.position.set(x, y, 0);
            pane.add(bar);
        }
        this.group.add(pane);
    }

    // A jagged bolt from the top of the window, different every flash
    private makeBolt() {
        const points: THREE.Vector2[] = [];
        let x = (Math.random() - 0.5) * 1.6;
        const top = 2.2;
        const bottom = -0.6 - Math.random() * 1.2;
        const steps = 9;
        const spine: THREE.Vector2[] = [];
        for (let i = 0; i <= steps; i++) {
            spine.push(new THREE.Vector2(x, top + (bottom - top) * (i / steps)));
            x += (Math.random() - 0.5) * 0.5;
        }
        // A thin ribbon either side of the spine, tapering to a point
        for (let i = 0; i <= steps; i++) points.push(new THREE.Vector2(spine[i].x - 0.11 * (1 - i / steps) - 0.015, spine[i].y));
        for (let i = steps; i >= 0; i--) points.push(new THREE.Vector2(spine[i].x + 0.11 * (1 - i / steps) + 0.015, spine[i].y));
        this.bolt.geometry.dispose();
        this.bolt.geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
    }

    // Wall-mounted monitors, two on the back wall and one beside the window
    private buildMonitors() {
        const places: { x: number; y: number; z: number; turn: number }[] = [
            { x: -4.6, y: 0.5, z: -7.7, turn: 0 },
            { x: -4.6, y: 1.85, z: -7.7, turn: 0 },
            { x: 7.7, y: 1.3, z: 0.9, turn: -Math.PI / 2 },
        ];
        for (const place of places) {
            const monitor = new THREE.Group();
            monitor.position.set(place.x, place.y, place.z);
            monitor.rotation.y = place.turn;
            monitor.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.85, 0.45), lit(COLORS.monitorCase)));

            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 180;
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshBasicMaterial({ map: texture }));
            screen.position.z = 0.23;
            monitor.add(screen);
            this.group.add(monitor);

            this.monitors.push({ ctx: canvas.getContext('2d')!, texture, lines: [], next: 0 });
        }
    }

    // Scroll a new status line onto each monitor now and then
    private updateMonitors(now: number) {
        for (const monitor of this.monitors) {
            if (now < monitor.next) continue;
            monitor.next = now + 350 + Math.random() * 500;
            const template = MONITOR_LINES[Math.floor(Math.random() * MONITOR_LINES.length)];
            monitor.lines.push(template.replace(/#/g, () => String(Math.floor(Math.random() * 10))));
            if (monitor.lines.length > 9) monitor.lines.shift();

            const ctx = monitor.ctx;
            ctx.fillStyle = '#04140a';
            ctx.fillRect(0, 0, 256, 180);
            ctx.font = `15px ${TEXT_FONT}`;
            ctx.textBaseline = 'top';
            monitor.lines.forEach((line, i) => {
                ctx.fillStyle = i === monitor.lines.length - 1 ? '#c8ffc0' : TEXT_COLOR;
                ctx.fillText(line, 10, 8 + i * 18.5);
            });
            monitor.texture.needsUpdate = true;
        }
    }

    // Rain down the glass, and a double lightning flash every so often that
    // brightens the room, shows a bolt in the window and lights the scientist
    private updateStorm(now: number, dt: number) {
        this.rainTexture.offset.y += dt * 0.9;

        if (now >= this.nextFlash) {
            this.flashStart = now;
            this.nextFlash = now + 7000 + Math.random() * 9000;
            this.makeBolt();
        }
        const t = now - this.flashStart;
        const flash = t < 0 ? 0 : t < 80 ? 1 : t < 150 ? 0.15 : t < 260 ? 0.9 : t < 700 ? 0.9 * (1 - (t - 260) / 440) : 0;

        this.skyMaterial.color.set(COLORS.sky).lerp(FLASH_SKY, flash * 0.85);
        for (const { material, base } of this.flashMaterials) {
            material.color.copy(base).lerp(FLASH_COLOR, flash * 0.55);
        }
        (this.bolt.material as THREE.MeshBasicMaterial).opacity = flash > 0.3 ? flash : 0;
        this.lightning.intensity = flash * 7;
        this.ambient.intensity = 1.6 + flash * 1.5;
    }

    private buildConsole() {
        const top = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 1.5), this.roomFlat(COLORS.consoleTop));
        top.position.set(0.1, -1.0, 0.55);
        top.rotation.x = 0.14;
        this.group.add(top);

        const front = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 0.1), this.roomFlat(COLORS.consoleFront));
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
            return mesh;
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

        // His curved operator desk, wrapping round the chair: a top, a front
        // skirt down to the floor, rows of lit buttons, two dials and the keyboard
        const sweep = THREE.MathUtils.degToRad(75);
        const desk = new THREE.Shape();
        for (let i = 0; i <= 24; i++) {
            const a = -sweep + (2 * sweep * i) / 24;
            if (i === 0) desk.moveTo(Math.sin(a) * 1.05, -Math.cos(a) * 1.05);
            else desk.lineTo(Math.sin(a) * 1.05, -Math.cos(a) * 1.05);
        }
        for (let i = 24; i >= 0; i--) {
            const a = -sweep + (2 * sweep * i) / 24;
            desk.lineTo(Math.sin(a) * 0.55, -Math.cos(a) * 0.55);
        }
        const deskTop = new THREE.ExtrudeGeometry(desk, { depth: 0.06, bevelEnabled: false });
        deskTop.rotateX(-Math.PI / 2);
        part(deskTop, COLORS.deskTop, [0, 0.24, 0]);
        // Open-ended, so it is seen from inside as well as out
        const skirt = part(new THREE.CylinderGeometry(1.05, 1.05, 0.69, 24, 1, true, -sweep, 2 * sweep), COLORS.deskSide, [0, -0.105, 0]);
        (skirt.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;
        part(new THREE.BoxGeometry(0.52, 0.025, 0.16), COLORS.keyboard, [0, 0.31, 0.64]);

        for (const radius of [0.7, 0.8, 0.9]) {
            for (let i = 0; i < 16; i++) {
                const side = i < 8 ? -1 : 1;
                const a = side * THREE.MathUtils.degToRad(26 + (i % 8) * 6);
                const button = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.022), new THREE.MeshBasicMaterial({
                    color: INDICATOR_COLORS[Math.floor(Math.random() * INDICATOR_COLORS.length)], transparent: true, side: THREE.DoubleSide
                }));
                button.rotation.set(-Math.PI / 2, 0, -a);
                button.position.set(Math.sin(a) * radius, 0.305, Math.cos(a) * radius);
                button.userData.phase = Math.random() * Math.PI * 2;
                // Only some of them blink
                if (Math.random() < 0.4) this.indicators.push(button);
                figure.add(button);
            }
        }
        for (const side of [-1, 1]) {
            const a = side * THREE.MathUtils.degToRad(66);
            const dial = new THREE.Group();
            dial.position.set(Math.sin(a) * 0.84, 0.36, Math.cos(a) * 0.84);
            dial.rotation.set(-0.9, a, 0);
            dial.add(new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: 0xd8e0f0, side: THREE.DoubleSide })));
            const needle = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.05), new THREE.MeshBasicMaterial({ color: 0xe24a3a, side: THREE.DoubleSide }));
            needle.position.set(0, 0.018, 0.002);
            needle.rotation.z = side * 0.6;
            dial.add(needle);
            part(new THREE.BoxGeometry(0.18, 0.15, 0.04), COLORS.deskSide, [Math.sin(a) * 0.86, 0.34, Math.cos(a) * 0.86], [-0.9, a, 0]);
            figure.add(dial);
        }

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
        // The storm makes itself known soon after the display comes up
        this.nextFlash = this.bootStart + 4500;
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

        const dt = Math.min((now - this.lastUpdate) / 1000, 0.1);
        this.lastUpdate = now;
        this.updateStorm(now, dt);
        this.updateMonitors(now);

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
