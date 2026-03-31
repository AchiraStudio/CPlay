mod scanner;

use scanner::{
    read_anadius_achievements, read_codex_achievements, read_goldberg_achievements, ScanResult,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_dialog::DialogExt;

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Clone, Debug)]
struct ProcessEntry {
    #[allow(dead_code)]
    root_pid: u32,
    game_folder: String,
    _start_secs: u64,
}

pub struct ProcessTable(Mutex<HashMap<String, ProcessEntry>>);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameSession {
    pub start: String,
    pub duration_mins: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameStats {
    pub game_id: String,
    pub total_playtime_mins: u64,
    pub last_played: String,
    pub last_session_mins: u64,
    pub session_count: u64,
    #[serde(default)]
    pub sessions: Vec<GameSession>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AchievementDef {
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(default)]
    pub description: String,
    pub icon: Option<String>,
    pub icongray: Option<String>,
    pub hidden: Option<u8>,
}

// ── Persistence ───────────────────────────────────────────────────────────────

fn stats_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let drive = std::env::var("SYSTEMDRIVE").unwrap_or_else(|_| "C:".into());
        PathBuf::from(format!(r"{}\Users\Public\Documents\CPlay\stats", drive))
    }
    #[cfg(not(target_os = "windows"))]
    PathBuf::from("/tmp/cplay/stats")
}

fn load_stats(game_id: &str) -> GameStats {
    let path = stats_dir().join(format!("{}.json", game_id));
    fs::read_to_string(&path)
        .and_then(|d| serde_json::from_str(&d).map_err(|e| e.into()))
        .unwrap_or(GameStats {
            game_id: game_id.to_string(),
            total_playtime_mins: 0,
            last_played: String::new(),
            last_session_mins: 0,
            session_count: 0,
            sessions: Vec::new(),
        })
}

fn save_stats(stats: &GameStats) {
    let dir = stats_dir();
    let _ = fs::create_dir_all(&dir);
    if let Ok(json) = serde_json::to_string_pretty(stats) {
        let _ = fs::write(dir.join(format!("{}.json", stats.game_id)), json);
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn now_iso() -> String {
    epoch_secs_to_iso(now_secs())
}

fn epoch_secs_to_iso(secs: u64) -> String {
    let (y, mo, d) = epoch_days_to_ymd(secs / 86400);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y,
        mo,
        d,
        (secs / 3600) % 24,
        (secs / 60) % 60,
        secs % 60,
    )
}

fn epoch_days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    let mut y = 1970u64;
    loop {
        let leap = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
        let dy = if leap { 366 } else { 365 };
        if days < dy {
            break;
        }
        days -= dy;
        y += 1;
    }
    let leap = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
    let md = [
        31u64,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let mut mo = 1u64;
    for &m in &md {
        if days < m {
            break;
        }
        days -= m;
        mo += 1;
    }
    (y, mo, days + 1)
}

// ── Overlay window management ─────────────────────────────────────────────────
//
// The overlay is a second Tauri window (label = "overlay") that:
//   - Is transparent and decoration-free
//   - Sits always-on-top of everything, INCLUDING the game
//   - Covers the primary monitor at its exact size
//   - Has cursor events DISABLED so the game receives all input normally
//   - Is shown only when a game is running; hidden when it exits
//
// We resize it to the primary monitor on every show() call because the
// monitor resolution might have changed since app start.

fn overlay_show(app: &AppHandle) {
    let Some(ov) = app.get_webview_window("overlay") else {
        return;
    };

    // Cover the entire primary monitor so notifications can be positioned
    // anywhere via CSS inside the React app. The window itself is fully
    // transparent and click-through, so the game is unaffected.
    if let Ok(Some(mon)) = ov.primary_monitor() {
        let size = mon.size();
        let pos = mon.position();

        let _ = ov.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: size.width,
            height: size.height,
        }));
        let _ = ov.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: pos.x,
            y: pos.y,
        }));
    }

    let _ = ov.show();
    let _ = ov.set_always_on_top(true);
    // Passthrough — the game still receives all mouse/keyboard input
    let _ = ov.set_ignore_cursor_events(true);
}

fn overlay_hide(app: &AppHandle) {
    let Some(ov) = app.get_webview_window("overlay") else {
        return;
    };
    let _ = ov.hide();
    let _ = ov.set_ignore_cursor_events(true);
}

// Called by the frontend when all toasts have been dismissed, so we can
// tighten cursor passthrough back to strict ignore.
fn overlay_all_dismissed(app: &AppHandle) {
    let Some(ov) = app.get_webview_window("overlay") else {
        return;
    };
    let _ = ov.set_ignore_cursor_events(true);
}

// ── OS helpers ────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod win {
    use windows_sys::Win32::Foundation::*;
    use windows_sys::Win32::System::Diagnostics::ToolHelp::*;
    use windows_sys::Win32::System::Threading::*;

    pub fn is_any_alive_in_folder(folder: &str) -> bool {
        let norm = folder.to_lowercase().replace('\\', "/");
        for pid in snapshot_pids() {
            if let Some(p) = get_process_path(pid) {
                if p.to_lowercase().replace('\\', "/").contains(&norm) {
                    return true;
                }
            }
        }
        false
    }

    pub fn kill_all_in_folder(folder: &str) {
        let norm = folder.to_lowercase().replace('\\', "/");
        for pid in snapshot_pids() {
            if let Some(p) = get_process_path(pid) {
                if p.to_lowercase().replace('\\', "/").contains(&norm) {
                    unsafe {
                        let h = OpenProcess(PROCESS_TERMINATE, 0, pid);
                        if !h.is_null() {
                            TerminateProcess(h, 1);
                            CloseHandle(h);
                        }
                    }
                }
            }
        }
    }

    pub fn is_pid_alive(pid: u32) -> bool {
        if pid == 0 {
            return false;
        }
        unsafe {
            let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h.is_null() {
                return false;
            }
            let mut code = 0u32;
            let ok = GetExitCodeProcess(h, &mut code);
            CloseHandle(h);
            ok != 0 && code == STILL_ACTIVE as u32
        }
    }

    pub fn snapshot_pids() -> Vec<u32> {
        let mut pids = Vec::new();
        unsafe {
            let h = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if h.is_null() || h == INVALID_HANDLE_VALUE {
                return pids;
            }
            let mut pe: PROCESSENTRY32W = std::mem::zeroed();
            pe.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
            if Process32FirstW(h, &mut pe) != 0 {
                loop {
                    pids.push(pe.th32ProcessID);
                    if Process32NextW(h, &mut pe) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(h);
        }
        pids
    }

    pub fn get_process_path(pid: u32) -> Option<String> {
        unsafe {
            let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h.is_null() {
                return None;
            }
            let mut buf = [0u16; 1024];
            let mut size = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut size);
            CloseHandle(h);
            if ok != 0 {
                Some(String::from_utf16_lossy(&buf[..size as usize]))
            } else {
                None
            }
        }
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn pick_exe(app: AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Executable", &["exe"])
        .blocking_pick_file();
    Ok(file.map(|p| p.to_string()))
}

#[tauri::command]
async fn scan_game(app: AppHandle, path: String) -> Result<ScanResult, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err("Path not found".into());
    }
    let scanner_py = app
        .path()
        .resolve("resources/scanner.py", tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    let py = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };
    let out = Command::new(py)
        .arg(&scanner_py)
        .arg(root)
        .output()
        .map_err(|e| format!("Python bridge failed: {}", e))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).into());
    }
    serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())
}

#[tauri::command]
async fn launch_game(
    app: AppHandle,
    game_id: String,
    game_title: String,
    game_accent: Option<String>,
    path: String,
    achievements_ini: Option<String>,
    achievements_json: Option<String>,
    achievements_xml: Option<String>,
    table: State<'_, ProcessTable>,
) -> Result<(), String> {
    let exe = PathBuf::from(&path);
    if !exe.exists() {
        return Err("EXE not found".into());
    }

    let folder = exe
        .parent()
        .unwrap_or(Path::new("."))
        .to_string_lossy()
        .to_string();
    let spawn = now_secs();

    let child = Command::new(&exe).current_dir(&folder).spawn();
    let root_pid = match child {
        Ok(c) => c.id(),
        Err(e) => {
            #[cfg(target_os = "windows")]
            if e.raw_os_error() == Some(5) || e.raw_os_error() == Some(740) {
                return elevate_launch(
                    &app,
                    &game_id,
                    &game_title,
                    &game_accent,
                    &path,
                    &folder,
                    spawn,
                    &table,
                    achievements_ini,
                    achievements_json,
                    achievements_xml,
                );
            }
            return Err(format!("Spawn failed: {}", e));
        }
    };

    {
        let mut t = table.0.lock().unwrap();
        t.insert(
            game_id.clone(),
            ProcessEntry {
                root_pid,
                game_folder: folder.clone(),
                _start_secs: spawn,
            },
        );
    }

    // Show the overlay window over the game, then send events to it
    overlay_show(&app);
    emit_to_overlay_and_main(&app, &game_id, &game_title, &game_accent);

    // Notify the main window so it can update run state
    let _ = app.emit("game-launched", &game_id);

    // Background threads
    spawn_exit_watcher(
        app.clone(),
        game_id.clone(),
        root_pid,
        folder.clone(),
        spawn,
    );

    if let Some(ini) = achievements_ini {
        spawn_ach_watcher(
            app.clone(),
            game_id.clone(),
            folder.clone(),
            root_pid,
            ini,
            "ini",
        );
    }
    if let Some(json) = achievements_json {
        spawn_ach_watcher(
            app.clone(),
            game_id.clone(),
            folder.clone(),
            root_pid,
            json,
            "json",
        );
    }
    if let Some(xml) = achievements_xml {
        spawn_ach_watcher(
            app.clone(),
            game_id.clone(),
            folder.clone(),
            root_pid,
            xml,
            "xml",
        );
    }

    Ok(())
}

/// Emit the game-launched event to both the overlay window AND the main window.
/// The overlay shows the launch badge toast.
/// The main window updates its own run-state UI.
fn emit_to_overlay_and_main(app: &AppHandle, game_id: &str, title: &str, accent: &Option<String>) {
    let payload = serde_json::json!({
        "game_id":    game_id,
        "game_title": title,
        "accent":     accent.clone().unwrap_or_else(|| "#ffd93b".into()),
    });

    // → overlay window gets the toast event
    if let Some(ov) = app.get_webview_window("overlay") {
        let _ = ov.set_ignore_cursor_events(false);
        let _ = ov.emit("overlay-game-launched", &payload);
    }

    // → main window gets the badge event (for its own internal state)
    let _ = app.emit("game-launched-badge", &payload);
}

#[cfg(target_os = "windows")]
fn elevate_launch(
    app: &AppHandle,
    id: &str,
    title: &str,
    accent: &Option<String>,
    path: &str,
    folder: &str,
    start: u64,
    table: &ProcessTable,
    ach_ini: Option<String>,
    ach_json: Option<String>,
    ach_xml: Option<String>,
) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    let wv = |s: &str| {
        OsStr::new(s)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect::<Vec<u16>>()
    };
    unsafe {
        windows_sys::Win32::UI::Shell::ShellExecuteW(
            std::ptr::null_mut(),
            wv("runas\0").as_ptr(),
            wv(path).as_ptr(),
            std::ptr::null(),
            wv(folder).as_ptr(),
            1,
        );
    }
    {
        let mut t = table.0.lock().unwrap();
        t.insert(
            id.to_string(),
            ProcessEntry {
                root_pid: 0,
                game_folder: folder.to_string(),
                _start_secs: start,
            },
        );
    }
    overlay_show(app);
    emit_to_overlay_and_main(app, id, title, accent);
    let _ = app.emit("game-launched", id);
    if let Some(ini) = ach_ini {
        spawn_ach_watcher(
            app.clone(),
            id.to_string(),
            folder.to_string(),
            0,
            ini,
            "ini",
        );
    }
    if let Some(json) = ach_json {
        spawn_ach_watcher(
            app.clone(),
            id.to_string(),
            folder.to_string(),
            0,
            json,
            "json",
        );
    }
    if let Some(xml) = ach_xml {
        spawn_ach_watcher(
            app.clone(),
            id.to_string(),
            folder.to_string(),
            0,
            xml,
            "xml",
        );
    }
    Ok(())
}

// ── Exit watcher ──────────────────────────────────────────────────────────────

fn spawn_exit_watcher(app: AppHandle, game_id: String, root_pid: u32, folder: String, _spawn: u64) {
    std::thread::spawn(move || {
        // Phase 1: wait up to 20s for a process to appear in the folder
        let mut real_start: Option<u64> = None;
        for _ in 0..40 {
            std::thread::sleep(std::time::Duration::from_millis(500));
            #[cfg(target_os = "windows")]
            if win::is_any_alive_in_folder(&folder) || win::is_pid_alive(root_pid) {
                real_start = Some(now_secs());
                break;
            }
            #[cfg(not(target_os = "windows"))]
            {
                real_start = Some(now_secs());
                break;
            }
        }

        let start = match real_start {
            Some(s) => s,
            None => {
                overlay_hide(&app);
                let _ = app.emit("game-exited", &game_id);
                return;
            }
        };

        // Phase 2: poll until folder is empty
        loop {
            std::thread::sleep(std::time::Duration::from_secs(2));
            #[cfg(target_os = "windows")]
            if !win::is_any_alive_in_folder(&folder) && !win::is_pid_alive(root_pid) {
                break;
            }
            #[cfg(not(target_os = "windows"))]
            break;
        }

        // Phase 3: commit stats
        let mins = (now_secs().saturating_sub(start)) / 60;
        let mut stats = load_stats(&game_id);
        if mins > 0 {
            stats.sessions.push(GameSession {
                start: epoch_secs_to_iso(start),
                duration_mins: mins,
            });
            stats.total_playtime_mins += mins;
            stats.last_session_mins = mins;
            stats.session_count += 1;
        }
        stats.last_played = now_iso();
        save_stats(&stats);

        // Hide overlay, notify main window
        overlay_hide(&app);
        let _ = app.emit("game-exited", &game_id);
    });
}

// ── Achievement watcher ───────────────────────────────────────────────────────
//
// Polls every 2s. Sends new unlocks to BOTH the overlay window (toast) and
// the main window (store update).

fn spawn_ach_watcher(
    app: AppHandle,
    game_id: String,
    folder: String,
    pid: u32,
    path: String,
    kind: &'static str,
) {
    std::thread::spawn(move || {
        // Seed with already-unlocked achievements so we don't re-fire them
        let mut known: HashSet<String> = match kind {
            "ini" => read_codex_achievements(&path),
            "json" => read_goldberg_achievements(&path),
            _ => read_anadius_achievements(&path),
        };

        loop {
            std::thread::sleep(std::time::Duration::from_secs(2));

            #[cfg(target_os = "windows")]
            if !win::is_any_alive_in_folder(&folder) && !win::is_pid_alive(pid) {
                break;
            }

            let current: HashSet<String> = match kind {
                "ini" => read_codex_achievements(&path),
                "json" => read_goldberg_achievements(&path),
                _ => read_anadius_achievements(&path),
            };

            for name in &current {
                if known.contains(name) {
                    continue;
                }
                known.insert(name.clone());

                let match_by = if kind == "xml" {
                    "display_name"
                } else {
                    "name"
                };
                let payload = serde_json::json!({
                    "game_id":          &game_id,
                    "achievement_name": name,
                    "match_by":         match_by,
                    "kind":             kind,
                });

                // → overlay window: show the achievement toast
                if let Some(ov) = app.get_webview_window("overlay") {
                    let _ = ov.set_ignore_cursor_events(false);
                    let _ = ov.emit("overlay-achievement-unlocked", &payload);
                }

                // → main window: update the store (mark achievement unlocked)
                let _ = app.emit("achievement-unlocked", &payload);
            }
        }
    });
}

// ── Other commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn is_game_running(game_id: String, table: State<'_, ProcessTable>) -> Result<bool, String> {
    let entry = table.0.lock().unwrap().get(&game_id).cloned();
    match entry {
        Some(e) => {
            #[cfg(target_os = "windows")]
            let alive =
                win::is_any_alive_in_folder(&e.game_folder) || win::is_pid_alive(e.root_pid);
            #[cfg(not(target_os = "windows"))]
            let alive = false;

            if !alive {
                table.0.lock().unwrap().remove(&game_id);
            }
            Ok(alive)
        }
        None => Ok(false),
    }
}

#[tauri::command]
async fn stop_game(game_id: String, table: State<'_, ProcessTable>) -> Result<(), String> {
    if let Some(e) = table.0.lock().unwrap().get(&game_id).cloned() {
        #[cfg(target_os = "windows")]
        win::kill_all_in_folder(&e.game_folder);
    }
    Ok(())
}

#[tauri::command]
async fn get_game_stats(game_id: String) -> Result<GameStats, String> {
    Ok(load_stats(&game_id))
}

#[tauri::command]
async fn load_achievements(json_path: String) -> Result<Vec<AchievementDef>, String> {
    let path = Path::new(&json_path);
    let parent = path.parent().ok_or("Invalid path")?;
    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut defs: Vec<AchievementDef> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    for def in &mut defs {
        if let Some(ref icon) = def.icon {
            if !icon.starts_with("http") && !Path::new(icon).is_absolute() {
                def.icon = Some(parent.join(icon).to_string_lossy().to_string());
            }
        }
        if let Some(ref gray) = def.icongray {
            if !gray.starts_with("http") && !Path::new(gray).is_absolute() {
                def.icongray = Some(parent.join(gray).to_string_lossy().to_string());
            }
        }
    }
    Ok(defs)
}

/// Called by the overlay frontend when all toasts are gone —
/// lets us re-enable cursor passthrough.
#[tauri::command]
async fn notify_badge_dismissed(app: AppHandle) -> Result<(), String> {
    overlay_all_dismissed(&app);
    Ok(())
}

// ── Debug / settings commands ─────────────────────────────────────────────────
//
// These let the Settings page test overlay toasts without launching a game.

/// Show the overlay window over the current primary monitor.
/// Safe to call at any time — just makes it visible and always-on-top.
#[tauri::command]
async fn debug_show_overlay(app: AppHandle) -> Result<(), String> {
    overlay_show(&app);
    Ok(())
}

/// Emit a fake game-launch badge to the overlay.
#[tauri::command]
async fn debug_launch_badge(
    app: AppHandle,
    game_title: String,
    accent: Option<String>,
) -> Result<(), String> {
    overlay_show(&app);
    let payload = serde_json::json!({
        "game_id":    "debug",
        "game_title": game_title,
        "accent":     accent.unwrap_or_else(|| "#ffd93b".into()),
    });
    if let Some(ov) = app.get_webview_window("overlay") {
        ov.set_ignore_cursor_events(false).ok();
        ov.emit("overlay-game-launched", &payload)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Emit a fake achievement-unlocked toast to the overlay.
#[tauri::command]
async fn debug_achievement(
    app: AppHandle,
    name: String,
    display_name: String,
    description: String,
    accent: Option<String>,
) -> Result<(), String> {
    overlay_show(&app);
    let payload = serde_json::json!({
        "game_id":          "debug",
        "achievement_name": name,
        "display_name":     display_name,
        "description":      description,
        "match_by":         "name",
        "accent":           accent.unwrap_or_else(|| "#ffd93b".into()),
    });
    if let Some(ov) = app.get_webview_window("overlay") {
        ov.set_ignore_cursor_events(false).ok();
        ov.emit("overlay-achievement-unlocked", &payload)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── App setup & runner ────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .manage(ProcessTable(Mutex::new(HashMap::new())))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            pick_exe,
            scan_game,
            launch_game,
            is_game_running,
            stop_game,
            get_game_stats,
            load_achievements,
            notify_badge_dismissed,
            debug_show_overlay,
            debug_launch_badge,
            debug_achievement,
        ])
        .setup(|app| {
            // ── System tray ──────────────────────────────────────────────────
            let show = MenuItem::with_id(app, "show", "Show CPlay", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("CPlay")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── Minimise-to-tray on close ────────────────────────────────────
            if let Some(main) = app.get_webview_window("main") {
                let ah = app.handle().clone();
                main.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(w) = ah.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                });
            }

            // ── Overlay: ensure cursor passthrough from the start ────────────
            if let Some(ov) = app.get_webview_window("overlay") {
                let _ = ov.set_ignore_cursor_events(true);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
