# RetroShell

A retro-styled PowerShell terminal for Windows, with CRT effects, keyboard sounds and a 3D holographic mode.

![RetroShell in the DOS Blue theme](screenshots/terminal.png)

![RetroShell in 3D mode](screenshots/3d-mode.png)

## Features

- **A real terminal** - a full PowerShell session running through xterm.js and node-pty.
- **Four themes** - Holographic, DOS Blue, Amber and Green Phosphor.
- **CRT look** - scanlines, flicker and phosphor glow.
- **Sound effects** - synthesized key clicks, spacebar, return and bell sounds. Can be switched off.
- **3D mode** - the live terminal rendered as voxel text inside a rotating wireframe cube. You can keep typing while it is on.
- **File graph** - in 3D mode, switch from CUBE to FILES and the cube bursts open into a floating graph of the shell's current folder. Folders open and close as you click them, files are drawn as a different wireframe shape per kind, and clicking a file puts its path on the command line.

## Controls

| Action | How |
| --- | --- |
| Toggle 3D mode | `Ctrl+3` or the `3D` button |
| Open settings (theme, sound) | `Ctrl+,` or the `*` button |
| Rotate the cube | Drag with the mouse |
| Reset the cube | Double-click it |
| Resize the window | Drag any edge or corner |
| Move the window | Drag the title bar |

### File graph

| Action | How |
| --- | --- |
| Switch between cube and file graph | `CUBE` / `FILES` in the corner of the 3D view |
| Open or close a folder | Click it |
| Make a folder the centre of the graph | Right-click or double-click it |
| Go up a folder | `UP`, or double-click the ringed root at the centre |
| Put a file's path on the command line | Click the file |
| Show a file's details | Double-click the file |
| See a node's full name | Hover over it |
| Rotate / zoom | Drag / scroll |

The graph starts at the shell's current folder and follows it when you `cd`. The file details panel can also re-centre the graph on the file's folder or show the file in Windows Explorer. Labels are hidden where they would overlap; zoom in or hover to see more.

| Shape | Kind of file |
| --- | --- |
| Diamond | Folder (the root has a ring around it) |
| Cube | Code |
| Pyramid | Data / config |
| Upright page | Document |
| Picture frame | Image |
| Record | Audio |
| Play triangle | Video |
| Box in a box | Archive |
| Faceted gem | Program / script |
| Mesh sphere | 3D model |
| Dot | Anything else |

## Running from source

You need [Node.js](https://nodejs.org/) on Windows. `node-pty` is a native module that gets rebuilt for Electron during install, which needs the Visual Studio C++ build tools.

```bash
npm install
npm start
```

## Building an installer

```bash
npm run dist:win
```

This writes an NSIS installer and a portable `.exe` to `release/`. The packaged app asks for administrator rights when it starts.

## Built with

[Electron](https://www.electronjs.org/), [xterm.js](https://xtermjs.org/), [node-pty](https://github.com/microsoft/node-pty) and [three.js](https://threejs.org/).

## License

[MIT](LICENSE) © 2026 Ron Millar
