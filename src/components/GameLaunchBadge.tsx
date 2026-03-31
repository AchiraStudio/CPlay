import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gamepad2 } from 'lucide-react'
import NotificationShell from './NotificationShell'

interface Props {
  id: string
  payload: {
    game_id: string
    game_title: string
    accent: string
  }
  onDismiss: (id: string) => void
}

const DURATION = 5000

// No parameter needed — sound doesn't use the accent color
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

export default function GameLaunchBadge({ id, payload, onDismiss }: Props) {
  const accent = payload.accent || '#ffd93b'

  useEffect(() => {
    playLaunchSound()
  }, [])

  return (
    <NotificationShell id={id} accent={accent} duration={DURATION} onDismiss={onDismiss}>
      {/* Icon */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <motion.div
          style={{
            position: 'absolute',
            inset: -5,
            borderRadius: '50%',
            border: `1.5px solid ${accent}`,
            opacity: 0,
          }}
          animate={{ opacity: [0, 0.6, 0], scale: [0.85, 1.2, 0.85] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* One-time glow burst */}
        <motion.div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}80, transparent)`,
            opacity: 0,
          }}
          animate={{ scale: [1, 1.3, 1], opacity: [0, 0.4, 0] }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        <div
          style={{
            position: 'relative',
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
          }}
        >
          Now Playing
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display, Rajdhani, sans-serif)',
            fontSize: 20,
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 2px 12px rgba(0,0,0,0.6)',
          }}
        >
          {payload.game_title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'rgba(154,160,184,0.7)',
            marginTop: 2,
          }}
        >
          Game session started
        </div>
      </div>
    </NotificationShell>
  )
}