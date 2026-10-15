import * as THREE from 'three';
import { HoloTextRenderer } from './holoText';
import { HoloFileGraph } from './holoGraph';
import { HoloLabScene, LAB_BOX_CENTER, LAB_GRAPH_FIT, LAB_PALETTE } from './holoLab';
import { LabGame } from './labGame';
import { HoloPalette } from './themes';

// The 3D view is a setting (the open space around the cube, or the lab) showing
// some content (the terminal, or the file graph of the shell's folder)
export type HoloSetting = 'space' | 'lab';
export type HoloContent = 'terminal' | 'files';

const CUBE_CAMERA_Z = 7;

export class HoloCubeScene {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private cube: THREE.Group;
    private wireframe: THREE.LineSegments;
    private innerWireframe: THREE.LineSegments;
    private textRenderer: HoloTextRenderer;
    private container: HTMLElement;
    private animationId: number | null = null;
    private isDragging = false;
    private previousMousePosition = { x: 0, y: 0 };
    private cubeRotation = { x: -0.15, y: 0.25 }; // Initial tilt
    private autoRotate = true;
    private time = 0;

    private setting: HoloSetting = 'space';
    private content: HoloContent = 'terminal';
    private themePalette: HoloPalette | null = null;

    // File graph: in open space the cube bursts open into it
    private graph: HoloFileGraph;
    private burst = 0; // 0 = cube, 1 = file graph, animated between the two
    private graphRotation = { x: 0.2, y: 0 };
    private graphZoom = CUBE_CAMERA_Z;
    private dragDistance = 0;
    private raycaster = new THREE.Raycaster();

    // The lab: the content on a scientist's display in an Another World style lab
    private lab: HoloLabScene;
    // The DOS game its third cube opens
    private game = new LabGame();

    // Called with the full path when a file node is clicked / double-clicked
    public onFilePicked: ((filePath: string) => void) | null = null;
    public onFileOpened: ((filePath: string) => void) | null = null;
    // Called when the lab's display opens or closes a program
    public onLabScreenChange: (() => void) | null = null;
    // A file click waits briefly in case it turns out to be a double-click
    private pendingPick: ReturnType<typeof setTimeout> | null = null;

    constructor(container: HTMLElement) {
        this.container = container;

        // Initialize Three.js scene
        this.scene = new THREE.Scene();

        // Camera setup with perspective - pull back to see taller cube
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.camera.position.z = CUBE_CAMERA_Z;

        // WebGL renderer with transparency
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        container.appendChild(this.renderer.domElement);

        // Create the cube group
        this.cube = new THREE.Group();
        this.scene.add(this.cube);

        // Create wireframe cube
        this.wireframe = this.createWireframeCube();
        this.cube.add(this.wireframe);

        // Create inner glow effect (slightly smaller wireframe)
        this.innerWireframe = this.createWireframeCube(0.98, 0.3);
        this.cube.add(this.innerWireframe);

        // Initialize text renderer
        this.textRenderer = new HoloTextRenderer(this.cube);

        // File graph and lab, hidden until the mode is switched
        this.graph = new HoloFileGraph(this.scene);
        this.lab = new HoloLabScene(this.scene);
        this.lab.setGameCanvas(this.game.canvas);
        this.lab.onScreenChange = () => {
            this.syncGame();
            this.onLabScreenChange?.();
        };
        this.game.onFrame = () => this.lab.gameFrameReady();
        this.game.onKey = () => this.lab.keyPressed();
        this.game.onExit = () => this.lab.goHome();

        // Set initial rotation
        this.cube.rotation.x = this.cubeRotation.x;
        this.cube.rotation.y = this.cubeRotation.y;

        // Setup mouse controls
        this.setupMouseControls();

        // Handle window resize
        window.addEventListener('resize', this.onResize.bind(this));
    }

    private createWireframeCube(scale: number = 1, opacity: number = 0.8): THREE.LineSegments {
        // Create box geometry - wider for terminal text, doubled height for more rows
        const geometry = new THREE.BoxGeometry(3.6 * scale, 4.8 * scale, 1.8 * scale);
        const edges = new THREE.EdgesGeometry(geometry);

        // Glowing green material
        const material = new THREE.LineBasicMaterial({
            color: 0x00ff66,
            transparent: true,
            opacity: opacity,
            linewidth: 2
        });

        return new THREE.LineSegments(edges, material);
    }

    private setupMouseControls() {
        const canvas = this.renderer.domElement;

        canvas.addEventListener('mousedown', (e) => {
            // In the lab the scientist's hand works his mouse along with yours
            if (this.setting === 'lab') this.lab.pointerClicked();
            this.isDragging = true;
            this.dragDistance = 0;
            if (this.showingCube()) this.autoRotate = false;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mousemove', (e) => {
            if (this.setting === 'lab') this.lab.pointerMoved(e.movementX, e.movementY);
            if (!this.isDragging) {
                // Point at the lab display's cubes, or clickable nodes in the file graph
                const ray = this.aimRaycaster(e);
                const overCube = this.setting === 'lab' && this.lab.hover(ray);
                const overNode = this.graphActive() && this.graph.hover(ray);
                canvas.style.cursor = overCube || overNode ? 'pointer' : '';
                return;
            }

            const deltaX = e.clientX - this.previousMousePosition.x;
            const deltaY = e.clientY - this.previousMousePosition.y;
            this.dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

            // In the lab a drag swings the camera around the display
            if (this.setting === 'lab') {
                this.lab.orbitBy(deltaX, deltaY);
                this.previousMousePosition = { x: e.clientX, y: e.clientY };
                return;
            }

            // The drag turns whichever of the two is on show
            const rotation = this.content === 'files' ? this.graphRotation : this.cubeRotation;
            const limit = this.content === 'files' ? Math.PI / 2 : Math.PI / 3;
            rotation.y += deltaX * 0.01;
            rotation.x += deltaY * 0.01;

            // Clamp X rotation to prevent flipping
            rotation.x = Math.max(-limit, Math.min(limit, rotation.x));

            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mouseup', (e) => {
            // A left press without a drag is a click on one of the lab display's
            // cubes, or on the file graph
            const clicked = e.button === 0 && this.isDragging && this.dragDistance < 5;
            if (clicked && this.setting === 'lab' && this.lab.click(this.aimRaycaster(e))) {
                canvas.style.cursor = '';
            } else if (clicked && this.graphActive()) {
                const filePath = this.graph.click(this.aimRaycaster(e));
                this.cancelPendingPick();
                if (filePath) {
                    this.pendingPick = setTimeout(() => {
                        this.pendingPick = null;
                        this.onFilePicked?.(filePath);
                    }, 250);
                }
            }
            this.isDragging = false;
        });

        canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });

        // Double-click a node to open or navigate in the file graph; anywhere else
        // it puts the cube, or the lab's camera, back where it started
        canvas.addEventListener('dblclick', (e) => {
            const ray = this.aimRaycaster(e);
            if (this.graphActive() && this.graph.nodeAt(ray)) {
                this.cancelPendingPick();
                const filePath = this.graph.doubleClick(ray);
                if (filePath) this.onFileOpened?.(filePath);
            } else if (this.setting === 'lab') {
                this.lab.resetView();
            } else if (this.content === 'terminal') {
                this.cubeRotation = { x: -0.15, y: 0.25 };
                this.autoRotate = true;
            }
        });

        // Right-click a folder in the file graph to put it at the centre
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.graphActive() && this.dragDistance < 5) {
                this.graph.centerOn(this.aimRaycaster(e));
            }
        });

        // Scroll moves the lab's camera, or zooms the file graph in open space
        canvas.addEventListener('wheel', (e) => {
            if (this.setting === 'lab') {
                e.preventDefault();
                this.lab.zoomBy(e.deltaY);
            } else if (this.content === 'files') {
                e.preventDefault();
                this.graphZoom = Math.max(2, Math.min(30, this.graphZoom * (1 + e.deltaY * 0.001)));
            }
        }, { passive: false });
    }

    private showingCube(): boolean {
        return this.setting === 'space' && this.content === 'terminal';
    }

    // Whether the file graph is on screen to point at and click (in the lab,
    // only once its cube has been opened)
    private graphActive(): boolean {
        return this.content === 'files' && (this.setting !== 'lab' || this.lab.showingProgram());
    }

    private cancelPendingPick() {
        if (this.pendingPick !== null) {
            clearTimeout(this.pendingPick);
            this.pendingPick = null;
        }
    }

    private aimRaycaster(e: MouseEvent): THREE.Raycaster {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const pointer = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        this.raycaster.setFromCamera(pointer, this.camera);
        return this.raycaster;
    }

    // Choose the setting and what it shows. Files content shows the graph of the
    // given folder; arriving in the lab plays its boot sequence, greeting the user.
    public setView(setting: HoloSetting, content: HoloContent, directory: string = '', userName: string = '') {
        const arrivingInLab = setting === 'lab' && this.setting !== 'lab';
        this.setting = setting;
        this.content = content;
        this.renderer.domElement.style.cursor = '';
        this.lab.setContent(content);
        if (content === 'files') this.showFolder(directory);
        if (arrivingInLab) this.bootLab(userName);
        if (setting !== 'lab') this.game.close();

        // In the lab the graph takes the display's green
        const palette = setting === 'lab' ? LAB_PALETTE : this.themePalette;
        if (palette) this.graph.setPalette(palette);
    }

    public bootLab(userName: string) {
        this.lab.startBoot(userName);
    }

    // A key typed in the lab: he types it, and on the cubes or the accelerator
    // it opens the terminal (or file graph)
    public labKeyPressed() {
        if (this.setting !== 'lab') return;
        this.lab.keyPressed();
        this.lab.openProgram();
    }

    // The game plays only while it is on the lab's display and the 3D view is up
    private syncGame() {
        if (this.animationId !== null && this.setting === 'lab' && this.lab.getScreen() === 'game') void this.game.open();
        else this.game.close();
    }

    // Whether the lab's display is showing the terminal or file graph
    public labShowingProgram(): boolean {
        return this.lab.showingProgram();
    }

    // What the lab's display shows: the terminal's lines and its cursor
    public updateLab(lines: string[], cursorRow: number, cursorCol: number) {
        this.lab.setText(lines, cursorRow, cursorCol);
    }

    // Point the file graph at a folder; does nothing when it is already showing it
    public showFolder(directory: string) {
        void this.graph.setRoot(directory);
    }

    // The folder the file graph is rooted at (null until one has loaded)
    public getGraphFolder(): string | null {
        return this.graph.getRootPath();
    }

    public canGoUp(): boolean {
        return this.graph.canGoUp();
    }

    public goUp() {
        this.graph.goUp();
    }


    private onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // Hidden while in terminal mode - start() picks up the new size once shown
        if (width === 0 || height === 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    public start() {
        if (this.animationId !== null) return;
        this.onResize();
        this.animate();
    }

    public stop() {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.game.close();
    }

    private animate = () => {
        this.animationId = requestAnimationFrame(this.animate);
        this.time += 0.016; // ~60fps

        // The lab runs its own camera; the file graph can float inside its display box
        this.lab.group.visible = this.setting === 'lab';
        if (this.setting === 'lab') {
            this.cube.visible = false;
            this.lab.update(this.camera);

            const showGraph = this.graphActive();
            this.graph.group.visible = showGraph;
            if (showGraph) {
                // Scaled to stay inside the box as folders open and close
                this.graph.group.position.copy(LAB_BOX_CENTER);
                this.graph.group.rotation.set(0, 0, 0);
                const fit = LAB_GRAPH_FIT / Math.max(this.graph.getExtent(), 0.5);
                const scale = this.graph.group.scale.x + (fit - this.graph.group.scale.x) * 0.1;
                this.graph.group.scale.setScalar(scale);
                const canvas = this.renderer.domElement;
                this.graph.update(this.camera, canvas.clientWidth, canvas.clientHeight, 1);
            }
            this.renderer.render(this.scene, this.camera);
            return;
        }
        // Back from the lab: put the camera and the graph back in open space
        if (this.camera.position.x !== 0 || this.camera.position.y !== 0) {
            this.camera.position.set(0, 0, this.camera.position.z);
            this.camera.rotation.set(0, 0, 0);
        }
        this.graph.group.position.set(0, 0, 0);

        // Auto-rotate when not dragging (the cube holds its angle while the file graph is up)
        if (this.autoRotate && !this.isDragging && this.showingCube()) {
            this.cubeRotation.y += 0.002;
        }

        // Apply rotation with smooth interpolation
        this.cube.rotation.x += (this.cubeRotation.x - this.cube.rotation.x) * 0.1;
        this.cube.rotation.y += (this.cubeRotation.y - this.cube.rotation.y) * 0.1;

        // Subtle floating animation
        this.cube.position.y = Math.sin(this.time * 0.5) * 0.03;

        // Burst the cube open into the file graph, or fold it back
        const target = this.content === 'files' ? 1 : 0;
        this.burst += (target - this.burst) * 0.12;
        if (Math.abs(target - this.burst) < 0.002) this.burst = target;

        this.cube.visible = this.burst < 1;
        this.cube.scale.setScalar(1 + this.burst * 1.6);
        (this.wireframe.material as THREE.LineBasicMaterial).opacity = 0.8 * (1 - this.burst);
        (this.innerWireframe.material as THREE.LineBasicMaterial).opacity = 0.3 * (1 - this.burst);
        this.textRenderer.setOpacity(1 - this.burst);

        this.graph.group.visible = this.burst > 0;
        this.graph.group.scale.setScalar(Math.max(this.burst, 0.001));
        this.graph.group.rotation.x += (this.graphRotation.x - this.graph.group.rotation.x) * 0.1;
        this.graph.group.rotation.y += (this.graphRotation.y - this.graph.group.rotation.y) * 0.1;

        const cameraZ = this.content === 'files' ? this.graphZoom : CUBE_CAMERA_Z;
        this.camera.position.z += (cameraZ - this.camera.position.z) * 0.12;

        // Update text animations
        if (this.cube.visible) {
            this.textRenderer.update(this.time);
        }
        if (this.graph.group.visible) {
            const canvas = this.renderer.domElement;
            this.graph.update(this.camera, canvas.clientWidth, canvas.clientHeight);
        }

        this.renderer.render(this.scene, this.camera);
    };

    public updateText(lines: string[], colors?: number[][]) {
        this.textRenderer.updateText(lines, colors);
    }

    // Recolor the wireframe, text and graph to match the active theme (the lab
    // keeps its own green)
    public setPalette(palette: HoloPalette) {
        this.themePalette = palette;
        (this.wireframe.material as THREE.LineBasicMaterial).color.setHex(palette.normal);
        (this.innerWireframe.material as THREE.LineBasicMaterial).color.setHex(palette.normal);
        this.textRenderer.setPalette(palette);
        if (this.setting === 'space') this.graph.setPalette(palette);
    }

    public dispose() {
        this.stop();
        window.removeEventListener('resize', this.onResize.bind(this));
        this.textRenderer.dispose();
        this.graph.dispose();
        this.lab.dispose();
        this.game.dispose();
        this.renderer.dispose();
        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
    }
}

// Global instance management
let holoCubeInstance: HoloCubeScene | null = null;

export function initHoloCube(container: HTMLElement): HoloCubeScene {
    if (holoCubeInstance) {
        holoCubeInstance.dispose();
    }
    holoCubeInstance = new HoloCubeScene(container);
    return holoCubeInstance;
}

export function getHoloCube(): HoloCubeScene | null {
    return holoCubeInstance;
}

export function disposeHoloCube() {
    if (holoCubeInstance) {
        holoCubeInstance.dispose();
        holoCubeInstance = null;
    }
}

// Expose to window for terminal.ts to access
(window as any).holoCube = {
    init: initHoloCube,
    get: getHoloCube,
    dispose: disposeHoloCube
};
