/**
 * GameLaunchBadge.tsx
 *
 * "Now Playing" toast for the OVERLAY WINDOW.
 * Uses ToastShell (phase-machine animation) instead of NotificationShell.
 * Stays visible for 15 seconds by default.
 */

import { useEffect } from 'react'
import { Gamepad2 } from 'lucide-react'
import ToastShell from './ToastShell'

interface Props {
  id: string
  payload: {
    game_id: string
    game_title: string
    accent: string
  }
  onDone: (id: string) => void
}

const HOLD_DURATION = 15000 // ms (does not include entry/exit phases)

function playLaunchSound() {
  try {
    const ctx = new AudioContext()
    const playNote = (
      freq: number,
      startTime: number,
      duration: number,
      gain: number,
      type: OscillatorType = 'sine',
    ) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      osc.type = type
      osc.frequency.setValueAtTime(freq, startTime)
      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.03)
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }
    const now = ctx.currentTime
    playNote(80, now, 0.12, 0.25, 'triangle')
    playNote(220, now + 0.05, 0.25, 0.12, 'sine')
    playNote(440, now + 0.18, 0.35, 0.10, 'sine')
    playNote(660, now + 0.32, 0.40, 0.07, 'sine')
  } catch {
    // Fail silently
  }
}

export default function GameLaunchBadge({ id, payload, onDone }: Props) {
  const accent = payload.accent || '#ffd93b'

  useEffect(() => {
    playLaunchSound()
  }, [])

  return (
    <ToastShell id={id} accent={accent} holdDuration={HOLD_DURATION} onDone={onDone}>
      {/* Icon */}
      <div
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: `2px solid ${accent}50`,
          background: `radial-gradient(circle, ${accent}20, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 24px ${accent}25`,
        }}
      >
        <Gamepad2 size={24} color={accent} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.2em',
            color: accent,
            textTransform: 'uppercase',
            marginBottom: 2,
            opacity: 0.9,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Now Playing
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {payload.game_title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'rgba(154,160,184,0.7)',
            marginTop: 2,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Game session started
        </div>
      </div>
    </ToastShell>
  )
}