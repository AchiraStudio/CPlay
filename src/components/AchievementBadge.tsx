import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import NotificationShell from './NotificationShell'

interface Props {
    id: string
    payload: {
        achievement_name: string
        display_name?: string
        description?: string
        icon?: string
        accent?: string
    }
    onDismiss: (id: string) => void
}

// Subtle achievement unlock sound — generated via Web Audio API,
// no external file needed. PS5-style three-note ascending chime.
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
        // Three ascending notes — E5, G#5, B5 (major chord arpeggio)
        playNote(659.25, now, 0.18, 0.18)
        playNote(830.61, now + 0.12, 0.18, 0.15)
        playNote(987.77, now + 0.24, 0.32, 0.12)

        // Soft shimmer layer on top
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

const DURATION = 5000 // ms

export default function AchievementBadge({ id, payload, onDismiss }: Props) {
    const accent = payload.accent || '#ffd93b'

    useEffect(() => {
        playUnlockSound()
    }, [])

    const name = payload.display_name || payload.achievement_name

    return (
        <NotificationShell id={id} accent={accent} duration={DURATION} onDismiss={onDismiss}>
            {/* Icon */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
                {/* Pulsing ring */}
                <motion.div
                    style={{
                        position: 'absolute',
                        inset: -2,
                        borderRadius: '50%',
                        border: `2px solid ${accent}`,
                        opacity: 0.6,
                    }}
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                {/* Static ring */}
                <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: `2px solid ${accent}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `radial-gradient(circle, ${accent}15, transparent)`,
                    overflow: 'hidden',
                    boxShadow: `0 0 20px ${accent}30`,
                }}>
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
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.2em',
                    color: accent,
                    textTransform: 'uppercase',
                    marginBottom: 2,
                    fontFamily: 'var(--font-body)',
                    opacity: 0.9,
                }}>
                    Achievement Unlocked
                </div>
                <div style={{
                    fontFamily: 'var(--font-display, Rajdhani, sans-serif)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#ffffff',
                    lineHeight: 1.1,
                    marginBottom: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}>
                    {name}
                </div>
                {payload.description && (
                    <div style={{
                        fontSize: 12,
                        color: 'rgba(154, 160, 184, 0.85)',
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {payload.description}
                    </div>
                )}
            </div>

            {/* Right badge — XP indicator */}
            <div style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '6px 10px',
                borderRadius: 8,
                background: `${accent}12`,
                border: `1px solid ${accent}25`,
            }}>
                <Trophy size={14} color={accent} />
                <div style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: accent,
                    fontFamily: 'var(--font-display, Rajdhani, sans-serif)',
                    letterSpacing: 1,
                }}>
                    +50G
                </div>
            </div>
        </NotificationShell>
    )
}