import { createPortal } from 'react-dom'
import { X, Trophy, Lock, Info, CheckCircle, Cpu } from 'lucide-react'
import { motion } from 'framer-motion'
import { useStore, type Game, type Achievement } from '../store/useStore'
import styles from './AchievementPanel.module.css'

interface Props {
  game: Game
  onClose: () => void
}

export default function AchievementPanel({ game, onClose }: Props) {
  const { unlockAchievement, triggerAchievement } = useStore()

  const unlocked = game.achievements.filter(a => a.unlocked)
  const locked = game.achievements.filter(a => !a.unlocked && !a.hidden)
  const hidden = game.achievements.filter(a => !a.unlocked && a.hidden)

  const pct = Math.round((unlocked.length / (game.achievements.length || 1)) * 100)

  const handleTestUnlock = (ach: Achievement) => {
    unlockAchievement(game.id, ach.id)
    triggerAchievement({ ...ach, unlocked: true, unlockedAt: new Date().toISOString() })
  }

  // Render modal directly to document.body so it overlays EVERYTHING (Sidebar, TitleBar, etc.)
  return createPortal(
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.modal}
        initial={{ y: 20, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 15, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.titleGroup}>
              <Trophy size={16} className={styles.trophyIcon} />
              <h2 className={styles.title}>System Objectives</h2>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className={styles.progressSection}>
            <div className={styles.progressLabel}>
              <span>Deployment Status</span>
              <span className={styles.pct}>{pct}%</span>
            </div>
            <div className={styles.progressBar}>
              <motion.div
                className={styles.progressFill}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ background: game.accentColor }}
              />
            </div>
          </div>
        </div>

        <div className={styles.scrollArea}>
          {unlocked.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>CONFIRMED ENTRIES ({unlocked.length})</h3>
              <div className={styles.grid}>
                {unlocked.map(ach => (
                  <div key={ach.id} className={`${styles.item} ${styles.itemUnlocked}`}>
                    <div className={styles.iconWrap}>
                      {ach.icon ? (
                        <img src={ach.icon} alt="" className={styles.icon} loading="lazy" />
                      ) : (
                        <div className={styles.iconFallback} style={{ background: game.accentColor }}>
                          <Trophy size={16} />
                        </div>
                      )}
                      <div className={styles.checkBadge}><CheckCircle size={10} strokeWidth={3} /></div>
                    </div>
                    <div className={styles.info}>
                      <div className={styles.name}>{ach.name}</div>
                      <div className={styles.desc} title={ach.description}>{ach.description}</div>
                      <div className={styles.time}>
                        {ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString() : 'Timestamp unavailable'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {locked.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>PENDING LOGS ({locked.length})</h3>
              <div className={styles.grid}>
                {locked.map(ach => (
                  <div key={ach.id} className={styles.item}>
                    <div className={styles.iconWrap}>
                      {ach.iconGray ? (
                        <img src={ach.iconGray} alt="" className={`${styles.icon} ${styles.gray}`} loading="lazy" />
                      ) : (
                        <div className={styles.iconFallbackMuted}><Lock size={16} /></div>
                      )}
                    </div>
                    <div className={styles.info}>
                      <div className={styles.name}>{ach.name}</div>
                      <div className={styles.desc} title={ach.description}>{ach.description}</div>
                    </div>
                    <button className={styles.testBtn} onClick={() => handleTestUnlock(ach)} title="Decrypt Data Sample">
                      <Cpu size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {hidden.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>ENCRYPTED SECTORS ({hidden.length})</h3>
              <div className={styles.hiddenCard}>
                <div className={styles.hiddenIcon}><Info size={20} /></div>
                <div className={styles.hiddenInfo}>
                  <div className={styles.hiddenTitle}>{hidden.length} Classified Objectives</div>
                  <div className={styles.hiddenDesc}>Progress through sectors to decrypt these challenges.</div>
                </div>
              </div>
            </section>
          )}

          {game.achievements.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><Cpu size={32} /></div>
              <p>No operational logs found in target save region.</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body // <-- Portal target
  )
}