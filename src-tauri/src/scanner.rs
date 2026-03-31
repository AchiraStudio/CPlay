use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;

// ── Output type (maps to scanner.py's returned dict) ─────────────────────────

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct ScanResult {
    pub game_path: Option<String>,
    pub best_exe: Option<String>,
    pub emulator: String,
    pub app_id: Option<String>,
    pub save_folder: Option<String>,
    pub achievements_ini: Option<String>,
    pub achievements_json: Option<String>,
    pub achievements_xml: Option<String>,
    pub debug_log: Option<Vec<String>>,
}

// ── CODEX achievement watcher ─────────────────────────────────────────────────
//
// CODEX achievements.ini format:
//
//   [SteamAchievements]
//   00000=NEW_ACHIEVEMENT_1_1
//   00001=NEW_ACHIEVEMENT_1_2
//   Count=2
//
//   [NEW_ACHIEVEMENT_1_1]
//   Achieved=1
//   CurProgress=0
//   MaxProgress=0
//   UnlockTime=1773296308
//
// Strategy:
//   1. Read numeric-keyed entries under [SteamAchievements] — these are the
//      internal names of achievements the emulator has recorded.
//   2. For each name, verify its own section has Achieved=1.
//   3. Return only verified unlocked names.
//
// This catches incremental unlocks because each new unlock appends a new
// line (00001=NAME) to [SteamAchievements] and a new [NAME] section.

pub fn read_codex_achievements(path: &str) -> HashSet<String> {
    let mut unlocked = HashSet::new();
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return unlocked,
    };

    // Phase 1: names listed in [SteamAchievements]
    let mut listed: Vec<String> = Vec::new();
    let mut in_steam = false;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            in_steam = line[1..line.len() - 1].eq_ignore_ascii_case("SteamAchievements");
            continue;
        }
        if in_steam {
            if let Some(eq) = line.find('=') {
                let key = line[..eq].trim();
                let val = line[eq + 1..].trim();
                // Only numeric keys (00000=, 00001=) are achievement entries
                if !val.is_empty() && key.chars().all(|c| c.is_ascii_digit()) {
                    listed.push(val.to_string());
                }
            }
        }
    }

    // Phase 2: verify Achieved=1 in each achievement's own section
    for name in &listed {
        if codex_is_achieved(&content, name) {
            unlocked.insert(name.clone());
        }
    }

    unlocked
}

fn codex_is_achieved(content: &str, name: &str) -> bool {
    let header = format!("[{}]", name);
    let mut in_section = false;

    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('[') && line.ends_with(']') {
            if line.eq_ignore_ascii_case(&header) {
                in_section = true;
            } else if in_section {
                break; // entered a different section
            }
            continue;
        }
        if in_section {
            if let Some(eq) = line.find('=') {
                let key = line[..eq].trim();
                let val = line[eq + 1..].trim();
                if key.eq_ignore_ascii_case("Achieved") && val == "1" {
                    return true;
                }
            }
        }
    }
    false
}

// ── Goldberg achievement watcher ──────────────────────────────────────────────
//
// Goldberg stores unlocked achievements in achievements.json:
//   [{ "name": "ACH_ID", "achieved": 1, ... }, ...]

pub fn read_goldberg_achievements(path: &str) -> HashSet<String> {
    let mut names = HashSet::new();
    let data = match fs::read_to_string(path) {
        Ok(d) => d,
        Err(_) => return names,
    };
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
        if let Some(arr) = json.as_array() {
            for item in arr {
                let achieved = item
                    .get("achieved")
                    .and_then(|v| v.as_u64())
                    .map(|v| v == 1)
                    .unwrap_or(false);
                if achieved {
                    if let Some(n) = item.get("name").and_then(|v| v.as_str()) {
                        names.insert(n.to_string());
                    }
                }
            }
        }
    }
    names
}

// ── Anadius achievement watcher ───────────────────────────────────────────────
//
// Anadius stores unlocked achievements in XML:
//   <Achievement Id="22" Count="1" Progress="1"
//               Grant="2026-03-03T09:05:09" Name="Bring It On"/>
//
// The Name attribute is the display name — matched against displayName in
// achievements.json via match_by="display_name" in the emitted event.

pub fn read_anadius_achievements(path: &str) -> HashSet<String> {
    let mut names = HashSet::new();
    let data = match fs::read_to_string(path) {
        Ok(d) => d,
        Err(_) => return names,
    };

    let mut cursor = 0;
    while cursor < data.len() {
        match data[cursor..].find("<Achievement ") {
            None => break,
            Some(pos) => {
                let start = cursor + pos;
                let tag_end = data[start..]
                    .find("/>")
                    .map(|p| start + p)
                    .unwrap_or(data.len());
                let tag = &data[start..tag_end];

                if let Some(name_pos) = tag.find("Name=\"") {
                    let val_start = name_pos + 6;
                    if let Some(val_end) = tag[val_start..].find('"') {
                        let name = &tag[val_start..val_start + val_end];
                        if !name.is_empty() {
                            names.insert(name.to_string());
                        }
                    }
                }
                cursor = tag_end + 2;
            }
        }
    }
    names
}
