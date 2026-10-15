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

// The car lift in the floor under the window. Its platform brings the car up
// from the pit while the lab boots.
const FLOOR_Y = -1.45;
const PIT = { minX: 4.4, maxX: 7.2, minZ: -5.6, maxZ: -0.4, depth: 2.3 };
const LIFT_DOWN = -3.6;
const LIFT_UP = FLOOR_Y;
const LIFT_DELAY = 600;
const LIFT_TIME = 4000;

// The accelerator program, in seconds after it opens: the particle is
// injected, sped round the ring, then fired at the lab
const INJECT_END = 1.8;
const ACCEL_END = 8.0;
const EJECT_END = 8.8;
const SURGE_END = 11.0;
// The ring turns it eight times less a third, ending where the exit line leaves
const ACCEL_SWEEP = Math.PI * 2 * 8 - (Math.PI * 2) / 3;
const ACCEL_START_SPEED = 2;

// Where the mouse sits on the desk, in the scientist's own frame
const MOUSE_SPOT = new THREE.Vector3(-0.36, 0.322, 0.6);

// The game's screen on the front of the display, lowered to leave the close
// cube a strip along the top
const GAME_SCREEN = { width: 2.7, y: -0.2 };

// One of his forearms and hands, posed from the elbow towards a target
interface Arm {
    forearm: THREE.Mesh;
    hand: THREE.Mesh;
    elbow: THREE.Vector3;
    home: THREE.Vector3;
    key: THREE.Vector3;
    pressedAt: number;
}

// What the display shows: the boot sequence, the two program cubes, the
// accelerator experiment, or the terminal / file graph
export type LabScreen = 'boot' | 'home' | 'accelerator' | 'program' | 'game';

// A clickable cube floating in the display
interface LabButton {
    opens: LabScreen;
    showOn: LabScreen[];
    group: THREE.Group;
    pick: THREE.Mesh;
    edges: THREE.LineBasicMaterial;
    fill: THREE.MeshBasicMaterial;
    cross: THREE.MeshBasicMaterial | null;
    // Drawn when first shown, once the display font has loaded
    label: { sprite: THREE.Sprite; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture; text: string; drawn: string } | null;
    spin: boolean;
    appear: number;
    hover: number;
}

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

    // The scientist's hands follow your typing and your mouse
    private figure!: THREE.Group;
    private leftArm!: Arm;
    private rightArm!: Arm;
    private mouse!: THREE.Mesh;
    private mouseGoal = 0;
    private mouseInUse = 0;
    private mouseSlide = new THREE.Vector2();

    // The car lift, and the warning lights that flash while it moves
    private lift!: THREE.Group;
    private beacons: THREE.MeshBasicMaterial[] = [];

    // The display's program cubes and the experiment
    private box!: THREE.Group;
    private gameScreen!: THREE.Mesh;
    private gameTexture!: THREE.CanvasTexture;
    private labScreen: LabScreen = 'home';
    private buttons: LabButton[] = [];
    private hovered: LabButton | null = null;
    private experimentStart = 0;
    private struck = false;
    private flashStrength = 0.55;
    private shakeUntil = 0;
    public onScreenChange: (() => void) | null = null;

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
        this.buildLauncher();
        this.buildScientist();
        this.buildLift();
        this.buildSodaMachine();

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
        // (It reaches down below the floor, so the car lift's pit has room to show)
        const room = new THREE.Mesh(new THREE.BoxGeometry(16, 11, 22), roomMaterial);
        room.position.set(0, 1.5, 2.95);
        this.group.add(room);

        // The floor, with a hole for the car lift's pit
        const floorShape = new THREE.Shape([
            new THREE.Vector2(-8, -11), new THREE.Vector2(8, -11), new THREE.Vector2(8, 11), new THREE.Vector2(-8, 11),
        ]);
        floorShape.holes.push(new THREE.Path([
            new THREE.Vector2(PIT.minX, 2.95 - PIT.maxZ), new THREE.Vector2(PIT.maxX, 2.95 - PIT.maxZ),
            new THREE.Vector2(PIT.maxX, 2.95 - PIT.minZ), new THREE.Vector2(PIT.minX, 2.95 - PIT.minZ),
        ]));
        const floor = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), this.roomFlat(COLORS.floor));
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
            this.flashStrength = 0.55;
            this.nextFlash = now + 7000 + Math.random() * 9000;
            this.makeBolt();
        }
        const t = now - this.flashStart;
        const flash = t < 0 ? 0 : t < 80 ? 1 : t < 150 ? 0.15 : t < 260 ? 0.9 : t < 700 ? 0.9 * (1 - (t - 260) / 440) : 0;

        this.skyMaterial.color.set(COLORS.sky).lerp(FLASH_SKY, flash * 0.85);
        for (const { material, base } of this.flashMaterials) {
            material.color.copy(base).lerp(FLASH_COLOR, flash * this.flashStrength);
        }
        (this.bolt.material as THREE.MeshBasicMaterial).opacity = flash > 0.3 ? flash : 0;
        this.lightning.intensity = flash * 7 * (this.flashStrength / 0.55);
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

        // The game's screen, in its own colours on the front of the box, under
        // the strip where the close cube sits
        this.gameTexture = new THREE.CanvasTexture(document.createElement('canvas'));
        this.gameTexture.colorSpace = THREE.SRGBColorSpace;
        this.gameScreen = new THREE.Mesh(
            new THREE.PlaneGeometry(GAME_SCREEN.width, (GAME_SCREEN.width * 200) / 320),
            new THREE.MeshBasicMaterial({ map: this.gameTexture })
        );
        this.gameScreen.position.set(0, GAME_SCREEN.y, BOX_SIZE.z / 2 + 0.005);
        this.gameScreen.visible = false;
        box.add(this.gameScreen);

        this.group.add(box);
        this.box = box;
        return particle;
    }

    // The program cubes floating in the display, as in the game: the
    // accelerator, the file browser (terminal or graph) and the game. While one
    // is open, a small cube with an X in the top right corner closes it.
    private buildLauncher() {
        const make = (size: number, position: [number, number, number], opens: LabScreen, showOn: LabScreen[], text: string | null): LabButton => {
            const group = new THREE.Group();
            group.position.set(...position);
            const geometry = new THREE.BoxGeometry(size, size, size);
            const edges = new THREE.LineBasicMaterial({ color: COLORS.boxEdge, transparent: true, opacity: 0 });
            group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edges));
            const fill = new THREE.MeshBasicMaterial({ color: COLORS.boxEdge, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
            const pick = new THREE.Mesh(geometry, fill);
            group.add(pick);
            this.box.add(group);

            // The label sits over the cube without turning with it
            let label: LabButton['label'] = null;
            if (text !== null) {
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 64;
                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.SRGBColorSpace;
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false }));
                sprite.scale.set(1.2, 0.15, 1);
                sprite.position.set(position[0], position[1] + size * 0.95, position[2]);
                sprite.renderOrder = 2;
                this.box.add(sprite);
                label = { sprite, ctx: canvas.getContext('2d')!, texture, text, drawn: '' };
            }
            const button: LabButton = { opens, showOn, group, pick, edges, fill, cross: null, label, spin: text !== null, appear: 0, hover: 0 };
            this.buttons.push(button);
            return button;
        };

        // Set right of centre and high, clear of his head in the shot over his shoulder
        make(0.44, [-0.75, 0.2, 0.15], 'accelerator', ['home'], 'ACCELERATOR');
        make(0.44, [0.15, 0.2, 0.15], 'program', ['home'], 'TERMINAL');
        make(0.44, [1.05, 0.2, 0.15], 'game', ['home'], 'OUT OF THIS WORLD');

        const close = make(0.2, [BOX_SIZE.x / 2 - 0.2, BOX_SIZE.y / 2 - 0.19, BOX_SIZE.z / 2 - 0.11], 'home', ['accelerator', 'program', 'game'], null);
        close.cross = new THREE.MeshBasicMaterial({ color: COLORS.boxEdge, transparent: true, opacity: 0, side: THREE.DoubleSide });
        for (const angle of [Math.PI / 4, -Math.PI / 4]) {
            const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.024), close.cross);
            bar.position.z = 0.101;
            bar.rotation.z = angle;
            close.group.add(bar);
        }
        close.group.rotation.set(0.2, -0.35, 0);
    }

    private updateLauncher(t: number) {
        const program = this.buttons[1].label!;
        program.text = this.content === 'files' ? 'FILES' : 'TERMINAL';

        this.buttons.forEach((button, i) => {
            const shown = button.showOn.includes(this.labScreen);
            button.appear += ((shown ? 1 : 0) - button.appear) * 0.18;
            if (!shown && button.appear < 0.01) button.appear = 0;
            button.hover += ((shown && this.hovered === button ? 1 : 0) - button.hover) * 0.2;

            button.group.visible = button.appear > 0;
            button.group.scale.setScalar(Math.max(button.appear, 0.001) * (1 + button.hover * 0.15));
            if (button.spin) button.group.rotation.set(0.45 + Math.sin(t * 0.6 + i) * 0.1, t * 0.35 + i * 0.8, 0);
            button.edges.opacity = (0.55 + 0.45 * button.hover) * button.appear;
            button.fill.opacity = (0.05 + 0.15 * button.hover) * button.appear;
            if (button.cross) button.cross.opacity = button.edges.opacity;

            const label = button.label;
            if (label) {
                (label.sprite.material as THREE.SpriteMaterial).opacity = button.hover * button.appear;
                label.sprite.visible = button.hover > 0.01;
                if (label.sprite.visible && label.drawn !== label.text) {
                    label.drawn = label.text;
                    const ctx = label.ctx;
                    ctx.clearRect(0, 0, 512, 64);
                    ctx.font = `38px ${TEXT_FONT}`;
                    ctx.letterSpacing = '4px';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#d2ffc8';
                    ctx.fillText(label.text, 256, 34);
                    label.texture.needsUpdate = true;
                }
            }
        });
    }

    // The car lift under the window: hazard stripes round a pit in the floor,
    // a frame of posts with warning lights on top, and the platform with the car
    private buildLift() {
        const width = PIT.maxX - PIT.minX;
        const length = PIT.maxZ - PIT.minZ;
        const cx = (PIT.minX + PIT.maxX) / 2;
        const cz = (PIT.minZ + PIT.maxZ) / 2;

        // The shaft, drawn from inside only so its open top looks down into it
        const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0x050c22, side: THREE.BackSide });
        this.flashMaterials.push({ material: shaftMaterial, base: shaftMaterial.color.clone() });
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(width, PIT.depth, length), shaftMaterial);
        shaft.position.set(cx, FLOOR_Y - PIT.depth / 2, cz);
        this.group.add(shaft);

        const stripes = document.createElement('canvas');
        stripes.width = 64;
        stripes.height = 16;
        const s = stripes.getContext('2d')!;
        s.fillStyle = '#16182a';
        s.fillRect(0, 0, 64, 16);
        s.fillStyle = '#b8902a';
        for (let x = -16; x < 64; x += 32) {
            s.beginPath();
            s.moveTo(x, 16);
            s.lineTo(x + 16, 0);
            s.lineTo(x + 32, 0);
            s.lineTo(x + 16, 16);
            s.fill();
        }
        const edge = 0.22;
        const strips: [number, number, number, number][] = [
            [width + edge * 2, cx, PIT.minZ - edge / 2, 0], [width + edge * 2, cx, PIT.maxZ + edge / 2, 0],
            [length, PIT.minX - edge / 2, cz, Math.PI / 2], [length, PIT.maxX + edge / 2, cz, Math.PI / 2],
        ];
        for (const [stripLength, x, z, turn] of strips) {
            const texture = new THREE.CanvasTexture(stripes);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = THREE.RepeatWrapping;
            texture.repeat.set(stripLength / 0.5, 1);
            const strip = new THREE.Mesh(new THREE.PlaneGeometry(stripLength, edge), new THREE.MeshBasicMaterial({ map: texture }));
            strip.rotation.set(-Math.PI / 2, 0, turn);
            strip.position.set(x, FLOOR_Y + 0.005, z);
            this.group.add(strip);
        }

        // Posts at the corners, joined across the top, with a warning light on
        // each front post
        const frame = lit(COLORS.pipeDark);
        const height = 2.8;
        const left = PIT.minX - 0.12;
        const right = PIT.maxX + 0.12;
        const back = PIT.minZ - 0.12;
        const front = PIT.maxZ + 0.12;
        for (const x of [left, right]) {
            for (const z of [back, front]) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, height, 0.14), frame);
                post.position.set(x, FLOOR_Y + height / 2, z);
                this.group.add(post);
            }
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, front - back), frame);
            rail.position.set(x, FLOOR_Y + height - 0.05, cz);
            this.group.add(rail);

            const beacon = new THREE.MeshBasicMaterial({ color: 0xffa030 });
            const light = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 8), beacon);
            light.position.set(x, FLOOR_Y + height + 0.07, front);
            this.group.add(light);
            this.beacons.push(beacon);
        }
        const crossbar = new THREE.Mesh(new THREE.BoxGeometry(right - left, 0.12, 0.12), frame);
        crossbar.position.set(cx, FLOOR_Y + height - 0.05, back);
        this.group.add(crossbar);

        // The platform, with the car parked nose out towards the room
        this.lift = new THREE.Group();
        this.lift.position.set(cx, LIFT_UP, cz);
        const platform = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 0.12, length - 0.08), lit(0x22325a));
        platform.position.y = -0.06;
        this.lift.add(platform);
        const car = this.buildCar();
        car.rotation.y = -Math.PI / 2;
        this.lift.add(car);
        this.group.add(this.lift);
    }

    // Up from the pit over a few seconds after the lab boots, warning lights
    // flashing while it moves
    private updateLift(now: number) {
        const k = THREE.MathUtils.clamp((now - this.bootStart - LIFT_DELAY) / LIFT_TIME, 0, 1);
        const eased = k * k * (3 - 2 * k);
        this.lift.position.y = LIFT_DOWN + (LIFT_UP - LIFT_DOWN) * eased;
        const moving = k > 0 && k < 1;
        const on = moving && Math.floor(now / 250) % 2 === 0;
        for (const beacon of this.beacons) beacon.color.setHex(on ? 0xffb040 : moving ? 0x5a3010 : 0x7a4818);
    }

    // A low red 80s wedge, after the silhouette of the car parked outside the
    // lab in the game: a long nose, the cabin a little forward of centre and a
    // long sloping rear deck with a lip at the tail. Built nose along +x with
    // the ground at y = 0. No badges.
    private buildCar(): THREE.Group {
        const car = new THREE.Group();
        const red = 0xc8161d;
        const glass = lit(0x0b1631);
        glass.side = THREE.DoubleSide;
        const extrude = (points: [number, number][], depth: number, color: number) => {
            const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))), {
                depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 1, curveSegments: 1,
            });
            geometry.translate(0, 0, -depth / 2);
            car.add(new THREE.Mesh(geometry, lit(color)));
        };

        // Wheel arches along the bottom edge, from the back of each round to the front
        const arch = (x: number): [number, number][] => {
            const points: [number, number][] = [];
            for (let i = 0; i <= 8; i++) {
                const a = Math.PI - (i / 8) * Math.PI;
                points.push([x + Math.cos(a) * 0.37, 0.33 + Math.sin(a) * 0.37]);
            }
            return points;
        };
        extrude([
            [2.2, 0.3], [2.17, 0.43], [1.3, 0.63], [0.62, 0.77], [-0.55, 0.8], [-0.85, 0.98], [-1.4, 0.88],
            [-2.02, 0.76], [-2.17, 0.84], [-2.21, 0.58], [-2.14, 0.22], [-1.86, 0.17],
            ...arch(-1.46), [-1.06, 0.17], [0.9, 0.17], ...arch(1.29), [1.69, 0.19], [2.12, 0.22],
        ], 1.84, red);
        // The cabin, narrower than the body
        extrude([[0.66, 0.74], [0.1, 1.06], [-0.7, 1.05], [-0.84, 0.76]], 1.34, red);

        // Glass: a pane laid along a slope of the cabin's profile, spanning its width
        const pane = (from: [number, number], to: [number, number], across: number) => {
            const along = new THREE.Vector3(to[0] - from[0], to[1] - from[1], 0);
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(along.length() * 0.9, across), glass);
            along.normalize();
            const out = new THREE.Vector3(along.y, -along.x, 0);
            mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, new THREE.Vector3(0, 0, 1), out));
            mesh.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0).addScaledVector(out, 0.03);
            car.add(mesh);
        };
        pane([0.66, 0.74], [0.1, 1.06], 1.22);
        pane([-0.7, 1.05], [-0.84, 0.76], 1.1);
        for (const side of [-1, 1]) {
            const sideWindow = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([
                new THREE.Vector2(0.55, 0.8), new THREE.Vector2(0.13, 1.0), new THREE.Vector2(-0.6, 1.0), new THREE.Vector2(-0.7, 0.8),
            ])), glass);
            sideWindow.position.z = side * 0.705;
            car.add(sideWindow);

            // Strakes along the doors, in front of the rear wheels
            for (let i = 0; i < 5; i++) {
                const strake = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.025), lit(0x2a0508));
                strake.position.set(-0.45, 0.42 + i * 0.06, side * 0.956);
                if (side < 0) strake.rotation.y = Math.PI;
                car.add(strake);
            }

            for (const x of [1.29, -1.46]) {
                const tyre = new THREE.Mesh(tube(0.33, 0.26, 'z', 14), lit(0x0a0f1e));
                tyre.position.set(x, 0.33, side * 0.82);
                car.add(tyre);
                const hub = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10), lit(0x6878a0));
                hub.position.set(x, 0.33, side * 0.952);
                if (side < 0) hub.rotation.y = Math.PI;
                car.add(hub);
            }

            // Lamps in the nose, and tail lights in a black panel across the back
            const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.07), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
            lamp.position.set(2.235, 0.36, side * 0.6);
            lamp.rotation.y = Math.PI / 2;
            car.add(lamp);
            const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.08), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
            tail.position.set(-2.255, 0.7, side * 0.55);
            tail.rotation.y = -Math.PI / 2;
            car.add(tail);
        }
        const grille = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.16), new THREE.MeshBasicMaterial({ color: 0x14080a }));
        grille.position.set(-2.25, 0.7, 0);
        grille.rotation.y = -Math.PI / 2;
        car.add(grille);
        return car;
    }

    // The soda machine against the left wall, its front lit up in the dark
    private buildSodaMachine() {
        const machine = new THREE.Group();
        machine.position.set(-7.55, FLOOR_Y, -4.5);
        machine.rotation.y = Math.PI / 2;
        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.95, 0.8), lit(0xa3141b));
        cabinet.position.y = 0.975;
        machine.add(cabinet);

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 400;
        const c = canvas.getContext('2d')!;
        c.fillStyle = '#e8221e';
        c.fillRect(0, 0, 256, 400);
        // A big can down the left, with a white wave across it
        c.fillStyle = '#a80c16';
        c.beginPath();
        c.roundRect(24, 76, 120, 250, 16);
        c.fill();
        c.fillStyle = '#c8ccd8';
        c.fillRect(30, 76, 108, 12);
        c.fillRect(30, 314, 108, 12);
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(24, 200);
        c.bezierCurveTo(60, 150, 100, 250, 144, 180);
        c.lineTo(144, 208);
        c.bezierCurveTo(100, 278, 60, 178, 24, 228);
        c.closePath();
        c.fill();
        c.textAlign = 'center';
        c.font = 'bold 56px Arial, sans-serif';
        c.fillText('SODA', 128, 56);
        c.font = 'bold 26px Arial, sans-serif';
        c.fillText('ICE COLD', 96, 372);
        // Selection buttons and the coin slot down the right
        for (let i = 0; i < 6; i++) {
            c.fillStyle = '#fff2e6';
            c.fillRect(168, 82 + i * 38, 64, 28);
            c.fillStyle = i % 2 ? '#e8221e' : '#2a2a48';
            c.fillRect(174, 88 + i * 38, 14, 16);
        }
        c.fillStyle = '#1a0608';
        c.fillRect(196, 322, 10, 30);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const front = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.25), new THREE.MeshBasicMaterial({ map: texture }));
        front.position.set(0, 1.2, 0.401);
        machine.add(front);

        // Where the cans drop out, and a kick plate along the bottom
        const dark = new THREE.MeshBasicMaterial({ color: 0x1a0608 });
        const tray = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.24), dark);
        tray.position.set(0, 0.36, 0.401);
        machine.add(tray);
        const kick = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.1), dark);
        kick.position.set(0, 0.05, 0.401);
        machine.add(kick);
        this.group.add(machine);
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

        // Upper arms. The forearms and hands are posed every frame by updateHands()
        // so he types when you type and works the mouse when you use yours.
        // Facing +z, his left is +x and his right is -x.
        for (const side of [-1, 1]) {
            part(new THREE.BoxGeometry(0.1, 0.32, 0.1), COLORS.shirt, [side * 0.25, 0.47, 0.08], [-0.55, 0, side * 0.08]);
        }
        for (const side of [1, -1]) {
            const arm: Arm = {
                forearm: part(new THREE.BoxGeometry(0.09, 0.09, 0.32), COLORS.shirt, [side * 0.21, 0.33, 0.33]),
                hand: part(new THREE.BoxGeometry(0.08, 0.04, 0.1), COLORS.skin, [side * 0.14, 0.335, 0.62]),
                elbow: new THREE.Vector3(side * 0.25, 0.335, 0.165),
                home: new THREE.Vector3(side * 0.14, 0.335, 0.62),
                key: new THREE.Vector3(),
                pressedAt: -Infinity,
            };
            if (side === 1) this.leftArm = arm;
            else this.rightArm = arm;
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

        // The mouse on its pad by his right hand, and a can of soda by his left
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.17), new THREE.MeshBasicMaterial({ color: 0x0b1428, side: THREE.DoubleSide }));
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(MOUSE_SPOT.x, 0.302, MOUSE_SPOT.z);
        figure.add(pad);
        this.mouse = part(new THREE.BoxGeometry(0.05, 0.03, 0.08), COLORS.keyboard, [MOUSE_SPOT.x, MOUSE_SPOT.y, MOUSE_SPOT.z]);
        part(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10), 0xc8161d, [0.28, 0.36, 0.86]);
        part(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 10), 0xf0f0f0, [0.28, 0.37, 0.86]);
        part(new THREE.CylinderGeometry(0.03, 0.033, 0.01, 10), 0xb8c0d0, [0.28, 0.425, 0.86]);

        for (const radius of [0.7, 0.8, 0.9]) {
            for (let i = 0; i < 16; i++) {
                const side = i < 8 ? -1 : 1;
                // Leave room for the mouse pad
                if (side === -1 && radius < 0.85 && i % 8 < 2) continue;
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
        this.figure = figure;
    }

    // Typing: a hand dips onto a key near where it rests. His right hand also
    // leaves the mouse for the keyboard.
    public keyPressed() {
        this.mouseGoal = 0;
        const arm = this.mouseInUse > 0.5 || Math.random() < 0.5 ? this.leftArm : this.rightArm;
        arm.pressedAt = performance.now();
        arm.key.set((Math.random() - 0.5) * 0.16, 0, (Math.random() - 0.5) * 0.07);
    }

    // The mouse in the 3D view moves his right hand to the desk's mouse, which
    // slides the way yours does (seen from behind him, your right is his right)
    public pointerMoved(dx: number, dy: number) {
        this.mouseGoal = 1;
        this.mouseSlide.x = THREE.MathUtils.clamp(this.mouseSlide.x - dx * 0.0006, -0.06, 0.06);
        this.mouseSlide.y = THREE.MathUtils.clamp(this.mouseSlide.y - dy * 0.0006, -0.05, 0.05);
    }

    public pointerClicked() {
        this.mouseGoal = 1;
        this.rightArm.pressedAt = performance.now();
        this.rightArm.key.set(0, 0, 0);
    }

    private updateHands(now: number) {
        this.figure.updateMatrixWorld();
        this.mouseInUse += (this.mouseGoal - this.mouseInUse) * 0.12;
        // The mouse drifts back to the middle of its pad
        this.mouseSlide.multiplyScalar(0.97);
        this.mouse.position.set(MOUSE_SPOT.x + this.mouseSlide.x, MOUSE_SPOT.y, MOUSE_SPOT.z + this.mouseSlide.y);

        for (const arm of [this.leftArm, this.rightArm]) {
            const since = now - arm.pressedAt;
            const tapping = since < 150;
            const target = arm.home.clone();
            if (tapping) target.add(arm.key);
            if (arm === this.rightArm) {
                target.lerp(this.mouse.position.clone().add(new THREE.Vector3(0, 0.03, -0.015)), this.mouseInUse);
            }
            if (tapping) target.y -= Math.sin((since / 150) * Math.PI) * 0.022;

            // Hand at the target, forearm stretched from the elbow to it
            arm.hand.position.copy(target);
            arm.forearm.position.copy(arm.elbow).add(target).multiplyScalar(0.5);
            arm.forearm.lookAt(this.figure.localToWorld(target.clone()));
            arm.forearm.scale.z = arm.elbow.distanceTo(target) / 0.32;
            arm.hand.quaternion.copy(arm.forearm.quaternion);
        }
    }

    // Start the boot sequence, greeting the user by name
    public startBoot(userName: string) {
        const hour = new Date().getHours();
        const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        this.greeting = userName ? `Good ${part}, ${userName}.` : `Good ${part}.`;
        this.bootStart = performance.now();
        // The storm makes itself known soon after the display comes up
        this.nextFlash = this.bootStart + 4500;
        this.setScreen('boot');
    }

    private setScreen(screen: LabScreen) {
        if (screen === this.labScreen) return;
        this.labScreen = screen;
        this.hovered = null;
        this.drawnKey = '';
        if (screen === 'accelerator') {
            this.experimentStart = performance.now();
            this.struck = false;
        }
        this.onScreenChange?.();
    }

    public getScreen(): LabScreen {
        return this.labScreen;
    }

    public showingProgram(): boolean {
        return this.labScreen === 'program';
    }

    // Typing on the cubes or the accelerator opens the terminal (or file graph)
    public openProgram() {
        if (this.labScreen === 'home' || this.labScreen === 'accelerator') this.setScreen('program');
    }

    public goHome() {
        if (this.labScreen !== 'boot') this.setScreen('home');
    }

    private buttonAt(ray: THREE.Raycaster): LabButton | null {
        const live = this.buttons.filter((button) => button.showOn.includes(this.labScreen) && button.appear > 0.5);
        const hit = ray.intersectObjects(live.map((button) => button.pick), false)[0];
        return hit ? live.find((button) => button.pick === hit.object) ?? null : null;
    }

    // Point at a cube and it grows and shows its label. Says whether one is under the pointer.
    public hover(ray: THREE.Raycaster): boolean {
        this.hovered = this.buttonAt(ray);
        return this.hovered !== null;
    }

    // Click a cube to open its program, or the X cube to close it
    public click(ray: THREE.Raycaster): boolean {
        const button = this.buttonAt(ray);
        if (!button) return false;
        this.setScreen(button.opens);
        return true;
    }

    // The game draws its picture into a canvas of its own
    public setGameCanvas(canvas: HTMLCanvasElement) {
        if (this.gameTexture.image === canvas) return;
        this.gameTexture.dispose();
        this.gameTexture = new THREE.CanvasTexture(canvas);
        this.gameTexture.colorSpace = THREE.SRGBColorSpace;
        this.gameTexture.magFilter = THREE.NearestFilter;
        this.gameTexture.minFilter = THREE.LinearFilter;
        this.gameTexture.generateMipmaps = false;
        const material = this.gameScreen.material as THREE.MeshBasicMaterial;
        material.map = this.gameTexture;
        material.needsUpdate = true;
    }

    public gameFrameReady() {
        this.gameTexture.needsUpdate = true;
    }

    // The experiment's lightning strike: the brightest flash of the storm, and
    // the room shakes
    private strike(now: number) {
        this.flashStart = now;
        this.flashStrength = 0.9;
        this.nextFlash = now + 9000 + Math.random() * 6000;
        this.makeBolt();
        this.shakeUntil = now + 700;
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
        // The lightning strike shakes the room
        if (now < this.shakeUntil) {
            const k = (this.shakeUntil - now) / 700;
            camera.position.x += (Math.random() - 0.5) * 0.09 * k;
            camera.position.y += (Math.random() - 0.5) * 0.09 * k;
        }
        camera.lookAt(ORBIT_PIVOT);

        // Once booted, the display shows the program cubes, or what they opened
        if (this.labScreen === 'boot' && !this.isBooting()) this.setScreen('home');
        const screen = this.labScreen;
        this.screen.visible = screen !== 'game' && (screen !== 'program' || this.content === 'terminal');
        this.gameScreen.visible = screen === 'game';
        this.updateLauncher(t);
        this.updateHands(now);
        this.updateLift(now);

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
        switch (this.labScreen) {
            case 'boot':
                if (elapsed < BOOT_ID_END) this.drawIdentification(elapsed);
                else this.drawBanner(elapsed - BOOT_ID_END, now);
                break;
            case 'home':
                // Just the display's frame round the cubes
                if (this.drawnKey !== 'home') {
                    this.drawnKey = 'home';
                    this.beginFrame();
                    this.texture.needsUpdate = true;
                }
                break;
            case 'accelerator':
                this.drawAccelerator(now);
                break;
            case 'program':
                if (this.content === 'terminal') this.drawTerminal(now);
                break;
        }
    }

    // The accelerator program, after the "Theoretical study" screen in the game:
    // the particle is injected, sped round the ring and fired off at the lab,
    // which brings a lightning strike down on it before the display settles
    private drawAccelerator(now: number) {
        const t = (now - this.experimentStart) / 1000;
        if (t >= EJECT_END && !this.struck) {
            this.struck = true;
            this.strike(now);
        }
        const ctx = this.ctx;
        this.beginFrame();

        this.setFont(1.1, '6px');
        ctx.textAlign = 'center';
        ctx.fillText('--- Theoretical study ---', CANVAS_WIDTH / 2, 24);
        ctx.textAlign = 'left';

        // The two test rooms on the left, each with its marker in the corner
        ctx.lineWidth = 2;
        // (lower than in the game, so the phase text above them clears his head)
        const rooms: [string, number, number][] = [['room 3', 190, 130], ['room 1', 350, 200]];
        for (const [label, top, height] of rooms) {
            ctx.strokeStyle = TEXT_DIM;
            ctx.strokeRect(60, top, 440, height);
            const x = 472;
            const y = top + 12;
            ctx.strokeRect(x, y, 16, 16);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 16, y + 16);
            ctx.moveTo(x + 16, y);
            ctx.lineTo(x, y + 16);
            ctx.stroke();
            this.setFont(0.8, '2px');
            ctx.fillStyle = TEXT_DIM;
            ctx.fillText(label, 72, top + 10);
        }

        // The ring, the injector line up into it, and the exit line to the lab
        const ring = { x: 745, y: 285, r: 200 };
        const injector = { x: ring.x - ring.r, y: 490 };
        const exit = { x: ring.x + ring.r * Math.cos(Math.PI / 3), y: ring.y + ring.r * Math.sin(Math.PI / 3) };
        const lab = { x: 770, y: 600 };
        ctx.strokeStyle = TEXT_COLOR;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(injector.x, ring.y);
        ctx.lineTo(injector.x, injector.y);
        ctx.moveTo(exit.x, exit.y);
        ctx.lineTo(lab.x, lab.y);
        ctx.stroke();
        ctx.fillStyle = TEXT_COLOR;
        ctx.fillRect(injector.x - 10, injector.y - 2, 20, 22);
        ctx.beginPath();
        ctx.moveTo(lab.x, lab.y - 14);
        ctx.lineTo(lab.x + 14, lab.y);
        ctx.lineTo(lab.x, lab.y + 14);
        ctx.lineTo(lab.x - 14, lab.y);
        ctx.closePath();
        ctx.fill();
        this.setFont(0.8, '2px');
        ctx.fillText('LAB', lab.x + 26, lab.y - 8);

        // The particle: up the injector, round and round the ring faster and
        // faster, then off down the exit line into the lab
        const span = ACCEL_END - INJECT_END;
        const accel = (2 * (ACCEL_SWEEP - ACCEL_START_SPEED * span)) / (span * span);
        const onRing = (a: number) => ({ x: ring.x + ring.r * Math.cos(a), y: ring.y + ring.r * Math.sin(a) });
        let particle = lab;
        let speed = 0;
        const trail: { x: number; y: number }[] = [];
        if (t < INJECT_END) {
            const k = THREE.MathUtils.clamp((t - 0.5) / (INJECT_END - 0.5), 0, 1);
            particle = { x: injector.x, y: injector.y + (ring.y - injector.y) * k };
        } else if (t < ACCEL_END) {
            const s = t - INJECT_END;
            speed = ACCEL_START_SPEED + accel * s;
            const angle = Math.PI + ACCEL_START_SPEED * s + 0.5 * accel * s * s;
            particle = onRing(angle);
            for (let i = 1; i <= 10; i++) trail.push(onRing(angle - i * Math.min(speed * 0.02, 0.09)));
        } else if (t < EJECT_END) {
            const k = (t - ACCEL_END) / (EJECT_END - ACCEL_END);
            particle = { x: exit.x + (lab.x - exit.x) * k, y: exit.y + (lab.y - exit.y) * k };
        }
        trail.forEach((point, i) => {
            ctx.fillStyle = `rgba(255, 190, 90, ${0.6 * (1 - i / trail.length)})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6 - i * 0.4, 0, Math.PI * 2);
            ctx.fill();
        });
        if (t < EJECT_END || Math.floor(now / 300) % 2 === 0) {
            ctx.fillStyle = '#ffc060';
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        if (t >= INJECT_END && t < EJECT_END) {
            const c = t < ACCEL_END ? 0.12 + 0.87 * ((speed - ACCEL_START_SPEED) / (accel * span)) : 0.99;
            this.setFont(0.9, '3px');
            ctx.textAlign = 'center';
            ctx.fillText(`v = ${c.toFixed(3)} c`, ring.x, ring.y - 10);
            ctx.textAlign = 'left';
        }

        const [heading, line] =
            t < INJECT_END ? ['- Phase 0:', 'Particle INJECTION.'] :
            t < ACCEL_END ? ['- Phase 1:', 'Particle ACCELERATION.'] :
            t < EJECT_END ? ['- Phase 2:', 'EJECTION towards the LAB.'] :
            t < SURGE_END ? ['- WARNING:', 'Energy surge in the LAB!'] :
            ['- Experiment complete.', 'Result: unexplained.'];
        this.setFont(1.15, '4px');
        if (t < EJECT_END || t >= SURGE_END || Math.floor(now / 250) % 2 === 0) {
            ctx.fillText(heading, 60, 88);
            ctx.fillText(line, 60, 126);
        }

        // The strike whites out the display and tears it for a moment
        const sinceStrike = t - EJECT_END;
        if (sinceStrike >= 0 && sinceStrike < 0.9) {
            const k = 1 - sinceStrike / 0.9;
            for (let i = 0; i < 6; i++) {
                const y = Math.random() * CANVAS_HEIGHT;
                const h = 10 + Math.random() * 50;
                ctx.drawImage(this.canvas, 0, y, CANVAS_WIDTH, h, (Math.random() - 0.5) * 80 * k, y, CANVAS_WIDTH, h);
            }
            ctx.fillStyle = `rgba(225, 255, 215, ${0.75 * k * k})`;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        this.texture.needsUpdate = true;
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
        this.gameTexture.dispose();
    }
}
