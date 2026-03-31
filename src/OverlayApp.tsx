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
 */

import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { AnimatePresence } from 'framer-motion'
import AchievementBadge from './components/AchievementBadge'
import GameLaunchBadge from './components/GameLaunchBadge'

// ── Payload shapes ────────────────────────────────────────────────────────────

interface LaunchPayload {
  game_id: string
  game_title: string
  accent: string
}

interface AchievementPayload {
  game_id: string
  achievement_name: string
  match_by?: string
  // Real game events supply these via a subsequent load_achievements call.
  // Debug events supply them directly in the payload.
  display_name?: string
  description?: string
  icon?: string
  accent?: string
}

// ── Notification union ────────────────────────────────────────────────────────

type NotifItem =
  | { id: string; type: 'launch'; payload: LaunchPayload; timestamp: number }
  | { id: string; type: 'achievement'; payload: AchievementPayload; timestamp: number }

let counter = 0

// ── Component ─────────────────────────────────────────────────────────────────

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

  const dismiss = (id: string) => {
    setNotifs(prev => {
      const next = prev.filter(n => n.id !== id)
      if (next.length === 0) {
        invoke('notify_badge_dismissed').catch(() => { })
      }
      return next
    })
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'transparent',
      overflow: 'hidden',
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}>
        <AnimatePresence mode="popLayout">
          {notifs.map(n =>
            n.type === 'launch' ? (
              <GameLaunchBadge
                key={n.id}
                id={n.id}
                payload={n.payload}
                onDismiss={dismiss}
              />
            ) : (
              <AchievementBadge
                key={n.id}
                id={n.id}
                payload={{
                  achievement_name: n.payload.achievement_name,
                  // Prefer direct debug payload fields, fall back to name
                  display_name: n.payload.display_name ?? n.payload.achievement_name,
                  description: n.payload.description,
                  icon: n.payload.icon,
                  accent: n.payload.accent,
                }}
                onDismiss={dismiss}
              />
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}