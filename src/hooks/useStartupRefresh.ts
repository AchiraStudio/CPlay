import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useStore, type Achievement } from '../store/useStore'

export function useStartupRefresh() {
  const { games, updateGame } = useStore()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const now = Date.now()

    // Process all games in parallel
    Promise.all(
      games.map(async (game) => {
        // Skip if scanned in the last 24h
        if (game.lastScanned && now - game.lastScanned < 86_400_000) return

        try {
          const scan = await invoke<any>('rescan_game', { path: game.exePath })

          const updates: any = {
            emulator: scan.emulator !== 'unknown' ? scan.emulator : game.emulator,
            appId: scan.app_id ?? game.appId,
            saveFolder: scan.save_folder ?? game.saveFolder,
            achievementsJson: scan.achievements_json ?? game.achievementsJson,
            achievementsIni: scan.achievements_ini ?? game.achievementsIni,
            lastScanned: now,
          }

          updateGame(game.id, updates)

          // Auto-load achievements if we newly found the JSON and haven't loaded them yet
          if (updates.achievementsJson && game.achievements.length === 0) {
            try {
              const defs = await invoke<any[]>('load_achievements', { jsonPath: updates.achievementsJson })
              const mapped: Achievement[] = defs.map((d: any) => ({
                id: d.name,
                name: d.display_name,
                description: d.description || '',
                icon: d.icon,
                iconGray: d.icongray,
                hidden: d.hidden === 1,
                unlocked: false,
              }))
              updateGame(game.id, { achievements: mapped })
            } catch {
              // file doesn't exist anymore, ignore
            }
          }
        } catch {
          // rescan failed (path deleted/moved). Keep existing metadata safely.
        }
      })
    )
  }, [games, updateGame])
}
