# CPlay — VAULT

A personal game launcher built with Tauri, React, and TypeScript. VAULT gives you a clean, fast, and private home for your game library — without the overhead of a storefront.

---

## What it is

VAULT is a desktop application for organizing and launching games on Windows. You add games manually or let the scanner find them, and from there you get a library view, per-game stats tracking, an achievement system, notes, and a Steam-style overlay that shows notifications while you play — all in a single application that runs natively without a browser engine doing heavy lifting.

The name "VAULT" reflects the idea of keeping your games in one secure, personal place. The project folder is called `CPlay` — the original codename during early development.

---

## Features

- **Game Library** — Add games from any folder on your machine. The scanner can search common install paths automatically and return results for you to confirm.
- **Game Launching** — Launch games directly from the app. The launcher tracks whether a game is currently running and updates the UI accordingly.
- **Achievements** — Define and track custom achievements per game, with a dedicated panel that shows progress and unlock history.
- **In-game Overlay** — A transparent, always-on-top overlay window shows notifications in the bottom-right corner while a game is open. Notifications auto-dismiss and stack cleanly without overlapping.
- **Notes** — Attach personal notes to any game in your library for tips, progress tracking, or anything else.
- **Favorites** — Mark games as favorites and view them in a separate, quick-access section.
- **Profile Page** — Tracks your overall playtime, games played, and achievement stats.
- **Settings** — Control app behavior and test overlay functionality from within the application.
- **Custom Title Bar** — The app uses a frameless window with a fully custom title bar for a clean, native-feeling experience on Windows.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | [Tauri 2](https://tauri.app) |
| Frontend | React 19 + TypeScript |
| Build Tool | Vite |
| State Management | Zustand |
| Animations | Framer Motion |
| Icons | Lucide React |
| Backend | Rust |

The main window and the overlay run as two separate Tauri windows. The overlay is transparent and always-on-top, sized to cover the entire screen so notifications can be positioned anywhere without clipping.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://rustup.rs/) (stable toolchain)
- [Tauri Prerequisites for Windows](https://tauri.app/start/prerequisites/) (Microsoft C++ Build Tools / WebView2)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/AchiraStudio/CPlay.git
cd CPlay
npm install
```

### Running in Development

```bash
npm run tauri dev
```

This starts the Vite dev server and the Tauri app simultaneously. Hot reloading is active for the frontend. Rust changes require a recompile, which Tauri handles automatically.

### Building for Production

```bash
npm run tauri build
```

The output installer and executable will be placed in `src-tauri/target/release/bundle/`. This folder is excluded from version control.

---

## Project Structure

```
CPlay/
├── src/                    # React frontend
│   ├── components/         # All UI components (pages, panels, modals, overlay badges)
│   ├── store/              # Zustand store and data types
│   ├── hooks/              # Custom React hooks
│   ├── App.tsx             # Main app shell and routing
│   └── OverlayApp.tsx      # Overlay window root
├── src-tauri/              # Rust backend (Tauri)
│   ├── src/                # Rust source files
│   │   ├── main.rs         # Entry point, Tauri setup
│   │   ├── lib.rs          # Command handlers exposed to the frontend
│   │   └── scanner.rs      # Game scanning logic
│   ├── capabilities/       # Tauri permission definitions
│   ├── resources/          # Bundled resources (e.g., helper scripts)
│   └── tauri.conf.json     # Tauri configuration
├── public/                 # Static assets
├── index.html              # Main window HTML entry
├── overlay.html            # Overlay window HTML entry
└── vite.config.ts          # Vite build configuration
```

---

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) with the following extensions:

- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

---

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
