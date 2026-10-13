import * as THREE from 'three';
import { HoloPalette } from './themes';

// Character definitions as 5x7 pixel patterns (each character is a 5-wide, 7-tall grid)
// 1 = filled, 0 = empty
const CHAR_PATTERNS: Record<string, number[][]> = {
    'A': [
        [0,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,1,1,1,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1]
    ],
    'B': [
        [1,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,1,1,1,0]
    ],
    'C': [
        [0,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,1],
        [0,1,1,1,0]
    ],
    'D': [
        [1,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,1,1,1,0]
    ],
    'E': [
        [1,1,1,1,1],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,1,1,1,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,1,1,1,1]
    ],
    'F': [
        [1,1,1,1,1],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,1,1,1,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0]
    ],
    'G': [
        [0,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,0],
        [1,0,1,1,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [0,1,1,1,0]
    ],
    'H': [
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,1,1,1,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1]
    ],
    'I': [
        [1,1,1,1,1],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [1,1,1,1,1]
    ],
    'J': [
        [0,0,1,1,1],
        [0,0,0,1,0],
        [0,0,0,1,0],
        [0,0,0,1,0],
        [1,0,0,1,0],
        [1,0,0,1,0],
        [0,1,1,0,0]
    ],
    'K': [
        [1,0,0,0,1],
        [1,0,0,1,0],
        [1,0,1,0,0],
        [1,1,0,0,0],
        [1,0,1,0,0],
        [1,0,0,1,0],
        [1,0,0,0,1]
    ],
    'L': [
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,1,1,1,1]
    ],
    'M': [
        [1,0,0,0,1],
        [1,1,0,1,1],
        [1,0,1,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1]
    ],
    'N': [
        [1,0,0,0,1],
        [1,1,0,0,1],
        [1,0,1,0,1],
        [1,0,0,1,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1]
    ],
    'O': [
        [0,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [0,1,1,1,0]
    ],
    'P': [
        [1,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,1,1,1,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0]
    ],
    'Q': [
        [0,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,1,0,1],
        [1,0,0,1,0],
        [0,1,1,0,1]
    ],
    'R': [
        [1,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,1,1,1,0],
        [1,0,1,0,0],
        [1,0,0,1,0],
        [1,0,0,0,1]
    ],
    'S': [
        [0,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,0],
        [0,1,1,1,0],
        [0,0,0,0,1],
        [1,0,0,0,1],
        [0,1,1,1,0]
    ],
    'T': [
        [1,1,1,1,1],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0]
    ],
    'U': [
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [0,1,1,1,0]
    ],
    'V': [
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [0,1,0,1,0],
        [0,1,0,1,0],
        [0,0,1,0,0]
    ],
    'W': [
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,0,1,0,1],
        [1,0,1,0,1],
        [1,1,0,1,1],
        [1,0,0,0,1]
    ],
    'X': [
        [1,0,0,0,1],
        [0,1,0,1,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,1,0,1,0],
        [1,0,0,0,1]
    ],
    'Y': [
        [1,0,0,0,1],
        [0,1,0,1,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0]
    ],
    'Z': [
        [1,1,1,1,1],
        [0,0,0,0,1],
        [0,0,0,1,0],
        [0,0,1,0,0],
        [0,1,0,0,0],
        [1,0,0,0,0],
        [1,1,1,1,1]
    ],
    '0': [
        [0,1,1,1,0],
        [1,0,0,1,1],
        [1,0,1,0,1],
        [1,0,1,0,1],
        [1,1,0,0,1],
        [1,0,0,0,1],
        [0,1,1,1,0]
    ],
    '1': [
        [0,0,1,0,0],
        [0,1,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,1,1,1,0]
    ],
    '2': [
        [0,1,1,1,0],
        [1,0,0,0,1],
        [0,0,0,0,1],
        [0,0,1,1,0],
        [0,1,0,0,0],
        [1,0,0,0,0],
        [1,1,1,1,1]
    ],
    '3': [
        [1,1,1,1,0],
        [0,0,0,0,1],
        [0,0,0,0,1],
        [0,1,1,1,0],
        [0,0,0,0,1],
        [0,0,0,0,1],
        [1,1,1,1,0]
    ],
    '4': [
        [0,0,0,1,0],
        [0,0,1,1,0],
        [0,1,0,1,0],
        [1,0,0,1,0],
        [1,1,1,1,1],
        [0,0,0,1,0],
        [0,0,0,1,0]
    ],
    '5': [
        [1,1,1,1,1],
        [1,0,0,0,0],
        [1,1,1,1,0],
        [0,0,0,0,1],
        [0,0,0,0,1],
        [1,0,0,0,1],
        [0,1,1,1,0]
    ],
    '6': [
        [0,0,1,1,0],
        [0,1,0,0,0],
        [1,0,0,0,0],
        [1,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [0,1,1,1,0]
    ],
    '7': [
        [1,1,1,1,1],
        [0,0,0,0,1],
        [0,0,0,1,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0]
    ],
    '8': [
        [0,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [0,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [0,1,1,1,0]
    ],
    '9': [
        [0,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [0,1,1,1,1],
        [0,0,0,0,1],
        [0,0,0,1,0],
        [0,1,1,0,0]
    ],
    ':': [
        [0,0,0,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,0,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,0,0,0]
    ],
    '.': [
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,1,1,0,0],
        [0,1,1,0,0]
    ],
    ',': [
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,1,0,0,0]
    ],
    '-': [
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [1,1,1,1,1],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0]
    ],
    '_': [
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [1,1,1,1,1]
    ],
    '/': [
        [0,0,0,0,1],
        [0,0,0,1,0],
        [0,0,0,1,0],
        [0,0,1,0,0],
        [0,1,0,0,0],
        [0,1,0,0,0],
        [1,0,0,0,0]
    ],
    '\\': [
        [1,0,0,0,0],
        [0,1,0,0,0],
        [0,1,0,0,0],
        [0,0,1,0,0],
        [0,0,0,1,0],
        [0,0,0,1,0],
        [0,0,0,0,1]
    ],
    '>': [
        [1,0,0,0,0],
        [0,1,0,0,0],
        [0,0,1,0,0],
        [0,0,0,1,0],
        [0,0,1,0,0],
        [0,1,0,0,0],
        [1,0,0,0,0]
    ],
    '<': [
        [0,0,0,0,1],
        [0,0,0,1,0],
        [0,0,1,0,0],
        [0,1,0,0,0],
        [0,0,1,0,0],
        [0,0,0,1,0],
        [0,0,0,0,1]
    ],
    '(': [
        [0,0,1,0,0],
        [0,1,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [0,1,0,0,0],
        [0,0,1,0,0]
    ],
    ')': [
        [0,0,1,0,0],
        [0,0,0,1,0],
        [0,0,0,0,1],
        [0,0,0,0,1],
        [0,0,0,0,1],
        [0,0,0,1,0],
        [0,0,1,0,0]
    ],
    '[': [
        [0,1,1,1,0],
        [0,1,0,0,0],
        [0,1,0,0,0],
        [0,1,0,0,0],
        [0,1,0,0,0],
        [0,1,0,0,0],
        [0,1,1,1,0]
    ],
    ']': [
        [0,1,1,1,0],
        [0,0,0,1,0],
        [0,0,0,1,0],
        [0,0,0,1,0],
        [0,0,0,1,0],
        [0,0,0,1,0],
        [0,1,1,1,0]
    ],
    '|': [
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0]
    ],
    ' ': [
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0]
    ],
    '?': [
        [0,1,1,1,0],
        [1,0,0,0,1],
        [0,0,0,0,1],
        [0,0,0,1,0],
        [0,0,1,0,0],
        [0,0,0,0,0],
        [0,0,1,0,0]
    ],
    '!': [
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,0,0,0],
        [0,0,1,0,0]
    ],
    '@': [
        [0,1,1,1,0],
        [1,0,0,0,1],
        [1,0,1,1,1],
        [1,0,1,0,1],
        [1,0,1,1,1],
        [1,0,0,0,0],
        [0,1,1,1,1]
    ],
    '#': [
        [0,1,0,1,0],
        [1,1,1,1,1],
        [0,1,0,1,0],
        [0,1,0,1,0],
        [1,1,1,1,1],
        [0,1,0,1,0],
        [0,0,0,0,0]
    ],
    '$': [
        [0,0,1,0,0],
        [0,1,1,1,1],
        [1,0,1,0,0],
        [0,1,1,1,0],
        [0,0,1,0,1],
        [1,1,1,1,0],
        [0,0,1,0,0]
    ],
    '%': [
        [1,1,0,0,1],
        [1,1,0,1,0],
        [0,0,0,1,0],
        [0,0,1,0,0],
        [0,1,0,0,0],
        [0,1,0,1,1],
        [1,0,0,1,1]
    ],
    '&': [
        [0,1,1,0,0],
        [1,0,0,1,0],
        [1,0,1,0,0],
        [0,1,0,0,0],
        [1,0,1,0,1],
        [1,0,0,1,0],
        [0,1,1,0,1]
    ],
    '*': [
        [0,0,0,0,0],
        [0,0,1,0,0],
        [1,0,1,0,1],
        [0,1,1,1,0],
        [1,0,1,0,1],
        [0,0,1,0,0],
        [0,0,0,0,0]
    ],
    '+': [
        [0,0,0,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [1,1,1,1,1],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,0,0,0]
    ],
    '=': [
        [0,0,0,0,0],
        [0,0,0,0,0],
        [1,1,1,1,1],
        [0,0,0,0,0],
        [1,1,1,1,1],
        [0,0,0,0,0],
        [0,0,0,0,0]
    ],
    ';': [
        [0,0,0,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,0,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,1,0,0,0]
    ],
    '\'': [
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,1,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0]
    ],
    '"': [
        [0,1,0,1,0],
        [0,1,0,1,0],
        [1,0,1,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0]
    ],
    '`': [
        [0,1,0,0,0],
        [0,0,1,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0]
    ],
    '~': [
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,1,0,0,1],
        [1,0,1,0,1],
        [1,0,0,1,0],
        [0,0,0,0,0],
        [0,0,0,0,0]
    ],
    '^': [
        [0,0,1,0,0],
        [0,1,0,1,0],
        [1,0,0,0,1],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0],
        [0,0,0,0,0]
    ],
    '{': [
        [0,0,0,1,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,1,0,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,0,1,0]
    ],
    '}': [
        [0,1,0,0,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,0,0,1,0],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,1,0,0,0]
    ]
};

// Lowercase letters map to uppercase
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
LOWERCASE.split('').forEach(letter => {
    CHAR_PATTERNS[letter] = CHAR_PATTERNS[letter.toUpperCase()];
});

interface CharacterMesh {
    group: THREE.Group;
    basePosition: THREE.Vector3;
    phase: number; // Random phase for animation
    voxels: THREE.Mesh[];
}

export class HoloTextRenderer {
    private parentGroup: THREE.Group;
    private textGroup: THREE.Group;
    private characterMeshes: CharacterMesh[] = [];
    private voxelGeometry: THREE.BoxGeometry;
    private baseMaterial: THREE.MeshBasicMaterial;

    // Layout settings - sized to fit inside the cube (3.6w x 4.8h x 1.8d)
    // Cube inner bounds: ±1.8 width, ±2.4 height (doubled)
    // Width: 60 × 6 × 0.009 = 3.24 (fits in 3.6)
    // Height: 45 × 8 × 0.009 = 3.24 (fits in 4.8)
    private readonly VOXEL_SIZE = 0.009;
    private readonly CHAR_WIDTH = 6; // 5 pixels + 1 spacing
    private readonly CHAR_HEIGHT = 8; // 7 pixels + 1 spacing
    private readonly MAX_COLS = 60;
    private readonly MAX_ROWS = 45;

    constructor(parentGroup: THREE.Group) {
        this.parentGroup = parentGroup;
        this.textGroup = new THREE.Group();
        this.parentGroup.add(this.textGroup);

        // Shared geometry for all voxels (instancing improves performance)
        this.voxelGeometry = new THREE.BoxGeometry(
            this.VOXEL_SIZE,
            this.VOXEL_SIZE,
            this.VOXEL_SIZE * 1.5 // Slight depth for 3D effect
        );

        // Base glowing material (hologram green until a theme palette is set)
        this.baseMaterial = new THREE.MeshBasicMaterial({
            color: this.baseColor,
            transparent: true,
            opacity: 0.9
        });
    }

    public setPalette(palette: HoloPalette) {
        this.baseColor = palette.normal;
        this.dimColor = palette.dim;
        this.baseMaterial.color.setHex(palette.normal);
    }

    public updateText(lines: string[], colors?: number[][]) {
        // Clear existing characters
        this.clearText();

        const startX = -((this.MAX_COLS * this.CHAR_WIDTH * this.VOXEL_SIZE) / 2);
        const startY = ((this.MAX_ROWS * this.CHAR_HEIGHT * this.VOXEL_SIZE) / 2);

        for (let row = 0; row < Math.min(lines.length, this.MAX_ROWS); row++) {
            const line = lines[row] || '';
            for (let col = 0; col < Math.min(line.length, this.MAX_COLS); col++) {
                const char = line[col];
                if (char === ' ') continue; // Skip spaces for performance

                const charMesh = this.createCharacterMesh(char, colors?.[row]?.[col]);
                if (charMesh) {
                    // Position character in grid
                    const x = startX + col * this.CHAR_WIDTH * this.VOXEL_SIZE;
                    const y = startY - row * this.CHAR_HEIGHT * this.VOXEL_SIZE;
                    const z = 0;

                    charMesh.group.position.set(x, y, z);
                    charMesh.basePosition.set(x, y, z);
                    charMesh.phase = Math.random() * Math.PI * 2;

                    this.textGroup.add(charMesh.group);
                    this.characterMeshes.push(charMesh);
                }
            }
        }
    }

    // Base text color and muted color for dim/autocomplete text
    private baseColor = 0x00ff66;
    private dimColor = 0x447755;

    private createCharacterMesh(char: string, color?: number): CharacterMesh | null {
        const pattern = CHAR_PATTERNS[char];
        if (!pattern) {
            // Unknown character, use a default box
            return this.createDefaultCharMesh(color);
        }

        const group = new THREE.Group();
        const voxels: THREE.Mesh[] = [];

        // Create material (clone if different color)
        let material = this.baseMaterial;
        if (color && color !== this.baseColor) {
            // Dim/autocomplete text gets lower opacity too
            const isDim = color === this.dimColor;
            material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: isDim ? 0.5 : 0.9
            });
        }

        // Create voxels for each pixel in the pattern
        for (let py = 0; py < pattern.length; py++) {
            for (let px = 0; px < pattern[py].length; px++) {
                if (pattern[py][px] === 1) {
                    const voxel = new THREE.Mesh(this.voxelGeometry, material);
                    voxel.position.set(
                        px * this.VOXEL_SIZE,
                        -py * this.VOXEL_SIZE, // Y inverted for screen coords
                        0
                    );
                    group.add(voxel);
                    voxels.push(voxel);
                }
            }
        }

        return {
            group,
            basePosition: new THREE.Vector3(),
            phase: 0,
            voxels
        };
    }

    private createDefaultCharMesh(color?: number): CharacterMesh {
        const group = new THREE.Group();
        let material = this.baseMaterial;
        if (color && color !== this.baseColor) {
            material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.9
            });
        }
        const voxel = new THREE.Mesh(this.voxelGeometry, material);
        group.add(voxel);
        return {
            group,
            basePosition: new THREE.Vector3(),
            phase: 0,
            voxels: [voxel]
        };
    }

    public update(time: number) {
        // Animate each character with floating/wobble effect
        for (const charMesh of this.characterMeshes) {
            // Subtle Y float
            const floatY = Math.sin(time * 2 + charMesh.phase) * 0.003;
            // Subtle Z wobble (depth)
            const wobbleZ = Math.sin(time * 1.5 + charMesh.phase * 1.3) * 0.002;
            // Very subtle rotation
            const rotX = Math.sin(time * 0.8 + charMesh.phase) * 0.02;
            const rotY = Math.cos(time * 0.6 + charMesh.phase * 0.8) * 0.02;

            charMesh.group.position.y = charMesh.basePosition.y + floatY;
            charMesh.group.position.z = charMesh.basePosition.z + wobbleZ;
            charMesh.group.rotation.x = rotX;
            charMesh.group.rotation.y = rotY;
        }
    }

    private clearText() {
        for (const charMesh of this.characterMeshes) {
            this.textGroup.remove(charMesh.group);
            // Dispose geometries and materials
            for (const voxel of charMesh.voxels) {
                if (voxel.material !== this.baseMaterial) {
                    (voxel.material as THREE.Material).dispose();
                }
            }
        }
        this.characterMeshes = [];
    }

    public dispose() {
        this.clearText();
        this.parentGroup.remove(this.textGroup);
        this.voxelGeometry.dispose();
        this.baseMaterial.dispose();
    }
}
