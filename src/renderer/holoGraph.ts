import * as THREE from 'three';
import { HoloPalette } from './themes';
import { ElectronAPI } from '../shared/types';

declare const window: Window & { electronAPI: ElectronAPI };

// 3D file graph for the holographic mode. Folders are hubs, files are leaves,
// and a small force simulation (nodes repel, edges pull) lays them out.

type NodeKind = 'folder' | 'file' | 'note';

interface GraphNode {
    path: string;
    name: string;
    kind: NodeKind;
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
    label: THREE.Sprite;
    hit: THREE.Mesh;
}

const BATCH_SIZE = 48;          // entries shown per folder before a "+N more" note
const MAX_LABEL_LENGTH = 28;

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
    private nodes: GraphNode[] = [];
    private hitTargets: THREE.Object3D[] = [];
    private hovered: GraphNode | null = null;
    private awake = false;
    private quietFrames = 0;
    private loadingPath: string | null = null;

    private palette: HoloPalette = { normal: 0x00ff66, dim: 0x447755, prompt: 0x00ffaa };

    private folderGeometry = new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.085));
    private coreGeometry = new THREE.OctahedronGeometry(0.045);
    private fileGeometry = new THREE.BoxGeometry(0.035, 0.035, 0.035);
    private hitGeometry = new THREE.SphereGeometry(0.11, 8, 6);

    private folderMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.95 });
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

    // Show the graph for a folder. Keeps the current graph when the folder has not
    // changed or is unknown; an empty path with no graph yet means the home folder.
    public async setRoot(dirPath: string) {
        if (this.root && (!dirPath || this.samePath(this.root.path, dirPath))) return;
        if (this.loadingPath !== null && this.samePath(this.loadingPath, dirPath)) return;

        this.loadingPath = dirPath;
        const listing = await window.electronAPI.listDirectory(dirPath);
        // A newer request took over while this one was being read
        if (this.loadingPath !== dirPath) return;
        this.loadingPath = null;
        if (this.root && this.samePath(this.root.path, listing.path)) return;

        this.clear();
        this.root = this.createNode(listing.path, listing.path, 'folder', null);
        this.root.expanded = true;
        this.populate(this.root, listing.entries, listing.error);
    }

    private samePath(a: string, b: string): boolean {
        const tidy = (p: string) => p.replace(/[\\/]+$/, '').toLowerCase();
        return tidy(a) === tidy(b);
    }

    private createNode(nodePath: string, name: string, kind: NodeKind, parent: GraphNode | null): GraphNode {
        const object = new THREE.Group();

        let marker: THREE.Object3D;
        let core: THREE.Mesh | null = null;
        if (kind === 'folder') {
            marker = new THREE.LineSegments(this.folderGeometry, this.folderMaterial);
            core = new THREE.Mesh(this.coreGeometry, this.coreMaterial);
            core.visible = false;
            object.add(core);
        } else {
            marker = new THREE.Mesh(this.fileGeometry, kind === 'file' ? this.fileMaterial : this.noteMaterial);
        }
        object.add(marker);

        // The root shows its whole path; everything else is kept short
        const label = this.createLabel(name, kind, parent ? MAX_LABEL_LENGTH : Infinity);
        object.add(label);

        const hit = new THREE.Mesh(this.hitGeometry, this.hitMaterial);
        object.add(hit);

        const node: GraphNode = {
            path: nodePath,
            name,
            kind,
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
            label,
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

    // Text is drawn white and tinted by the material so a theme change is just a recolor
    private createLabel(text: string, kind: NodeKind, maxLength: number): THREE.Sprite {
        const shown = text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
        const fontSize = 32;
        const font = `${fontSize}px "Perfect DOS VGA 437", monospace`;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        ctx.font = font;
        canvas.width = Math.ceil(ctx.measureText(shown).width) + 8;
        canvas.height = fontSize + 12;
        ctx.font = font;
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(shown, 4, canvas.height / 2);

        const material = new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(canvas),
            color: this.labelColor(kind),
            transparent: true,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        const height = kind === 'folder' ? 0.125 : 0.105;
        sprite.scale.set(height * canvas.width / canvas.height, height, 1);
        // Anchor above the sprite so the text always sits below its node on screen
        sprite.center.set(0.5, 1.7);
        return sprite;
    }

    // Add a folder's entries as child nodes: folders first, then files, alphabetical
    private populate(folder: GraphNode, entries: { name: string; isDirectory: boolean }[], error?: string) {
        const separator = folder.path.includes('/') && !folder.path.includes('\\') ? '/' : '\\';
        const base = folder.path.endsWith(separator) ? folder.path : folder.path + separator;

        const sorted = [...entries].sort((a, b) =>
            Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );

        for (const entry of sorted.slice(0, folder.shown)) {
            this.createNode(base + entry.name, entry.name, entry.isDirectory ? 'folder' : 'file', folder);
        }

        if (error) {
            this.createNode(folder.path, '(no access)', 'note', folder);
        } else if (sorted.length === 0) {
            this.createNode(folder.path, '(empty)', 'note', folder);
        } else if (sorted.length > folder.shown) {
            const more = this.createNode(folder.path, `+${sorted.length - folder.shown} more`, 'note', folder);
            more.more = true;
        }

        if (folder.core) folder.core.visible = true;
    }

    private async expand(folder: GraphNode) {
        folder.expanded = true;
        const listing = await window.electronAPI.listDirectory(folder.path);
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
            if (this.hovered === child) this.hovered = null;
        }
        folder.children = [];
        this.wake();
    }

    private clear() {
        if (this.root) {
            this.removeChildren(this.root);
            this.group.remove(this.root.object);
            this.root.label.material.map?.dispose();
            this.root.label.material.dispose();
        }
        this.root = null;
        this.nodes = [];
        this.hitTargets = [];
        this.hovered = null;
    }

    private pick(raycaster: THREE.Raycaster): GraphNode | null {
        const hits = raycaster.intersectObjects(this.hitTargets, false);
        return hits.length > 0 ? (hits[0].object.userData.node as GraphNode) : null;
    }

    // Highlight the node under the pointer. Returns true when it is something clickable.
    public hover(raycaster: THREE.Raycaster): boolean {
        const node = this.pick(raycaster);
        if (node !== this.hovered) {
            this.hovered?.marker.scale.setScalar(1);
            this.hovered = node;
            node?.marker.scale.setScalar(1.6);
        }
        return !!node && (node.kind !== 'note' || node.more);
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

    private wake() {
        this.awake = true;
        this.quietFrames = 0;
    }

    public update() {
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
        this.folderMaterial.color.setHex(this.palette.prompt);
        this.coreMaterial.color.setHex(this.palette.prompt);
        this.fileMaterial.color.setHex(this.palette.normal);
        this.noteMaterial.color.setHex(this.palette.dim);
        this.edgeMaterial.color.setHex(this.palette.normal);
        for (const node of this.nodes) {
            node.label.material.color.setHex(this.labelColor(node.kind));
        }
    }

    public dispose() {
        this.clear();
        this.group.parent?.remove(this.group);
        this.edges.geometry.dispose();
        for (const item of [
            this.folderGeometry, this.coreGeometry, this.fileGeometry, this.hitGeometry,
            this.folderMaterial, this.coreMaterial, this.fileMaterial, this.noteMaterial,
            this.hitMaterial, this.edgeMaterial
        ]) {
            item.dispose();
        }
    }
}
