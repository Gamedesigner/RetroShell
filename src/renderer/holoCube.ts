import * as THREE from 'three';
import { HoloTextRenderer } from './holoText';
import { HoloFileGraph } from './holoGraph';
import { HoloPalette } from './themes';

export type HoloMode = 'cube' | 'files';

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

    // File graph mode: the cube bursts open into a graph of the shell's folder
    private graph: HoloFileGraph;
    private mode: HoloMode = 'cube';
    private burst = 0; // 0 = cube, 1 = file graph, animated between the two
    private graphRotation = { x: 0.2, y: 0 };
    private graphZoom = CUBE_CAMERA_Z;
    private dragDistance = 0;
    private raycaster = new THREE.Raycaster();

    // Called with the full path when a file node is clicked / double-clicked
    public onFilePicked: ((filePath: string) => void) | null = null;
    public onFileOpened: ((filePath: string) => void) | null = null;
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

        // File graph, hidden until the mode is switched
        this.graph = new HoloFileGraph(this.scene);

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
            this.isDragging = true;
            this.dragDistance = 0;
            if (this.mode === 'cube') this.autoRotate = false;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) {
                // Point at clickable nodes in the file graph
                if (this.mode === 'files') {
                    canvas.style.cursor = this.graph.hover(this.aimRaycaster(e)) ? 'pointer' : '';
                }
                return;
            }

            const deltaX = e.clientX - this.previousMousePosition.x;
            const deltaY = e.clientY - this.previousMousePosition.y;
            this.dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

            // The drag turns whichever of the two is on show
            const rotation = this.mode === 'files' ? this.graphRotation : this.cubeRotation;
            const limit = this.mode === 'files' ? Math.PI / 2 : Math.PI / 3;
            rotation.y += deltaX * 0.01;
            rotation.x += deltaY * 0.01;

            // Clamp X rotation to prevent flipping
            rotation.x = Math.max(-limit, Math.min(limit, rotation.x));

            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mouseup', (e) => {
            // A left press without a drag is a click on the file graph
            if (e.button === 0 && this.isDragging && this.mode === 'files' && this.dragDistance < 5) {
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

        // Double-click to reset rotation, or to open / navigate in the file graph
        canvas.addEventListener('dblclick', (e) => {
            if (this.mode === 'files') {
                this.cancelPendingPick();
                const filePath = this.graph.doubleClick(this.aimRaycaster(e));
                if (filePath) this.onFileOpened?.(filePath);
                return;
            }
            this.cubeRotation = { x: -0.15, y: 0.25 };
            this.autoRotate = true;
        });

        // Right-click a folder in the file graph to put it at the centre
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.mode === 'files' && this.dragDistance < 5) {
                this.graph.centerOn(this.aimRaycaster(e));
            }
        });

        // Scroll to zoom the file graph
        canvas.addEventListener('wheel', (e) => {
            if (this.mode !== 'files') return;
            e.preventDefault();
            this.graphZoom = Math.max(2, Math.min(30, this.graphZoom * (1 + e.deltaY * 0.001)));
        }, { passive: false });
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

    // Switch between the terminal cube and the file graph of the given folder
    public setMode(mode: HoloMode, directory: string = '') {
        this.mode = mode;
        this.renderer.domElement.style.cursor = '';
        if (mode === 'files') {
            this.showFolder(directory);
        }
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

    public getMode(): HoloMode {
        return this.mode;
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
    }

    private animate = () => {
        this.animationId = requestAnimationFrame(this.animate);
        this.time += 0.016; // ~60fps

        // Auto-rotate when not dragging (the cube holds its angle while the file graph is up)
        if (this.autoRotate && !this.isDragging && this.mode === 'cube') {
            this.cubeRotation.y += 0.002;
        }

        // Apply rotation with smooth interpolation
        this.cube.rotation.x += (this.cubeRotation.x - this.cube.rotation.x) * 0.1;
        this.cube.rotation.y += (this.cubeRotation.y - this.cube.rotation.y) * 0.1;

        // Subtle floating animation
        this.cube.position.y = Math.sin(this.time * 0.5) * 0.03;

        // Burst the cube open into the file graph, or fold it back
        const target = this.mode === 'files' ? 1 : 0;
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

        const cameraZ = this.mode === 'files' ? this.graphZoom : CUBE_CAMERA_Z;
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

    // Recolor the wireframe and text to match the active theme
    public setPalette(palette: HoloPalette) {
        (this.wireframe.material as THREE.LineBasicMaterial).color.setHex(palette.normal);
        (this.innerWireframe.material as THREE.LineBasicMaterial).color.setHex(palette.normal);
        this.textRenderer.setPalette(palette);
        this.graph.setPalette(palette);
    }

    public dispose() {
        this.stop();
        window.removeEventListener('resize', this.onResize.bind(this));
        this.textRenderer.dispose();
        this.graph.dispose();
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
