import * as THREE from 'three';
import { HoloPalette } from './themes';
import { FileKind, fileKind } from './fileKinds';
import { DirectoryEntry, ElectronAPI } from '../shared/types';

declare const window: Window & { electronAPI: ElectronAPI };

// 3D file graph for the holographic mode. Folders are hubs, files are leaves,
// and a small force simulation (nodes repel, edges pull) lays them out.

type NodeKind = 'folder' | 'file' | 'note';

// Line-segment geometry helpers for the file shapes
function edgesOf(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    const edges = new THREE.EdgesGeometry(geometry);
    geometry.dispose();
    return edges;
}

function mergeLines(...parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const positions: number[] = [];
    for (const part of parts) {
        positions.push(...(part.getAttribute('position').array as Float32Array));
        part.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return merged;
}

// A flat outline in the XY plane; 4 sides gives a square standing on its edge
function outline(radius: number, sides: number, turn: number = 0): THREE.BufferGeometry {
    const positions: number[] = [];
    for (let i = 0; i < sides; i++) {
        const a = turn + (i / sides) * Math.PI * 2;
        const b = turn + ((i + 1) / sides) * Math.PI * 2;
        positions.push(Math.cos(a) * radius, Math.sin(a) * radius, 0, Math.cos(b) * radius, Math.sin(b) * radius, 0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
}

// One wireframe shape per kind of file. 'other' has none and keeps the plain dot.
function createFileShapes(): Record<Exclude<FileKind, 'other'>, THREE.BufferGeometry> {
    const square = Math.PI / 4;
    return {
        // Cube
        code: edgesOf(new THREE.BoxGeometry(0.085, 0.085, 0.085)),
        // Pyramid
        data: edgesOf(new THREE.TetrahedronGeometry(0.075)),
        // Upright page
        document: edgesOf(new THREE.BoxGeometry(0.075, 0.105, 0.012)),
        // Picture frame
        image: mergeLines(outline(0.075, 4, square), outline(0.045, 4, square)),
        // Record
        audio: mergeLines(outline(0.058, 20), outline(0.018, 10)),
        // Play triangle, pointing right
        video: edgesOf(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2)),
        // Box in a box
        archive: mergeLines(
            edgesOf(new THREE.BoxGeometry(0.095, 0.095, 0.095)),
            edgesOf(new THREE.BoxGeometry(0.045, 0.045, 0.045))
        ),
        // Faceted gem
        program: edgesOf(new THREE.IcosahedronGeometry(0.062)),
        // Mesh sphere
        model: new THREE.WireframeGeometry(new THREE.SphereGeometry(0.06, 6, 4)),
    };
}

// Folders show how much they hold: the more items inside, the more faces.
// A folder that could not be counted is drawn as the diamond.
type FolderSize = 'few' | 'some' | 'many' | 'huge';

function folderSize(itemCount: number | null): FolderSize {
    if (itemCount === null) return 'some';
    if (itemCount < 10) return 'few';
    if (itemCount < 50) return 'some';
    if (itemCount < 200) return 'many';
    return 'huge';
}

function createFolderShapes(): Record<FolderSize, THREE.BufferGeometry> {
    return {
        // Pyramid
        few: edgesOf(new THREE.TetrahedronGeometry(0.1)),
        // Diamond
        some: edgesOf(new THREE.OctahedronGeometry(0.085)),
        // 20-sided
        many: edgesOf(new THREE.IcosahedronGeometry(0.09)),
        // Sphere
        huge: edgesOf(new THREE.SphereGeometry(0.095, 10, 6)),
    };
}

// File shapes keep one pose towards the viewer so each always looks the same:
// solids are turned to show their depth, flat ones only slightly
const SOLID_POSE = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.45, 0.6, 0));
const FLAT_POSE = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, -0.35, 0));
const FLAT_KINDS: FileKind[] = ['document', 'image', 'audio', 'video'];

interface GraphNode {
    path: string;
    name: string;
    kind: NodeKind;
    fileKind: FileKind;
    itemCount: number | null;   // items directly inside a folder, when known
    more: boolean;              // a "+N more" note that reveals the next batch
    parent: GraphNode | null;
    children: GraphNode[];
    expanded: boolean;
    shown: number;              // how many entries of an expanded folder are displayed
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    force: THREE.Vector3;
    object: THREE.Group;
    marker: THREE.Object3D;
    core: THREE.Mesh | null;    // filled centre shown while a folder is open
    ring: THREE.LineSegments | null; // halo that marks the root
    scale: number;              // marker size (the root is drawn larger)
    radius: number;             // how far the shape reaches from the node's centre
    label: THREE.Sprite;
    labelAlpha: number;         // fades as the label is hidden or shown by decluttering
    hit: THREE.Mesh;
}

const BATCH_SIZE = 48;          // entries shown per folder before a "+N more" note
const MAX_LABEL_LENGTH = 28;

// Labels keep one size on screen however near or far their node is
const LABEL_PIXELS: Record<NodeKind, number> = { folder: 15, file: 13, note: 12 };
const ROOT_SCALE = 1.8;
const HOVER_SCALE = 1.6;

const REPULSION = 0.06;
const SPRING = 6;
// Spring lengths: the root's own entries form a wide shell (folders outside the
// files), deeper folders keep their entries in a tighter cluster
const REST_TOP = { folder: 1.75, file: 1.2 };
const REST_DEEP = { folder: 0.85, file: 0.6 };
const DAMPING = 0.86;
const STEP = 0.016;
const MAX_SPEED = 4;

export class HoloFileGraph {
    public readonly group = new THREE.Group();

    private root: GraphNode | null = null;
    private rootParent: string | null = null;
    private nodes: GraphNode[] = [];
    private hitTargets: THREE.Object3D[] = [];
    private hovered: GraphNode | null = null;
    private hoverLabel: THREE.Sprite | null = null; // full name of the hovered node
    private awake = false;
    private quietFrames = 0;
    private loadingPath: string | null = null;

    private palette: HoloPalette = { normal: 0x00ff66, dim: 0x447755, prompt: 0x00ffaa };

    private folderShapes = createFolderShapes();
    private coreGeometry = new THREE.OctahedronGeometry(0.045);
    private fileGeometry = new THREE.BoxGeometry(0.035, 0.035, 0.035);
    private fileShapes = createFileShapes();
    private hitGeometry = new THREE.SphereGeometry(0.11, 8, 6);
    private ringGeometry = outline(0.2, 40);

    // The root is drawn over everything else so it is never buried
    private rootMaterial = new THREE.LineBasicMaterial({ transparent: true, depthTest: false });
    private rootCoreMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthTest: false });
    private folderMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.95 });
    private shapeMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 });
    private coreMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6 });
    private fileMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
    private noteMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6 });
    private hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

    private edges: THREE.LineSegments;
    private edgeMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 });

    constructor(parent: THREE.Object3D) {
        this.edges = new THREE.LineSegments(new THREE.BufferGeometry(), this.edgeMaterial);
        this.edges.frustumCulled = false;
        this.group.add(this.edges);
        this.group.visible = false;
        parent.add(this.group);
        this.applyPalette();
    }

    public getRootPath(): string | null {
        return this.root ? this.root.path : null;
    }

    public canGoUp(): boolean {
        return this.root !== null && this.rootParent !== null;
    }

    // Re-root the graph at the folder above the current one
    public goUp() {
        if (this.rootParent) void this.setRoot(this.rootParent);
    }

    // Show the graph for a folder. Keeps the current graph when the folder has not
    // changed or is unknown; an empty path with no graph yet means the home folder.
    public async setRoot(dirPath: string) {
        if (this.root && (!dirPath || this.samePath(this.root.path, dirPath))) return;
        if (this.loadingPath !== null && this.samePath(this.loadingPath, dirPath)) return;

        this.loadingPath = dirPath;
        const listing = await window.electronAPI.listDirectory(dirPath, BATCH_SIZE);
        // A newer request took over while this one was being read
        if (this.loadingPath !== dirPath) return;
        this.loadingPath = null;
        if (this.root && this.samePath(this.root.path, listing.path)) return;

        this.clear();
        this.root = this.createNode(listing.path, listing.path, 'folder', null, listing.error ? null : listing.entries.length);
        this.rootParent = listing.parent;
        this.root.expanded = true;
        this.populate(this.root, listing.entries, listing.error);
    }

    private samePath(a: string, b: string): boolean {
        const tidy = (p: string) => p.replace(/[\\/]+$/, '').toLowerCase();
        return tidy(a) === tidy(b);
    }

    private createNode(
        nodePath: string, name: string, kind: NodeKind, parent: GraphNode | null, itemCount: number | null = null
    ): GraphNode {
        const object = new THREE.Group();
        const kindOfFile = kind === 'file' ? fileKind(name) : 'other';
        const folderShape = this.folderShapes[folderSize(itemCount)];

        let marker: THREE.Object3D;
        let core: THREE.Mesh | null = null;
        let ring: THREE.LineSegments | null = null;
        if (!parent) {
            // The root: larger, ringed and drawn on top
            marker = new THREE.LineSegments(folderShape, this.rootMaterial);
            core = new THREE.Mesh(this.coreGeometry, this.rootCoreMaterial);
            ring = new THREE.LineSegments(this.ringGeometry, this.rootMaterial);
            for (const part of [marker, core, ring]) part.renderOrder = 10;
            core.scale.setScalar(ROOT_SCALE);
            core.visible = false;
            object.add(core, ring);
        } else if (kind === 'folder') {
            marker = new THREE.LineSegments(folderShape, this.folderMaterial);
            core = new THREE.Mesh(this.coreGeometry, this.coreMaterial);
            core.visible = false;
            object.add(core);
        } else if (kindOfFile !== 'other') {
            marker = new THREE.LineSegments(this.fileShapes[kindOfFile], this.shapeMaterial);
        } else {
            marker = new THREE.Mesh(this.fileGeometry, kind === 'file' ? this.fileMaterial : this.noteMaterial);
        }
        const scale = parent ? 1 : ROOT_SCALE;
        marker.scale.setScalar(scale);
        object.add(marker);

        // The root shows its whole path; everything else is kept short
        const label = this.createLabel(name, kind, parent ? MAX_LABEL_LENGTH : Infinity);
        if (!parent) {
            label.material.depthTest = false;
            label.renderOrder = 11;
        }
        object.add(label);

        const hit = new THREE.Mesh(this.hitGeometry, this.hitMaterial);
        hit.scale.setScalar(scale);
        object.add(hit);

        const node: GraphNode = {
            path: nodePath,
            name,
            kind,
            fileKind: kindOfFile,
            itemCount: kind === 'folder' ? itemCount : null,
            more: false,
            parent,
            children: [],
            expanded: false,
            shown: BATCH_SIZE,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            force: new THREE.Vector3(),
            object,
            marker,
            core,
            ring,
            scale,
            // The root reaches out to its ring; plain dots are much smaller than shapes
            radius: !parent ? 0.21 : kind === 'folder' ? 0.095 : kindOfFile === 'other' ? 0.03 : 0.07,
            label,
            labelAlpha: 0,
            hit,
        };
        hit.userData.node = node;

        if (parent) {
            // Sprout next to the parent, leaning away from the grandparent
            const outward = parent.parent
                ? parent.position.clone().sub(parent.parent.position).normalize()
                : new THREE.Vector3();
            const scatter = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            node.position.copy(parent.position).add(outward.multiplyScalar(0.5).add(scatter.multiplyScalar(0.5)).multiplyScalar(0.25));
            parent.children.push(node);
        }
        object.position.copy(node.position);

        this.nodes.push(node);
        this.hitTargets.push(hit);
        this.group.add(object);
        this.wake();
        return node;
    }

    private labelColor(kind: NodeKind): number {
        if (kind === 'folder') return this.palette.prompt;
        return kind === 'file' ? this.palette.normal : this.palette.dim;
    }

    // Text is drawn white and tinted by the material so a theme change is just a recolor.
    // A backdrop makes the label readable over whatever is behind it.
    private createLabel(text: string, kind: NodeKind, maxLength: number, backdrop: boolean = false): THREE.Sprite {
        const shown = text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
        const fontSize = 32;
        const font = `${fontSize}px "Perfect DOS VGA 437", monospace`;
        const padding = backdrop ? 12 : 4;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        ctx.font = font;
        canvas.width = Math.ceil(ctx.measureText(shown).width) + padding * 2;
        canvas.height = fontSize + 12;
        if (backdrop) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        }
        ctx.font = font;
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(shown, padding, canvas.height / 2);

        const material = new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(canvas),
            color: this.labelColor(kind),
            transparent: true,
            depthWrite: false,
            sizeAttenuation: false // sized in screen pixels by layoutLabels()
        });
        const sprite = new THREE.Sprite(material);
        sprite.userData.aspect = canvas.width / canvas.height;
        sprite.userData.pixels = LABEL_PIXELS[kind];
        return sprite;
    }

    // Add a folder's entries as child nodes, in the order the listing gives them
    // (folders first, then files, alphabetical)
    private populate(folder: GraphNode, entries: DirectoryEntry[], error?: string) {
        const separator = folder.path.includes('/') && !folder.path.includes('\\') ? '/' : '\\';
        const base = folder.path.endsWith(separator) ? folder.path : folder.path + separator;

        for (const entry of entries.slice(0, folder.shown)) {
            const kind = entry.isDirectory ? 'folder' : 'file';
            this.createNode(base + entry.name, entry.name, kind, folder, entry.itemCount ?? null);
        }

        if (error) {
            this.createNode(folder.path, '(no access)', 'note', folder);
        } else {
            // Now that it is open the folder's size is known exactly
            folder.itemCount = entries.length;
            (folder.marker as THREE.LineSegments).geometry = this.folderShapes[folderSize(entries.length)];
            if (entries.length === 0) {
                this.createNode(folder.path, '(empty)', 'note', folder);
            } else if (entries.length > folder.shown) {
                const more = this.createNode(folder.path, `+${entries.length - folder.shown} more`, 'note', folder);
                more.more = true;
            }
        }

        if (folder.core) folder.core.visible = true;
    }

    private async expand(folder: GraphNode) {
        folder.expanded = true;
        const listing = await window.electronAPI.listDirectory(folder.path, folder.shown);
        // The folder may have been collapsed or removed while the listing was read
        if (!folder.expanded || !this.nodes.includes(folder)) return;
        this.removeChildren(folder);
        this.populate(folder, listing.entries, listing.error);
    }

    private collapse(folder: GraphNode) {
        folder.expanded = false;
        folder.shown = BATCH_SIZE;
        this.removeChildren(folder);
        if (folder.core) folder.core.visible = false;
    }

    private removeChildren(folder: GraphNode) {
        for (const child of folder.children) {
            this.removeChildren(child);
            this.group.remove(child.object);
            child.label.material.map?.dispose();
            child.label.material.dispose();
            this.nodes.splice(this.nodes.indexOf(child), 1);
            this.hitTargets.splice(this.hitTargets.indexOf(child.hit), 1);
            if (this.hovered === child) this.setHovered(null);
        }
        folder.children = [];
        this.wake();
    }

    private clear() {
        this.setHovered(null);
        if (this.root) {
            this.removeChildren(this.root);
            this.group.remove(this.root.object);
            this.root.label.material.map?.dispose();
            this.root.label.material.dispose();
        }
        this.root = null;
        this.nodes = [];
        this.hitTargets = [];
    }

    // The nearest node under the pointer, except that the root wins whenever it
    // is under the pointer at all, so nodes in front of it cannot block it
    private pick(raycaster: THREE.Raycaster): GraphNode | null {
        const hits = raycaster.intersectObjects(this.hitTargets, false);
        if (hits.length === 0) return null;
        const onRoot = hits.find((hit) => hit.object.userData.node === this.root);
        return (onRoot ?? hits[0]).object.userData.node as GraphNode;
    }

    // Highlight the node under the pointer. Returns true when it is something clickable.
    public hover(raycaster: THREE.Raycaster): boolean {
        this.setHovered(this.pick(raycaster));
        const node = this.hovered;
        return !!node && (node.kind !== 'note' || node.more);
    }

    // The hovered node grows and shows its full, untruncated name
    private setHovered(node: GraphNode | null) {
        if (node === this.hovered) return;
        this.hovered?.marker.scale.setScalar(this.hovered.scale);
        if (this.hoverLabel) {
            this.group.remove(this.hoverLabel);
            this.hoverLabel.material.map?.dispose();
            this.hoverLabel.material.dispose();
            this.hoverLabel = null;
        }

        this.hovered = node;
        if (!node) return;
        node.marker.scale.setScalar(node.scale * HOVER_SCALE);
        const items = node.itemCount === null ? '' : `  (${node.itemCount} ${node.itemCount === 1 ? 'item' : 'items'})`;
        this.hoverLabel = this.createLabel(node.name + items, node.kind, Infinity, true);
        this.hoverLabel.material.depthTest = false;
        this.hoverLabel.renderOrder = 20;
        this.group.add(this.hoverLabel);
    }

    // Whether the pointer is over a node at all
    public nodeAt(raycaster: THREE.Raycaster): boolean {
        return this.pick(raycaster) !== null;
    }

    // How far the graph reaches from its root, for scaling it to fit a space
    public getExtent(): number {
        let furthest = 0;
        for (const node of this.nodes) furthest = Math.max(furthest, node.position.length());
        return furthest + 0.3;
    }

    // Folders open and close in place. Returns the path when a file was clicked.
    public click(raycaster: THREE.Raycaster): string | null {
        const node = this.pick(raycaster);
        if (!node) return null;

        if (node.kind === 'file') return node.path;

        if (node.kind === 'folder') {
            if (node.expanded) this.collapse(node);
            else void this.expand(node);
        } else if (node.more && node.parent) {
            node.parent.shown += BATCH_SIZE;
            void this.expand(node.parent);
        }
        return null;
    }

    // What a double-click means: the root goes up a folder, any other folder
    // becomes the root, and a file's path is returned so its details can be shown.
    public doubleClick(raycaster: THREE.Raycaster): string | null {
        const node = this.pick(raycaster);
        if (!node) return null;

        if (node.kind === 'file') return node.path;

        if (node === this.root) {
            this.goUp();
        } else if (node.kind === 'folder') {
            void this.setRoot(node.path);
        }
        return null;
    }

    // Right-click: put a folder at the centre by making it the root
    public centerOn(raycaster: THREE.Raycaster) {
        const node = this.pick(raycaster);
        if (node && node.kind === 'folder' && node !== this.root) {
            void this.setRoot(node.path);
        }
    }

    private wake() {
        this.awake = true;
        this.quietFrames = 0;
    }

    // Counter the graph's rotation so the file shapes hold their pose
    private poseShapes() {
        const facing = this.group.quaternion.clone().invert();
        for (const node of this.nodes) {
            if (node.fileKind === 'other') continue;
            const pose = FLAT_KINDS.includes(node.fileKind) ? FLAT_POSE : SOLID_POSE;
            node.marker.quaternion.copy(facing).multiply(pose);
        }
        // The root's ring faces the viewer and breathes slowly to catch the eye
        if (this.root?.ring) {
            this.root.ring.quaternion.copy(facing);
            this.root.ring.scale.setScalar(1 + 0.08 * Math.sin(performance.now() / 400));
        }
    }

    // Size the labels in screen pixels, hang each just below its node, and hide
    // the ones that would cover another label or another node's shape.
    // The hovered node's name goes first, then the root, folders, labels already
    // showing (so they do not flicker) and whatever is nearest the viewer.
    private layoutLabels(camera: THREE.PerspectiveCamera, viewWidth: number, viewHeight: number, labelScale: number) {
        // World size of one screen pixel at distance 1
        const unitsPerPixel = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / viewHeight;
        const groupScale = Math.max(this.group.scale.x, 0.001);
        const world = new THREE.Vector3();
        const projected = new THREE.Vector3();
        type Rect = { left: number; top: number; right: number; bottom: number; owner: GraphNode };
        const taken: Rect[] = [];

        // Where a node's shape and its label land on screen, or null when out of view
        const place = (node: GraphNode, sprite: THREE.Sprite) => {
            node.object.getWorldPosition(world);
            projected.copy(world).project(camera);
            if (projected.z > 1) return null;
            const x = (projected.x + 1) / 2 * viewWidth;
            const y = (1 - projected.y) / 2 * viewHeight;
            const radius = node.radius * groupScale / (world.distanceTo(camera.position) * unitsPerPixel);

            const height = (sprite.userData.pixels as number) * labelScale;
            const width = height * (sprite.userData.aspect as number);
            sprite.scale.set(width / groupScale * unitsPerPixel, height / groupScale * unitsPerPixel, 1);
            // Anchor above the sprite so the text sits below the shape on screen
            const gap = radius + 3;
            sprite.center.set(0.5, 1 + gap / height);

            return {
                depth: projected.z,
                shape: { left: x - radius * 0.7, right: x + radius * 0.7, top: y - radius * 0.7, bottom: y + radius * 0.7, owner: node },
                label: { left: x - width / 2 - 2, right: x + width / 2 + 2, top: y + gap, bottom: y + gap + height, owner: node }
            };
        };

        const candidates: { node: GraphNode; label: Rect; score: number }[] = [];
        for (const node of this.nodes) {
            const spot = place(node, node.label);
            if (spot) taken.push(spot.shape);
            if (!spot || node === this.hovered) {
                node.labelAlpha = 0;
                node.label.visible = false;
                continue;
            }
            const score = (node === this.root ? 1e5 : 0) + (node.kind === 'folder' ? 1e3 : 0)
                + (node.labelAlpha > 0.5 ? 100 : 0) - spot.depth * 10;
            candidates.push({ node, label: spot.label, score });
        }
        candidates.sort((a, b) => b.score - a.score);

        if (this.hovered && this.hoverLabel) {
            this.hoverLabel.position.copy(this.hovered.position);
            const spot = place(this.hovered, this.hoverLabel);
            if (spot) taken.push(spot.label);
        }

        for (const { node, label } of candidates) {
            const free = !taken.some((t) => t.owner !== node
                && label.left < t.right && label.right > t.left && label.top < t.bottom && label.bottom > t.top);
            if (free) taken.push(label);
            node.labelAlpha += ((free ? 1 : 0) - node.labelAlpha) * 0.2;
            node.label.material.opacity = node.labelAlpha;
            node.label.visible = node.labelAlpha > 0.02;
        }
    }

    // Labels shrink with the graph while it bursts out of the cube; pass a fixed
    // labelScale to keep them full size (as in the lab, where the graph is scaled to fit)
    public update(camera: THREE.PerspectiveCamera, viewWidth: number, viewHeight: number, labelScale: number = this.group.scale.x) {
        this.poseShapes();
        this.layoutLabels(camera, viewWidth, viewHeight, Math.max(labelScale, 0.001));
        if (!this.awake || !this.root) return;
        const nodes = this.nodes;
        const delta = new THREE.Vector3();

        for (const node of nodes) node.force.set(0, 0, 0);

        // Every node pushes every other node away
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                delta.subVectors(nodes[i].position, nodes[j].position);
                const distSq = Math.max(delta.lengthSq(), 0.0025);
                delta.multiplyScalar(REPULSION / (distSq * Math.sqrt(distSq)));
                nodes[i].force.add(delta);
                nodes[j].force.sub(delta);
            }
        }

        // Each node is tied to its folder by a spring
        for (const node of nodes) {
            if (!node.parent) continue;
            delta.subVectors(node.position, node.parent.position);
            const dist = Math.max(delta.length(), 0.001);
            const lengths = node.parent === this.root ? REST_TOP : REST_DEEP;
            const rest = node.kind === 'folder' ? lengths.folder : lengths.file;
            delta.multiplyScalar(SPRING * (dist - rest) / dist);
            node.force.sub(delta);
            node.parent.force.add(delta);
        }

        let fastest = 0;
        for (const node of nodes) {
            if (node === this.root) continue; // the root stays at the centre
            node.velocity.addScaledVector(node.force, STEP).multiplyScalar(DAMPING).clampLength(0, MAX_SPEED);
            node.position.addScaledVector(node.velocity, STEP);
            node.object.position.copy(node.position);
            fastest = Math.max(fastest, node.velocity.lengthSq());
        }

        this.updateEdges();

        // Go to sleep once everything has settled
        this.quietFrames = fastest < 0.0004 ? this.quietFrames + 1 : 0;
        if (this.quietFrames > 30) this.awake = false;
    }

    private updateEdges() {
        const linked = this.nodes.filter((n) => n.parent);
        const positions = new Float32Array(linked.length * 6);
        linked.forEach((node, i) => {
            node.parent!.position.toArray(positions, i * 6);
            node.position.toArray(positions, i * 6 + 3);
        });
        this.edges.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }

    public setPalette(palette: HoloPalette) {
        this.palette = palette;
        this.applyPalette();
    }

    private applyPalette() {
        this.rootMaterial.color.setHex(this.palette.prompt);
        this.rootCoreMaterial.color.setHex(this.palette.prompt);
        this.folderMaterial.color.setHex(this.palette.prompt);
        this.coreMaterial.color.setHex(this.palette.prompt);
        this.fileMaterial.color.setHex(this.palette.normal);
        this.shapeMaterial.color.setHex(this.palette.normal);
        this.noteMaterial.color.setHex(this.palette.dim);
        this.edgeMaterial.color.setHex(this.palette.normal);
        for (const node of this.nodes) {
            node.label.material.color.setHex(this.labelColor(node.kind));
        }
        if (this.hovered && this.hoverLabel) {
            this.hoverLabel.material.color.setHex(this.labelColor(this.hovered.kind));
        }
    }

    public dispose() {
        this.clear();
        this.group.parent?.remove(this.group);
        this.edges.geometry.dispose();
        for (const item of [
            this.coreGeometry, this.fileGeometry, this.hitGeometry, this.ringGeometry,
            ...Object.values(this.folderShapes), ...Object.values(this.fileShapes),
            this.rootMaterial, this.rootCoreMaterial,
            this.folderMaterial, this.shapeMaterial, this.coreMaterial, this.fileMaterial, this.noteMaterial,
            this.hitMaterial, this.edgeMaterial
        ]) {
            item.dispose();
        }
    }
}
