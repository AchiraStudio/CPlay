import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Play, Trophy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Game } from '../store/useStore'
import { useStore } from '../store/useStore'
import styles from './GameCard.module.css'

interface Props {
  game: Game
  isSelected: boolean
  isPlaying?: boolean
  onSelect: () => void
  // FIX 3 — prop to suppress context menu in contexts where accidental removal is too easy (e.g. FavoritesPage grid)
  disableContextMenu?: boolean
}

function formatPlaytime(mins: number) {
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}

export default function GameCard({ game, isSelected, isPlaying, onSelect, disableContextMenu }: Props) {
  const { setEditingGame, removeGame } = useStore()
  const unlocked = game.achievements.filter(a => a.unlocked).length
  const total = game.achievements.length
  const progress = total > 0 ? (unlocked / total) * 100 : 0

  // Ring logic
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })

  function handleContextMenu(e: React.MouseEvent) {
    // FIX 3 — bail out early if context menu is disabled for this instance
    if (disableContextMenu) return
    e.preventDefault()
    e.stopPropagation()
    setMenuPos({ x: e.clientX, y: e.clientY })
    setShowMenu(true)
  }

  useEffect(() => {
    if (!showMenu) return
    const close = () => setShowMenu(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showMenu])

  return (
    <>
      <button
        className={`${styles.card} ${isSelected ? styles.selected : ''} ${isPlaying ? styles.playing : ''}`}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
      >
        <div
          className={styles.cover}
          style={{
            background: game.wallpaperImage
              ? undefined
              : `linear-gradient(135deg, ${game.thumbnailColor}, ${game.accentColor}40)`,
          }}
        >
          {game.wallpaperImage && (
            <img src={game.wallpaperImage} alt={game.title} className={styles.coverImg} loading="lazy" draggable={false} />
          )}
          {game.isFavorite && (
            <div className={styles.favDot} style={{ background: '#ff5577', boxShadow: '0 0 10px #ff5577' }} />
          )}
          {isPlaying && <div className={styles.playingBadge}>● PLAYING</div>}
        </div>

        <div className={styles.info}>
          <span className={styles.title}>{game.title}</span>
          <div className={styles.meta}>
            <span className={styles.playtime}>{formatPlaytime(game.playtime)}</span>
            {total > 0 && (
              <span className={styles.achCount}>
                <Trophy size={10} /> {unlocked}/{total}
              </span>
            )}
          </div>
        </div>

        <div className={styles.action}>
          <div className={styles.playWrap}>
            {total > 0 && (
              <svg className={styles.progressRing} width="36" height="36" viewBox="0 0 36 36">
                <circle className={styles.ringBg} cx="18" cy="18" r={radius} fill="none" />
                <circle
                  className={styles.ringFill}
                  cx="18"
                  cy="18"
                  r={radius}
                  fill="none"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset,
                    stroke: game.accentColor || 'var(--accent)',
                  }}
                />
              </svg>
            )}
            <div className={styles.playCircle}>
              <Play size={12} fill="#000" color="#000" />
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {showMenu && createPortal(
          <motion.div
            className="context-menu"
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15 }}
            style={{ top: menuPos.y, left: menuPos.x }}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="context-btn"
              onClick={() => { setEditingGame(game); setShowMenu(false) }}
            >
              ✏️ Edit Metadata
            </button>
            <div className="context-divider" />
            <button
              className="context-btn danger"
              onClick={() => { removeGame(game.id); setShowMenu(false) }}
            >
              🗑️ Remove Game
            </button>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </>
  )
}