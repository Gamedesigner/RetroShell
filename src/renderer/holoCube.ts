import * as THREE from 'three';
import { HoloTextRenderer } from './holoText';
import { HoloPalette } from './themes';

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

    constructor(container: HTMLElement) {
        this.container = container;

        // Initialize Three.js scene
        this.scene = new THREE.Scene();

        // Camera setup with perspective - pull back to see taller cube
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.camera.position.z = 7;

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
            this.autoRotate = false;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const deltaX = e.clientX - this.previousMousePosition.x;
            const deltaY = e.clientY - this.previousMousePosition.y;

            this.cubeRotation.y += deltaX * 0.01;
            this.cubeRotation.x += deltaY * 0.01;

            // Clamp X rotation to prevent flipping
            this.cubeRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.cubeRotation.x));

            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });

        // Double-click to reset rotation
        canvas.addEventListener('dblclick', () => {
            this.cubeRotation = { x: -0.15, y: 0.25 };
            this.autoRotate = true;
        });
    }

    private onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    public start() {
        if (this.animationId !== null) return;
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

        // Auto-rotate when not dragging
        if (this.autoRotate && !this.isDragging) {
            this.cubeRotation.y += 0.002;
        }

        // Apply rotation with smooth interpolation
        this.cube.rotation.x += (this.cubeRotation.x - this.cube.rotation.x) * 0.1;
        this.cube.rotation.y += (this.cubeRotation.y - this.cube.rotation.y) * 0.1;

        // Subtle floating animation
        this.cube.position.y = Math.sin(this.time * 0.5) * 0.03;

        // Update text animations
        this.textRenderer.update(this.time);

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
    }

    public dispose() {
        this.stop();
        window.removeEventListener('resize', this.onResize.bind(this));
        this.textRenderer.dispose();
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
