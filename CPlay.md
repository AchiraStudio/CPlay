# CPlay — Complete Code Documentation

> A Tauri (Rust + Vite + React) cracked game launcher with SteamOS/PS5-inspired UI,
> crack detection, achievement tracking, and a transparent in-game overlay.

---

## Table of Contents

1. [Project Architecture](#1-project-architecture)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Data Layer — `src/store/`](#3-data-layer--srcstore)
   - [useStore.ts](#31-usestorets)
   - [demoData.ts](#32-demodatats)
4. [Frontend Components — `src/components/`](#4-frontend-components--srccomponents)
   - [App.tsx](#41-apptsx)
   - [TitleBar.tsx](#42-titlebartsx)
   - [Sidebar.tsx](#43-sidebartsx)
   - [LibraryPage.tsx](#44-librarypagetsx)
   - [GameCard.tsx](#45-gamecardtsx)
   - [AchievementPanel.tsx](#46-achievementpaneltsx)
   - [AchievementOverlay.tsx](#47-achievementoverlaytsx)
   - [AddGameModal.tsx](#48-addgamemodaltsx)
5. [Rust Backend — `src-tauri/src/`](#5-rust-backend--src-taurisrc)
   - [lib.rs](#51-librs)
   - [scanner.rs](#52-scannerrs)
6. [Overlay Window — `public/overlay.html`](#6-overlay-window--publicoverlayhtml)
7. [Global Styles — `src/App.css`](#7-global-styles--srcappcss)
8. [Data Flow Diagrams](#8-data-flow-diagrams)
9. [Python → Rust: Function Mapping](#9-python--rust-function-mapping)
10. [What Each File Owns](#10-what-each-file-owns)

---

## 1. Project Architecture

```
vault-launcher/
│
├── src/                          ← React frontend (Vite + TypeScript)
│   ├── App.tsx                   ← Root component, layout shell
│   ├── App.css                   ← Global CSS variables & keyframes
│   ├── main.tsx                  ← ReactDOM.createRoot entry point
│   ├── tauri.d.ts                ← TypeScript types for window.__TAURI__
│   │
│   ├── store/
│   │   ├── useStore.ts           ← Zustand global state (ALL app state lives here)
│   │   └── demoData.ts           ← 4 hardcoded seed games for first launch
│   │
│   └── components/
│       ├── TitleBar.tsx/.css     ← Custom window chrome (drag bar + controls)
│       ├── Sidebar.tsx/.css      ← Collapsible left nav + favorites list
│       ├── LibraryPage.tsx/.css  ← Main page: wallpaper hero + game shelf
│       ├── GameCard.tsx/.css     ← Individual game thumbnail card
│       ├── AchievementPanel.tsx/.css  ← Slide-in achievement list panel
│       ├── AchievementOverlay.tsx/.css ← In-launcher PS5-style toast
│       └── AddGameModal.tsx/.css ← Add game dialog + crack scanner UI
│
├── public/
│   └── overlay.html              ← Standalone transparent fullscreen overlay window
│
└── src-tauri/
    ├── tauri.conf.json           ← Window config, app metadata, build targets
    └── src/
        ├── main.rs               ← Binary entry point (calls lib.rs run())
        └── lib.rs                ← Tauri commands: launch_game, scan_game
        └── scanner.rs            ← Full crack detection + save path logic (Rust port of Python script)
```

---

## 2. Tech Stack & Dependencies

| Layer | Technology | Purpose |
|---|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) | Wraps Vite/React in a native window; provides Rust backend bridge |
| UI framework | React 18 + TypeScript | Component tree |
| Build tool | Vite 7 | Dev server + production bundler |
| State management | [Zustand](https://zustand-demo.pmnd.rs/) | Global store with `localStorage` persistence |
| Animations | CSS keyframes (no library) | All transitions are pure CSS for performance |
| Icons | [Lucide React](https://lucide.dev/) | SVG icon set |
| Rust serialization | serde + serde_json | Serializes `ScanResult` struct to JSON for the frontend |
| Fonts | Rajdhani (display) + Inter (body) | Loaded from Google Fonts |

**`package.json` key deps:**
```json
"zustand"       — global state
"lucide-react"  — icons
"framer-motion" — installed, available for future use
```

---

## 3. Data Layer — `src/store/`

### 3.1 `useStore.ts`

**Role:** Single source of truth for the entire app. Every component reads from and writes to this store. Nothing is stored in local React state except UI-only ephemeral values (e.g. animation flags).

#### Interfaces

```typescript
interface Achievement {
  id: string          // Unique ID, e.g. "a1"
  name: string        // Display name, e.g. "First Blood"
  description: string // What the player did
  icon?: string       // Optional URL to achievement icon image
  unlocked: boolean   // Whether the player has earned this
  unlockedAt?: string // ISO timestamp of when it was unlocked
  hidden?: boolean    // If true: shown as "? hidden" until unlocked
}
```

```typescript
interface Game {
  id: string              // Unique ID, e.g. "game-001"
  title: string           // Display name
  exePath: string         // Full path to .exe, e.g. "C:\Games\Game\game.exe"
  coverImage?: string     // Optional portrait cover art URL
  heroImage?: string      // Optional wide hero image URL
  wallpaperImage?: string // Full-screen background URL — drives dynamic wallpaper
  thumbnailColor: string  // Dominant dark color (hex) used in gradients
  accentColor: string     // Bright accent color (hex) — used for buttons, glow, badges
  genre?: string          // e.g. "RPG", "Action"
  developer?: string      // Crack group name, e.g. "CODEX"
  lastPlayed?: string     // ISO timestamp
  playtime: number        // Total minutes played
  appId?: string          // Steam App ID (or EA content ID for Anadius)
  emulator?: 'codex' | 'goldberg' | 'anadius' | 'unknown'
  achievements: Achievement[]
  saveFolder?: string     // Full path to the save/achievement folder on disk
  isRunning?: boolean     // Whether the game process is currently active
  isFavorite?: boolean    // Pinned to sidebar
}
```

#### State Fields

| Field | Type | Description |
|---|---|---|
| `games` | `Game[]` | All games in the library |
| `selectedGameId` | `string \| null` | Which game is shown in the hero section |
| `isAddingGame` | `boolean` | Controls whether `AddGameModal` renders |
| `overlayVisible` | `boolean` | Whether the Tauri overlay window is showing |
| `overlayGameId` | `string \| null` | Which game triggered the overlay |
| `recentAchievement` | `Achievement \| null` | The achievement to show in the toast; `null` = toast hidden |
| `sidebarCollapsed` | `boolean` | Sidebar width mode — `true` = icon-only, `false` = expanded |

#### Action Functions

```typescript
addGame(game: Game)
```
Appends a new game to the `games` array. Called by `AddGameModal` when the user clicks "Add to Library".

```typescript
updateGame(id: string, updates: Partial<Game>)
```
Merges `updates` into the game with matching `id`. Used to update `lastPlayed` when launching, or `isRunning` state.

```typescript
removeGame(id: string)
```
Removes a game. Also clears `selectedGameId` if the removed game was selected.

```typescript
selectGame(id: string | null)
```
Changes which game is featured in the hero. Triggers the wallpaper crossfade in `LibraryPage`.

```typescript
setAddingGame(val: boolean)
```
Opens (`true`) or closes (`false`) the `AddGameModal`.

```typescript
showOverlay(gameId: string) / hideOverlay()
```
Manages the Tauri overlay window state. Not directly used to open the window — that goes through `lib.rs` via `invoke()`.

```typescript
triggerAchievement(ach: Achievement)
```
Sets `recentAchievement`, which causes `AchievementOverlay` to render the toast. Auto-clears after 4 seconds via `clearAchievement()`.

```typescript
clearAchievement()
```
Sets `recentAchievement` back to `null`, which unmounts the toast.

```typescript
toggleSidebar()
```
Flips `sidebarCollapsed`. The sidebar CSS uses `width` driven by this value.

```typescript
toggleFavorite(id: string)
```
Flips the `isFavorite` boolean on the matching game. Favorites appear in the sidebar list.

```typescript
unlockAchievement(gameId: string, achId: string)
```
Sets `unlocked: true` and stamps `unlockedAt` on the matching achievement inside the matching game. Immutably maps over both the games array and the achievements array.

#### Persistence

```typescript
persist(..., {
  name: 'vault-launcher-store',
  partialize: (s) => ({
    games: s.games,
    selectedGameId: s.selectedGameId,
    sidebarCollapsed: s.sidebarCollapsed,
  }),
})
```

Uses Zustand's `persist` middleware. Saves only the listed fields to `localStorage` under the key `vault-launcher-store`. UI state like `isAddingGame` and `recentAchievement` is intentionally excluded — they reset on every launch.

---

### 3.2 `demoData.ts`

**Role:** Seeds the library with 4 realistic games on first launch, so the app doesn't open to an empty screen.

Each entry is a full `Game` object with:
- A real Unsplash wallpaper URL
- A `thumbnailColor` (dominant dark color extracted from the wallpaper)
- An `accentColor` (vibrant highlight color matching the game's theme)
- Sample achievements (mix of locked/unlocked/hidden)
- A simulated emulator type and App ID

**Used by:** `App.tsx` checks `if (games.length === 0)` and calls `addGame()` for each demo game.

---

## 4. Frontend Components — `src/components/`

### 4.1 `App.tsx`

**Role:** Root layout component. Renders the full window shell.

```typescript
// Structure it renders:
<div class="app-root">          ← full window, rounded corners, border
  <TitleBar />                  ← 36px drag bar at top
  <div class="app-body">
    <Sidebar />                 ← left nav
    <main class="app-content">
      <LibraryPage />           ← everything else
    </main>
  </div>
  {isAddingGame && <AddGameModal />}       ← mounted when user clicks "Add Game"
  {recentAchievement && <AchievementOverlay />}  ← mounted when achievement fires
</div>
```

**Logic:**
```typescript
useEffect(() => {
  if (games.length === 0) {
    DEMO_GAMES.forEach(addGame)
  }
}, [])
```
Runs once on mount. If `localStorage` has no games (first ever launch), loads all 4 demo games.

---

### 4.2 `TitleBar.tsx`

**Role:** Replaces the OS window title bar. Provides: app logo, active game breadcrumb, minimize/maximize/close buttons.

**Key detail:** `data-tauri-drag-region` on the outer `<div>` and center `<div>` tells Tauri that clicking and dragging those areas moves the window. Without this attribute the custom titlebar wouldn't be draggable.

**Window controls** call Tauri's JavaScript API:
```typescript
window.__TAURI__?.window.getCurrent().minimize()
window.__TAURI__?.window.getCurrent().toggleMaximize()
window.__TAURI__?.window.getCurrent().close()
```

The `?.` optional chain means these silently do nothing in the browser (when running `npm run dev` without Tauri), so you can still develop in a regular browser.

**Reads from store:** `selectedGameId` → finds the matching game → shows its title as a breadcrumb: `VAULT › Strange Clan`

**Status dot:** The green animated pulse in the center is purely decorative — it indicates the app is running. Can be wired later to show whether a game process is active.

---

### 4.3 `Sidebar.tsx`

**Role:** Collapsible left navigation panel. Shows nav items, favorites list, Add Game button, and a collapse toggle.

**Two width modes** controlled by `sidebarCollapsed` from the store:
- `false` → `width: var(--sidebar-expanded)` (220px) — shows labels
- `true`  → `width: var(--sidebar-width)` (72px) — shows icons only

The CSS `transition: width 0.25s` makes the collapse animate smoothly.

**Favorites list:**
```typescript
const favorites = games.filter(g => g.isFavorite)
```
Filters the games array and renders a small color-coded row for each. Clicking one calls `selectGame(g.id)` which switches the hero wallpaper.

**Add Game button:** Calls `setAddingGame(true)` which mounts `AddGameModal`.

---

### 4.4 `LibraryPage.tsx`

**Role:** The main content area. The largest and most complex component. Handles:
1. Dynamic wallpaper crossfade
2. Hero information display (title, stats, actions)
3. Game shelf (horizontal scroll grid)
4. Achievement panel integration

#### Dynamic Wallpaper System

```typescript
const [wallpaperLoaded, setWallpaperLoaded] = useState(false)
const [prevWallpaper, setPrevWallpaper] = useState<string | undefined>()

useEffect(() => {
  setPrevWallpaper(selectedGame?.wallpaperImage)  // save current as "prev"
  setWallpaperLoaded(false)                        // hide new wallpaper
  const t = setTimeout(() => setWallpaperLoaded(true), 50)  // tiny delay, then fade in
  return () => clearTimeout(t)
}, [selectedGameId])
```

Two `<div>` layers are stacked:
- `.wallpaperPrev` — the old wallpaper, always visible
- `.wallpaper` — the new wallpaper, fades from `opacity: 0` to `opacity: 1` via `.wallpaperVisible`

This creates a clean crossfade instead of a jarring swap.

#### Hero Section

Reads from `selectedGame` (the currently highlighted game). Shows:
- Emulator badge (colored in the game's `accentColor`)
- Genre badge
- Game title in Rajdhani display font with text-shadow glow
- Stats row: playtime, achievement count, last played
- Action buttons: Play, Favorite, Achievements toggle, Crack info

**`formatPlaytime(mins)`** — converts raw minutes to human-readable:
```
347  → "5h 47m"
45   → "45m"
120  → "2h"
```

**`timeAgo(iso)`** — converts ISO timestamp to relative time:
```
"2024-01-14T10:00:00Z"  →  "2d ago"  /  "3h ago"  /  "Recently"
```

**Play button:**
```typescript
function handlePlay() {
  updateGame(selectedGame.id, { lastPlayed: new Date().toISOString() })
  // In Tauri: invoke('launch_game', { path: selectedGame.exePath })
  alert(`Launching: ...`)
}
```
Currently shows an alert. Replace the `alert()` line with `invoke('launch_game', { path: selectedGame.exePath })` to wire up the Rust launcher.

#### Achievement Panel Toggle

```typescript
const [showAchievements, setShowAchievements] = useState(false)
```
Local state (not in the store) because it's purely a UI concern — whether the panel slides in from the right of the hero. Toggled by the Trophy button.

#### Game Shelf

```typescript
const scrollRef = useRef<HTMLDivElement>(null)

function scrollCards(dir: 'left' | 'right') {
  scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' })
}
```

The shelf is a `display: flex` horizontal overflow container. The Left/Right chevron buttons call `scrollBy` on it. Individual `<GameCard>` components are rendered for every game.

---

### 4.5 `GameCard.tsx`

**Role:** A single game thumbnail in the shelf. Shows cover art, title, playtime, achievement count, and an achievement progress bar.

**Props:**
```typescript
interface Props {
  game: Game
  isSelected: boolean   // adds extra lift transform + glow border
  onSelect: () => void  // calls selectGame(game.id) from the parent
  style?: React.CSSProperties  // used for staggered animation-delay
}
```

**Cover art fallback:** If `game.wallpaperImage` is set, it renders as `<img>` with `object-fit: cover`. If not, it falls back to a CSS gradient using `thumbnailColor` + `accentColor`.

**Achievement progress bar:**
```typescript
const pct = total > 0 ? (unlocked / total) * 100 : 0
// Renders as a thin 2px bar at the bottom of the card info area
// Width is set inline: style={{ width: `${pct}%`, background: game.accentColor }}
```

**Hover play button:** An absolutely-positioned overlay that fades in on CSS `:hover` via the `.hoverPlay` class (opacity 0 → 1). Contains a circle with the game's `accentColor` border and a Play icon.

**Selected state:** When `isSelected` is true, the card is lifted higher (`translateY(-6px) scale(1.03)`) and shows a `box-shadow` inset border in `accentColor`.

**Favorite dot:** A tiny 6px circle in the top-right corner, colored with `accentColor`, only shown when `isFavorite` is true.

**Staggered animation:** The parent passes `style={{ animationDelay: `${i * 40}ms` }}`. Each card has the class `animate-fade` which runs `fadeIn` — so card 0 appears at 0ms, card 1 at 40ms, etc.

---

### 4.6 `AchievementPanel.tsx`

**Role:** A slide-in panel that appears to the right of the hero content when the user clicks the Trophy button. Lists all achievements for the selected game.

**Props:**
```typescript
interface Props {
  game: Game
  onClose: () => void
}
```

**Groups achievements into 3 buckets:**
```typescript
const unlocked = game.achievements.filter(a => a.unlocked)
const locked   = game.achievements.filter(a => !a.unlocked && !a.hidden)
const hidden   = game.achievements.filter(a => !a.unlocked && a.hidden)
```

Hidden locked ones are shown as a single collapsed row: `"2 hidden achievements — Keep playing to discover"` rather than revealing their names.

**Progress bar** at the top:
```typescript
const pct = Math.round((unlocked.length / game.achievements.length) * 100)
```

**Test Unlock button (dev feature):**
```typescript
function handleTestUnlock(achId: string) {
  const ach = game.achievements.find(a => a.id === achId)
  unlockAchievement(game.id, achId)   // update store
  triggerAchievement({ ...ach, unlocked: true })  // fire the toast
}
```
Each locked achievement has a small "test" button. Clicking it:
1. Marks it as unlocked in the store (persisted)
2. Fires `triggerAchievement()` which mounts `AchievementOverlay` with this achievement's data
3. You can see the PS5-style toast appear in the corner

This simulates what the file watcher will do automatically once that feature is built.

---

### 4.7 `AchievementOverlay.tsx`

**Role:** A floating toast notification that slides in from the bottom-right when an achievement is unlocked. Positioned with `position: fixed` so it works over any content in the launcher window.

**Reads from store:** `recentAchievement` — when non-null, this component renders.

**Auto-dismiss timer:**
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    setLeaving(true)                        // triggers the slide-out animation class
    setTimeout(clearAchievement, 400)       // unmounts after animation completes
  }, 4000)
  return () => clearTimeout(timer)          // cleanup if component unmounts early
}, [recentAchievement])
```

**Two-phase exit animation:**
1. After 4s: `setLeaving(true)` adds `.toastOut` class → CSS plays `achieveOut` slide-out keyframe (400ms)
2. After 4.4s: `clearAchievement()` sets `recentAchievement = null` → component unmounts

**Progress bar:**
```css
.accentBar {
  animation: shrinkBar 4s linear forwards;
  transform-origin: left;
}
@keyframes shrinkBar {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}
```
A colored bar at the top of the toast that shrinks from full width to nothing over exactly 4 seconds — giving a visual countdown matching the dismiss timer.

**Dynamic accent color:** The game's `accentColor` is passed via a CSS custom property:
```typescript
style={{ '--accent': game?.accentColor ?? '#4a9eff' } as React.CSSProperties}
```

**Note on in-game overlay:** This toast is for use *inside the launcher window*. For the overlay that appears *over running games*, see `overlay.html` (section 6).

---

### 4.8 `AddGameModal.tsx`

**Role:** Full-screen modal for adding a new game to the library. Contains:
1. A form (title, exe path, genre)
2. Crack scanner (calls `simulateScan()` — wired to Rust `scan_game` command)
3. Visual customization (wallpaper picker, accent color picker)
4. Live preview of how the game will look in the hero

#### Backdrop + modal structure

```typescript
<div className={styles.backdrop} onClick={() => setAddingGame(false)}>
  <div className={styles.modal} onClick={e => e.stopPropagation()}>
    ...
  </div>
</div>
```

Clicking the backdrop closes the modal. `stopPropagation()` on the modal itself prevents that click from bubbling to the backdrop.

#### Crack Scanner (JS simulation)

```typescript
function simulateScan(exePath: string): ScanResult {
  const lower = exePath.toLowerCase()
  if (lower.includes('steam_emu') || lower.includes('codex')) {
    return { emulator: 'codex', appId: String(Math.floor(Math.random() * 9000000 + 1000000)) }
  }
  if (lower.includes('goldberg') || lower.includes('steam_settings')) {
    return { emulator: 'goldberg', ... }
  }
  if (lower.includes('anadius')) {
    return { emulator: 'anadius', ... }
  }
  return { emulator: 'unknown' }
}
```

This is a **client-side simulation** that guesses the emulator from the path string. It runs instantly in the browser, which is why there's a fake 900ms `setTimeout` delay — to simulate the feel of a real scan.

**To connect to real Rust scanner**, replace the `setTimeout` block with:
```typescript
import { invoke } from '@tauri-apps/api/core'

async function handleScan() {
  setScanning(true)
  const dir = exePath.replace(/[/\\][^/\\]+$/, '')  // strip filename, get folder
  const result = await invoke<ScanResult>('scan_game', { path: dir })
  setScanResult(result)
  setScanning(false)
}
```

#### Game Creation

```typescript
function handleAdd() {
  const id = `game-${Date.now()}`
  const newGame: Game = {
    id,
    title,
    exePath,
    wallpaperImage: wallpaper,
    thumbnailColor: '#0a0a0f',      // default dark
    accentColor,
    genre: genre || undefined,
    playtime: 0,
    achievements: [],
    emulator: scanResult?.emulator,
    appId: scanResult?.appId,
    saveFolder: scanResult?.saveFolder,
  }
  addGame(newGame)       // adds to store (and localStorage)
  selectGame(id)         // immediately shows the new game in hero
  setAddingGame(false)   // closes modal
}
```

#### Wallpaper & Color Pickers

**`BG_PRESETS`** — 5 Unsplash landscape images. Clicking one sets `wallpaper` state, which updates the live preview immediately.

**`ACCENT_PRESETS`** — 8 color options. Each renders as a colored circle button. Clicking one sets `accentColor` state. The selected one gets a white ring via `.colorDotActive`.

**Live preview:**
```tsx
<div
  className={styles.preview}
  style={{ backgroundImage: `url(${wallpaper})` }}
>
  <div className={styles.previewTitle} style={{ color: accentColor }}>
    {title || 'Game Title'}
  </div>
</div>
```
As the user types a title or picks colors/wallpapers, this mini preview updates in real time.

---

## 5. Rust Backend — `src-tauri/src/`

### 5.1 `lib.rs`

**Role:** Defines and registers all Tauri commands — the bridge between the JS frontend and Rust backend. The `#[tauri::command]` attribute macro makes a Rust function callable from JavaScript via `invoke()`.

#### `launch_game(path: String) → Result<(), String>`

```rust
#[tauri::command]
async fn launch_game(path: String) -> Result<(), String> {
    let game_path = Path::new(&path);
    if !game_path.exists() {
        return Err(format!("Executable not found: {}", path));
    }
    let parent = game_path.parent().unwrap_or(Path::new("."));
    Command::new(&path)
        .current_dir(parent)  // sets working directory to game folder
        .spawn()              // non-blocking — Rust returns immediately
        .map_err(|e| format!("Failed to launch: {}", e))?;
    Ok(())
}
```

Called from JS as:
```typescript
await invoke('launch_game', { path: 'C:\\Games\\game.exe' })
```

Sets the working directory to the game's parent folder before spawning. This is important because many games load assets relative to their working directory. `.spawn()` is non-blocking — the game starts and Rust returns immediately without waiting for the game to exit.

#### `scan_game(path: String) → Result<ScanResult, String>`

```rust
#[tauri::command]
async fn scan_game(path: String) -> Result<ScanResult, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    Ok(scan_game_path(root))
}
```

Called from JS as:
```typescript
const result = await invoke<ScanResult>('scan_game', { path: 'C:\\Games\\GameFolder' })
```

Note: pass the **folder** path, not the `.exe` path. The scanner walks the folder to detect crack files.

`ScanResult` is a `#[derive(Serialize)]` struct, so Tauri automatically converts it to a JSON object that the frontend can use as a TypeScript type.

#### `run()` function

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![launch_game, scan_game])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`generate_handler![]` is a macro that registers all listed commands so Tauri knows to route `invoke('launch_game', ...)` to the `launch_game` function. Any new commands you add must be listed here.

---

### 5.2 `scanner.rs`

**Role:** Direct Rust port of the Python `scan_game()` function and all its helpers. This is the core crack detection engine.

#### `ScanResult` struct

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanResult {
    pub game_path: String,
    pub emulator: String,           // "codex" | "goldberg" | "anadius" | "unknown"
    pub app_id: Option<String>,     // Steam App ID or EA Content ID
    pub save_folder: Option<String>,
    pub achievements_ini: Option<String>,   // CODEX only
    pub achievements_json: Option<String>,  // CODEX + Goldberg
    pub achievements_xml: Option<String>,   // Anadius only
    pub best_exe: Option<String>,
}
```

`Option<String>` means the field may be `null` in JSON — the frontend handles this with `?.` optional chaining.

#### `scan_game_path(game_root: &Path) → ScanResult`

The main entry point. Orchestrates the full scan:

1. Calls `find_best_exe()` immediately
2. Calls `detect_emulator()` to identify the crack type
3. Branches on emulator type to extract App ID and find save files
4. Returns the populated `ScanResult`

```
scan_game_path(root)
  ├── find_best_exe(root)        → best_exe field
  ├── detect_emulator(root)      → emulator field
  └── match emulator {
        "codex"   → parse_codex_appid()    → app_id
                    get_codex_save_dir()   → save_folder
                    check for .ini/.json   → achievements_*
        "goldberg" → read_appid_txt()      → app_id
                    get_goldberg_save_dir() → save_folder
                    check for .json        → achievements_json
        "anadius"  → parse_anadius_content_id() → app_id
                    get_anadius_save_base()      → save_folder
                    scan dir for matching .xml   → achievements_xml
      }
```

#### `detect_emulator(root: &Path) → String`

Checks for crack-specific marker files in priority order:

```rust
// Priority 1: anadius.cfg in game root
if root.join("anadius.cfg").exists() → "anadius"

// Priority 2: steam_emu.ini (CODEX primary marker)
if root.join("steam_emu.ini").exists() → "codex"

// Priority 3: any .cdx file in root dir
if any file has .cdx extension → "codex"

// Priority 4: steam_settings/ folder (Goldberg canonical marker)
if root.join("steam_settings").is_dir() → "goldberg"

// Priority 5: steam_api dll present anywhere in tree
if find_file_recursive("steam_api64.dll" or "steam_api.dll") → "goldberg"

// Fallback
→ "unknown"
```

The priority order matters — Anadius is checked before CODEX/Goldberg because its marker is the most specific.

#### `score_exe(path: &Path) → i32`

Scores an `.exe` file to find the most likely game executable:

```rust
SKIP_KEYWORDS = ["setup", "unins", "uninstall", "redist", "vcredist", "directx", ...]
// Returns -1 for any exe whose filename contains these → excluded from candidates

PRIORITY_KEYWORDS = ["64", "dx12", "shipping"]
// +10 score for each match → e.g. "game64.exe" scores higher than "game.exe"

// Depth bonus: shallower files score higher
// (game root exe scores more than exe buried 4 folders deep)
score += max(0, 5 - path.component_count())
```

#### `find_best_exe(root: &Path) → Option<PathBuf>`

```rust
// 1. Walk entire directory tree recursively
// 2. Score every .exe found
// 3. Filter out negative scores (skip/installer exes)
// 4. Sort by score descending
// 5. Return the highest-scoring one
```

#### `walkdir(root: &Path) → Result<Vec<PathBuf>, io::Error>`

Custom recursive directory walker (instead of a crate). Returns a flat `Vec<PathBuf>` of all files under `root`. Recurses into subdirectories.

#### Parser Functions

| Function | Reads | Extracts |
|---|---|---|
| `parse_codex_appid(ini_path)` | `steam_emu.ini` | Finds `AppId=` line, skips `###` comment lines |
| `parse_anadius_content_id(cfg_path)` | `anadius.cfg` | Finds `"ContentId"  "VALUE"` VDF-format pair |
| `read_appid_txt(root)` | `steam_appid.txt` | Reads the whole file, trims whitespace |
| `read_appid_from_settings(root)` | `steam_settings/steam_appid.txt` or `game_id.txt` | Tries both filenames |

#### Save Path Functions

| Function | Returns (Windows) |
|---|---|
| `get_codex_save_dir(app_id)` | `%SYSTEMDRIVE%\Users\Public\Documents\Steam\CODEX\{app_id}` |
| `get_goldberg_save_dir(app_id)` | `%APPDATA%\Goldberg SteamEmu Saves\{app_id}` |
| `get_anadius_save_base()` | `%LOCALAPPDATA%\anadius\LSX emu` |

Each has a `#[cfg(not(target_os = "windows"))]` fallback to `/tmp/vault_*` for Linux/macOS dev.

---

## 6. Overlay Window — `public/overlay.html`

**Role:** A completely separate Tauri window that runs transparent and fullscreen on top of any running game — including exclusive fullscreen games. It listens for `achievement-unlocked` events from the Rust backend and renders the same PS5-style toast that `AchievementOverlay.tsx` shows in the launcher.

**Why separate from the main window?** The main Tauri window can't render on top of exclusive fullscreen games. A separate window with `always_on_top: true`, `fullscreen: true`, `transparent: true`, and `decorations: false` can.

**Window config (set in Rust when creating it):**
```rust
tauri::WebviewWindowBuilder::new(&app, "achievement-overlay", ...)
  .transparent(true)
  .always_on_top(true)
  .decorations(false)
  .skip_taskbar(true)   // doesn't appear in taskbar
  .fullscreen(true)
```

**Pointer events:** The entire body has `pointer-events: none`, so mouse clicks pass through the overlay to the game underneath. Only the toast div itself has `pointer-events: auto`.

**Event listener:**
```javascript
const { listen } = window.__TAURI__.event
listen('achievement-unlocked', (event) => {
  showAchievement(event.payload)  // payload = { name, description, accentColor }
})
```

**`showAchievement({ name, description, accentColor })`:**
1. Creates a toast `<div>` dynamically
2. Appends it to `#container` (fixed bottom-right)
3. Plays `slideIn` animation
4. Sets a 4-second timer
5. After 4s: adds `.out` class (plays `slideOut`)
6. After 4.4s: removes the element from DOM

Multiple achievements queue up vertically because the container is `flex-direction: column`.

---

## 7. Global Styles — `src/App.css`

**Role:** Defines the design token system (CSS variables), resets, base element styles, and global animation keyframes used across all component CSS modules.

#### CSS Variables

```css
/* Background hierarchy (darkest to lightest) */
--bg-base:     #0a0a0f   /* window background */
--bg-surface:  #111118   /* sidebar, modal backgrounds */
--bg-elevated: #1a1a24   /* inputs, scan boxes */
--bg-card:     #16161f   /* game cards */
--bg-glass:    rgba(255,255,255,0.04)   /* glassmorphism overlays */

/* Text hierarchy */
--text-primary:   #f0f0f8   /* main content */
--text-secondary: #8a8aa0   /* labels, metadata */
--text-muted:     #4a4a5a   /* placeholders, disabled */

/* Accent */
--accent:      #4a9eff                    /* default blue */
--accent-glow: rgba(74,158,255,0.15)      /* background tint for active states */

/* Layout */
--sidebar-width:    72px    /* collapsed */
--sidebar-expanded: 220px   /* expanded */
--titlebar-h:       36px

/* Typography */
--font-display: 'Rajdhani', sans-serif   /* headings, game titles, badges */
--font-body:    'Inter', sans-serif       /* all body text, labels, inputs */
```

#### Animation Keyframes

| Name | Effect | Used by |
|---|---|---|
| `fadeIn` | `opacity 0→1, translateY 8px→0` | All components (`.animate-fade`) |
| `slideInRight` | `opacity 0→1, translateX 20px→0` | `AchievementPanel` slide-in |
| `slideUp` | `opacity 0→1, translateY 16px→0` | `AddGameModal` entrance |
| `pulse-ring` | `box-shadow` expanding ring | Available for button focus states |
| `achieveSlide` | `translateX(120%) + scale(0.9) → normal` | `AchievementOverlay` entrance |
| `achieveOut` | Reverse of above | `AchievementOverlay` exit |
| `spin` | `rotate 0→360` | Loading spinner in `AddGameModal` |

---

## 8. Data Flow Diagrams

### Selecting a Game

```
User clicks GameCard
      ↓
onSelect() → selectGame(game.id)     [Sidebar or LibraryPage]
      ↓
useStore: selectedGameId = game.id   [store update]
      ↓
LibraryPage useEffect fires          [detects selectedGameId change]
      ↓
setPrevWallpaper(old)
setWallpaperLoaded(false)
setTimeout → setWallpaperLoaded(true)
      ↓
CSS: .wallpaper opacity 0 → 1       [crossfade animation]
Hero re-renders with new game data
```

### Unlocking an Achievement (Test Mode)

```
User clicks "test" button in AchievementPanel
      ↓
handleTestUnlock(achId)
      ↓
unlockAchievement(gameId, achId)     [store: sets unlocked:true, stamps timestamp]
triggerAchievement(ach)              [store: sets recentAchievement = ach]
      ↓
App.tsx: {recentAchievement && <AchievementOverlay />}  mounts toast
      ↓
AchievementOverlay useEffect starts 4s timer
      ↓
After 4s: setLeaving(true) → CSS slide-out animation
After 4.4s: clearAchievement() → recentAchievement = null → component unmounts
```

### Adding a Game

```
User clicks "Add Game" in Sidebar
      ↓
setAddingGame(true)
      ↓
AddGameModal mounts (backdrop + form)
      ↓
User fills title, pastes exe path
User clicks "Detect Emulator"
      ↓
simulateScan(exePath)                [JS simulation, 900ms fake delay]
  — or —
invoke('scan_game', { path: dir })   [real Rust scanner, when wired up]
      ↓
setScanResult({ emulator, appId, ... })
UI shows badge: "CODEX" / "GOLDBERG" / "ANADIUS"
      ↓
User picks wallpaper + accent color
User clicks "Add to Library"
      ↓
addGame(newGame)                     [store: appends to games array]
selectGame(id)                       [store: hero switches to new game]
setAddingGame(false)                 [unmounts modal]
      ↓
App.tsx: games.length > 0 in next render
New game appears in shelf + hero
```

### Full Scan Flow (Rust)

```
invoke('scan_game', { path: 'C:\Games\Cyberpunk2077' })
      ↓
lib.rs: scan_game() validates path, calls scan_game_path()
      ↓
scanner.rs: scan_game_path(root)
  ├── find_best_exe(root)
  │     walkdir() → all .exes
  │     score_exe() each → filter negatives → sort → return top
  │
  ├── detect_emulator(root)
  │     check anadius.cfg → NO
  │     check steam_emu.ini → NO
  │     check *.cdx → NO
  │     check steam_settings/ → YES → return "goldberg"
  │
  └── match "goldberg"
        read_appid_txt(root) → "1091500"
        get_goldberg_save_dir("1091500")
          → %APPDATA%\Goldberg SteamEmu Saves\1091500\
        check achievements.json → exists → record path
      ↓
Return ScanResult { emulator: "goldberg", appId: "1091500", ... }
      ↓
Tauri serializes to JSON
JS receives as typed ScanResult object
setScanResult(result) → UI shows result
```

---

## 9. Python → Rust: Function Mapping

Every function from your original Python script has a 1:1 equivalent in `scanner.rs`:

| Python | Rust | Notes |
|---|---|---|
| `scan_game(game_path_str)` | `scan_game_path(root: &Path)` | Same logic, same output fields |
| `detect_emulator(game_root)` | `detect_emulator(root: &Path)` | Identical priority order |
| `score_exe(path)` | `score_exe(path: &Path)` | Same skip/priority keywords |
| `find_best_exe(game_root)` | `find_best_exe(root: &Path)` | Rust returns `Option<PathBuf>` |
| `find_file_recursive(root, filename)` | `find_file_recursive(root, name)` | Case-insensitive in both |
| `find_by_extension(root, ext)` | Inlined into `detect_emulator` | Only used for `.cdx` check |
| `parse_codex_ini(ini_path)` | `parse_codex_appid(ini_path)` | Rust version extracts only AppId; full ini parse is future work |
| `parse_anadius_cfg(cfg_path)` | `parse_anadius_content_id(cfg_path)` | Rust extracts ContentId only |
| `parse_goldberg_settings(game_root)` | `read_appid_txt()` + `read_appid_from_settings()` | Split into two focused functions |
| `find_codex_achievements(app_id)` | `get_codex_save_dir(app_id)` + inline dir check | Same path: `%SYSTEMDRIVE%\Users\Public\Documents\Steam\CODEX\{id}` |
| `find_goldberg_achievements(app_id)` | `get_goldberg_save_dir(app_id)` + inline dir check | Same path: `%APPDATA%\Goldberg SteamEmu Saves\{id}` |
| `find_anadius_achievements(content_id)` | `get_anadius_save_base()` + inline scan | Same path: `%LOCALAPPDATA%\anadius\LSX emu` |
| `fetch_achievements_json(app_id, dest)` | ❌ Not yet ported | Need `reqwest` crate + Steam API call |

**What's NOT ported yet:**
- `fetch_achievements_json()` — HTTP request to Steam API. Add `reqwest` to `Cargo.toml` and port the URL fetch + JSON normalization.
- Full `parse_codex_ini()` — the Rust version only extracts `AppId`. DLC list and other fields from `[DLC]` section are not yet parsed.
- `main()` interactive prompt — not needed since the launcher provides the UI.

---

## 10. What Each File Owns

| File | Owns |
|---|---|
| `useStore.ts` | All persistent application state. The only place state is created and mutated. |
| `demoData.ts` | Demo content only. No logic. |
| `App.tsx` | Window shell layout + first-launch seed logic. No business logic. |
| `TitleBar.tsx` | Window chrome + Tauri window controls. Reads selected game name from store. |
| `Sidebar.tsx` | Navigation, favorites list, Add Game trigger. Reads/writes store. |
| `LibraryPage.tsx` | Wallpaper system, hero display, game shelf, play trigger. Reads store. |
| `GameCard.tsx` | Single shelf card. Pure display + `onSelect` callback. No store access. |
| `AchievementPanel.tsx` | Achievement list display + test-unlock button. Reads game prop + calls store actions. |
| `AchievementOverlay.tsx` | In-launcher achievement toast. Reads `recentAchievement` from store. |
| `AddGameModal.tsx` | Add game form + visual customization + JS crack scan simulation. Writes to store. |
| `App.css` | Design tokens (CSS variables), resets, global keyframes. |
| `overlay.html` | Standalone transparent overlay window for in-game toasts. Listens to Tauri events. |
| `lib.rs` | Tauri command registration + `launch_game` + `scan_game` entry point. |
| `scanner.rs` | All crack detection logic: emulator detection, App ID extraction, save path resolution. |
| `tauri.conf.json` | Window dimensions, title, transparency, bundle targets. |
