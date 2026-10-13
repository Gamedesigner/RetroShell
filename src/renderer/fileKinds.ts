// Sorts files into broad kinds by extension. The file graph draws each kind as
// its own wireframe shape and the info panel names it.

export type FileKind =
    | 'code' | 'data' | 'document' | 'image' | 'audio'
    | 'video' | 'archive' | 'program' | 'model' | 'other';

const KIND_EXTENSIONS: Record<Exclude<FileKind, 'other'>, string[]> = {
    code: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'cs', 'c', 'h', 'cpp', 'hpp', 'java', 'go', 'rs', 'rb',
        'php', 'lua', 'swift', 'kt', 'html', 'htm', 'css', 'scss', 'glsl', 'shader', 'sql'],
    data: ['json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'cfg', 'conf', 'env', 'lock', 'csv', 'db', 'sqlite'],
    document: ['md', 'txt', 'pdf', 'doc', 'docx', 'rtf', 'log', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'],
    image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'psd', 'tga', 'tif', 'tiff', 'exr', 'hdr'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aif', 'aiff', 'mid', 'midi'],
    video: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'wmv'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso'],
    program: ['exe', 'msi', 'dll', 'bat', 'cmd', 'ps1', 'sh', 'com', 'lnk'],
    model: ['blend', 'glb', 'gltf', 'fbx', 'obj', 'stl', 'dae', '3ds', 'usd', 'usdz', 'ply'],
};

export const FILE_KIND_LABELS: Record<FileKind, string> = {
    code: 'Code',
    data: 'Data / config',
    document: 'Document',
    image: 'Image',
    audio: 'Audio',
    video: 'Video',
    archive: 'Archive',
    program: 'Program / script',
    model: '3D model',
    other: 'File',
};

const KIND_BY_EXTENSION = new Map<string, FileKind>();
for (const [kind, extensions] of Object.entries(KIND_EXTENSIONS)) {
    for (const extension of extensions) {
        KIND_BY_EXTENSION.set(extension, kind as FileKind);
    }
}

// Extension without the dot, lower case ("" when the name has none)
export function fileExtension(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function fileKind(name: string): FileKind {
    return KIND_BY_EXTENSION.get(fileExtension(name)) ?? 'other';
}
