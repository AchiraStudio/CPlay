/**
 * OverlayApp.tsx
 *
 * Standalone root for the overlay Tauri window (label="overlay").
 * No connection to the main launcher window or its Zustand store.
 *
 * Listens for events emitted directly to this window by lib.rs:
 *   "overlay-game-launched"        → GameLaunchBadge toast
 *   "overlay-achievement-unlocked" → AchievementBadge toast
 *
 * Both real game events AND debug commands from SettingsPage use the
 * same event names, so no special-casing is needed here.
 *
 * The queue renders badges stacked in the bottom-right corner.
 * Each badge is self-timed via ToastShell's phase machine and calls
 * onDone(id) when its animation lifecycle completes.
 */

import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import AchievementBadge from './components/AchievementBadge'
import GameLaunchBadge from './components/GameLaunchBadge'

// ── Payload shapes ─────────────────────────────────────────────────────────────

interface LaunchPayload {
  game_id: string
  game_title: string
  accent: string
}

interface AchievementPayload {
  game_id: string
  achievement_name: string
  match_by?: string
  display_name?: string
  description?: string
  icon?: string
  accent?: string
}

// ── Notification union ─────────────────────────────────────────────────────────

type NotifItem =
  | { id: string; type: 'launch'; payload: LaunchPayload; timestamp: number }
  | { id: string; type: 'achievement'; payload: AchievementPayload; timestamp: number }

let counter = 0

// ── Component ──────────────────────────────────────────────────────────────────

export default function OverlayApp() {
  const [notifs, setNotifs] = useState<NotifItem[]>([])

  useEffect(() => {
    const unLaunch = listen<LaunchPayload>('overlay-game-launched', ({ payload }) => {
      setNotifs(prev => [...prev, {
        id: `launch-${counter++}-${Date.now()}`,
        type: 'launch',
        payload,
        timestamp: Date.now(),
      }])
    })

    const unAch = listen<AchievementPayload>('overlay-achievement-unlocked', ({ payload }) => {
      setNotifs(prev => [...prev, {
        id: `ach-${counter++}-${Date.now()}`,
        type: 'achievement',
        payload,
        timestamp: Date.now(),
      }])
    })

    return () => {
      unLaunch.then(fn => fn())
      unAch.then(fn => fn())
    }
  }, [])

  // Called by ToastShell when a badge's full animation lifecycle completes.
  const onDone = (id: string) => {
    setNotifs(prev => {
      const next = prev.filter(n => n.id !== id)
      // When the last badge is gone, signal Rust so cursor passthrough
      // can be re-tightened (though the window stays open for next time).
      if (next.length === 0) {
        invoke('notify_badge_dismissed').catch(() => { })
      }
      return next
    })
  }

  return (
    // Full-screen transparent container — the window covers the whole monitor
    // but this div is completely invisible. Only the badges inside are visible.
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'transparent',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Badges stack bottom-right, newest at the bottom */}
      <div
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          pointerEvents: 'none',
          gap: 0, // gap handled inside ToastShell via marginBottom
        }}
      >
        {notifs.map(n =>
          n.type === 'launch' ? (
            <GameLaunchBadge
              key={n.id}
              id={n.id}
              payload={n.payload}
              onDone={onDone}
            />
          ) : (
            <AchievementBadge
              key={n.id}
              id={n.id}
              payload={{
                achievement_name: n.payload.achievement_name,
                display_name: n.payload.display_name ?? n.payload.achievement_name,
                description: n.payload.description,
                icon: n.payload.icon,
                accent: n.payload.accent,
              }}
              onDone={onDone}
            />
          )
        )}
      </div>
    </div>
  )
}