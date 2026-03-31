import { Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import NotificationShell from './NotificationShell'

export default function AchievementOverlay() {
  const { recentAchievement, clearAchievement, games } = useStore()

  const game = games.find(g => g.achievements.some(a => a.id === recentAchievement?.id))
  const accent = game?.accentColor ?? '#ffd93b'

  const handleDismiss = () => {
    clearAchievement()
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      zIndex: 99999,
      pointerEvents: 'none',
    }}>
      <AnimatePresence mode="popLayout">
        {recentAchievement && (
          <NotificationShell
            key={recentAchievement.id}
            id={recentAchievement.id}
            accent={accent}
            duration={5000}
            onDismiss={handleDismiss}
          >
            {/* Icon */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <motion.div
                style={{
                  position: 'absolute',
                  inset: -2,
                  borderRadius: '50%',
                  border: `2px solid ${accent}`,
                  opacity: 0.6,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
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
                {recentAchievement.icon ? (
                  <img
                    src={recentAchievement.icon}
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
                {recentAchievement.name}
              </div>
              {game?.title && (
                <div style={{
                  fontSize: 12,
                  color: 'rgba(154, 160, 184, 0.85)',
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {game.title}
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
        )}
      </AnimatePresence>
    </div>
  )
}