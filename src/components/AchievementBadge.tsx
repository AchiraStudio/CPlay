/**
 * AchievementBadge.tsx
 *
 * Achievement unlock toast for the OVERLAY WINDOW.
 * Uses ToastShell (phase-machine animation) instead of NotificationShell.
 */

import { useEffect } from 'react'
import { Trophy } from 'lucide-react'
import ToastShell from './ToastShell'

interface Props {
  id: string
  payload: {
    achievement_name: string
    display_name?: string
    description?: string
    icon?: string
    accent?: string
  }
  onDone: (id: string) => void
}

// PS5-style ascending chime — generated via Web Audio API, no file needed.
function playUnlockSound() {
  try {
    const ctx = new AudioContext()
    const playNote = (freq: number, startTime: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, startTime)
      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }
    const now = ctx.currentTime
    // E5 → G#5 → B5 major arpeggio
    playNote(659.25, now, 0.18, 0.18)
    playNote(830.61, now + 0.12, 0.18, 0.15)
    playNote(987.77, now + 0.24, 0.32, 0.12)
    // Soft shimmer on top
    const shimmer = ctx.createOscillator()
    const shimmerGain = ctx.createGain()
    shimmer.connect(shimmerGain)
    shimmerGain.connect(ctx.destination)
    shimmer.type = 'triangle'
    shimmer.frequency.setValueAtTime(1975.53, now + 0.24)
    shimmerGain.gain.setValueAtTime(0, now + 0.24)
    shimmerGain.gain.linearRampToValueAtTime(0.05, now + 0.28)
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    shimmer.start(now + 0.24)
    shimmer.stop(now + 0.7)
  } catch {
    // Audio context unavailable — fail silently
  }
}

const HOLD_DURATION = 5000 // ms (does not include entry/exit phases)

export default function AchievementBadge({ id, payload, onDone }: Props) {
  const accent = payload.accent || '#ffd93b'
  const name = payload.display_name || payload.achievement_name

  useEffect(() => {
    playUnlockSound()
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
          overflow: 'hidden',
          boxShadow: `0 0 16px ${accent}30`,
        }}
      >
        {payload.icon ? (
          <img
            src={payload.icon}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          />
        ) : (
          <Trophy size={22} color={accent} />
        )}
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
          Achievement Unlocked
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.15,
            marginBottom: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {name}
        </div>
        {payload.description && (
          <div
            style={{
              fontSize: 11,
              color: 'rgba(154, 160, 184, 0.85)',
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {payload.description}
          </div>
        )}
      </div>

      {/* XP badge */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '5px 9px',
          borderRadius: 7,
          background: `${accent}12`,
          border: `1px solid ${accent}25`,
        }}
      >
        <Trophy size={13} color={accent} />
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: accent,
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: 1,
          }}
        >
          +50G
        </div>
      </div>
    </ToastShell>
  )
}