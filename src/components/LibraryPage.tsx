import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Play, Square, Clock, Trophy, Cpu, Library as LibraryIcon, Plus, Heart, BookOpen } from 'lucide-react'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import GameCard from './GameCard'
import AchievementPanel from './AchievementPanel'
import NotesPanel from './NotesPanel'
import styles from './LibraryPage.module.css'

type RunState = 'idle' | 'launching' | 'running'

function formatPlaytime(mins: number) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function timeAgo(iso?: string) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'Recently'
}

interface DiskStats {
  game_id: string
  total_playtime_mins: number
  last_played: string
  last_session_mins: number
  session_count: number
  sessions: { start: string; duration_mins: number }[]
}

interface AchievementDef {
  name: string
  display_name: string
  description: string
  icon?: string
  icongray?: string
  hidden?: number
}

const EMULATOR_LABELS: Record<string, string> = {
  codex: 'CODEX',
  goldberg: 'GOLDBERG',
  anadius: 'ANADIUS',
  unknown: 'UNKNOWN',
}

export default function LibraryPage() {
  const {
    games, selectedGameId, selectGame, removeGame,
    toggleFavorite, updateGame, setAddingGame, setEditingGame,
    unlockAchievement, triggerAchievement,
    runStates, setRunState, currentRoute
  } = useStore()

  const selectedGame = games.find(g => g.id === selectedGameId) ?? games[0]

  const [showAchievements, setShowAchievements] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [wallpaperLoaded, setWallpaperLoaded] = useState(false)
  const [prevWallpaper, setPrevWallpaper] = useState<string | undefined>()
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })

  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [settingsMenuPos, setSettingsMenuPos] = useState({ x: 0, y: 0 })

  const pollingRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!showSettingsMenu) return
    const close = () => setShowSettingsMenu(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showSettingsMenu])

  const shelfRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPrevWallpaper(selectedGame?.wallpaperImage)
    setWallpaperLoaded(false)
    const t = setTimeout(() => setWallpaperLoaded(true), 50)
    return () => clearTimeout(t)
  }, [selectedGameId])

  useEffect(() => {
    if (!selectedGame?.achievementsJson) return
    if (selectedGame.achievements.length > 0) return

    invoke<AchievementDef[]>('load_achievements', { jsonPath: selectedGame.achievementsJson })
      .then(defs => {
        const achievements = defs.map(d => ({
          id: d.name,
          name: d.display_name,
          description: d.description || '',
          icon: d.icon ? (d.icon.startsWith('http') ? d.icon : convertFileSrc(d.icon)) : undefined,
          iconGray: d.icongray ? (d.icongray.startsWith('http') ? d.icongray : convertFileSrc(d.icongray)) : undefined,
          hidden: d.hidden === 1,
          unlocked: false,
        }))
        updateGame(selectedGame.id, { achievements })
      })
      .catch(() => { })
  }, [selectedGameId])

  useEffect(() => {
    if (!selectedGame) return
    invoke<DiskStats>('get_game_stats', { gameId: selectedGame.id })
      .then(stats => {
        if (stats.total_playtime_mins > 0 || stats.last_played) {
          updateGame(selectedGame.id, {
            playtime: stats.total_playtime_mins,
            lastPlayed: stats.last_played || selectedGame.lastPlayed,
            lastSessionMins: stats.last_session_mins,
            sessionCount: stats.session_count,
            sessions: stats.sessions || [],
          })
        }
      })
      .catch(() => { })
  }, [selectedGameId])

  useEffect(() => {
    const unlistenPromise = listen<{ game_id: string; achievement_name: string; match_by?: string }>(
      'achievement-unlocked',
      ({ payload }) => {
        const game = games.find(g => g.id === payload.game_id)
        if (!game) return

        const matchByDisplayName = payload.match_by === 'display_name'
        const ach = matchByDisplayName
          ? game.achievements.find(a => a.name === payload.achievement_name)
          : game.achievements.find(a => a.id === payload.achievement_name)

        if (!ach || ach.unlocked) return
        unlockAchievement(payload.game_id, ach.id)
        triggerAchievement({ ...ach, unlocked: true, unlockedAt: new Date().toISOString() })
      }
    )
    return () => { unlistenPromise.then(fn => fn()) }
  }, [games, unlockAchievement, triggerAchievement])

  useEffect(() => {
    const unlistenPromise = listen<string>('game-exited', ({ payload: gameId }) => {
      invoke<DiskStats>('get_game_stats', { gameId })
        .then(stats => {
          updateGame(gameId, {
            playtime: stats.total_playtime_mins,
            lastPlayed: stats.last_played,
            lastSessionMins: stats.last_session_mins,
            sessionCount: stats.session_count,
            sessions: stats.sessions || [],
            isRunning: false,
          })
        })
        .catch(() => { })
      setRunState(gameId, 'idle')
      if (pollingRef.current[gameId]) {
        clearInterval(pollingRef.current[gameId])
        delete pollingRef.current[gameId]
      }
    })
    return () => { unlistenPromise.then(fn => fn()) }
  }, [updateGame])

  const startPolling = useCallback((gameId: string) => {
    if (pollingRef.current[gameId]) return
    pollingRef.current[gameId] = setInterval(async () => {
      try {
        const alive = await invoke<boolean>('is_game_running', { gameId })
        const prev = useStore.getState().runStates
        if (!alive && (prev[gameId] === 'running' || prev[gameId] === 'launching')) {
          invoke<DiskStats>('get_game_stats', { gameId })
            .then(stats => {
              updateGame(gameId, {
                playtime: stats.total_playtime_mins,
                lastPlayed: stats.last_played,
                lastSessionMins: stats.last_session_mins,
                sessionCount: stats.session_count,
                sessions: stats.sessions || [],
                isRunning: false,
              })
            })
            .catch(() => updateGame(gameId, { isRunning: false }))
          clearInterval(pollingRef.current[gameId])
          delete pollingRef.current[gameId]
          setRunState(gameId, 'idle')
        } else if (alive && prev[gameId] === 'launching') {
          updateGame(gameId, { isRunning: true })
          setRunState(gameId, 'running')
        }
      } catch {
        clearInterval(pollingRef.current[gameId])
        delete pollingRef.current[gameId]
        setRunState(gameId, 'idle')
      }
    }, 2000) as unknown as number
  }, [updateGame, setRunState])

  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval)
    }
  }, [])

  // FIX 2 — handlePlay wrapped in useCallback to prevent stale closure in Space shortcut
  const handlePlay = useCallback(async () => {
    if (!selectedGame) return
    const gameId = selectedGame.id

    setRunState(gameId, 'launching')
    updateGame(gameId, {
      lastPlayed: new Date().toISOString(),
      isRunning: false,
    })

    try {
      await invoke('launch_game', {
        gameId,
        gameTitle: selectedGame.title,           // NEW — for launch badge
        gameAccent: selectedGame.accentColor ?? null, // NEW — for badge tint
        path: selectedGame.exePath,
        achievementsIni: selectedGame.achievementsIni ?? null,
        achievementsJson: selectedGame.achievementsJson ?? null,
        achievementsXml: selectedGame.achievementsXml ?? null,
      })
      setTimeout(() => startPolling(gameId), 1500)
    } catch (e) {
      console.error('Launch failed:', e)
      alert(`Failed to launch: ${e}`)
      setRunState(gameId, 'idle')
    }
  }, [selectedGame, setRunState, updateGame, startPolling])

  // FIX 2 — Space shortcut now uses stable handlePlay reference, clean dependency array
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (currentRoute !== 'library') return
      if (showAchievements || showNotes || showSettingsMenu) return
      const activeTag = document.activeElement?.tagName
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return
      e.preventDefault()
      handlePlay()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentRoute, showAchievements, showNotes, showSettingsMenu, handlePlay])

  async function handleStop() {
    if (!selectedGame) return
    const gameId = selectedGame.id
    try {
      await invoke('stop_game', { gameId })
    } catch (e) {
      console.error('Stop failed:', e)
    }
    clearInterval(pollingRef.current[gameId])
    delete pollingRef.current[gameId]
    setRunState(gameId, 'idle')
    updateGame(gameId, { isRunning: false })
    setTimeout(() => {
      invoke<DiskStats>('get_game_stats', { gameId })
        .then(stats => updateGame(gameId, {
          playtime: stats.total_playtime_mins,
          lastPlayed: stats.last_played,
          lastSessionMins: stats.last_session_mins,
          sessionCount: stats.session_count,
          sessions: stats.sessions || [],
        }))
        .catch(() => { })
    }, 1000)
  }

  function handleMouseMove(e: React.MouseEvent) {
    setMousePos({
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    })
  }

  const parallaxX = (mousePos.x - 0.5) * 4
  const parallaxY = (mousePos.y - 0.5) * 4

  const unlockedCount = selectedGame?.achievements.filter(a => a.unlocked).length ?? 0
  const totalCount = selectedGame?.achievements.length ?? 0
  const runState: RunState = selectedGame ? (runStates[selectedGame.id] ?? 'idle') : 'idle'
  const hasAchievements = totalCount > 0
    || !!(selectedGame?.achievementsJson)
    || !!(selectedGame?.achievementsIni)
    || !!(selectedGame?.achievementsXml)

  function renderPlayButton() {
    if (runState === 'launching') {
      return (
        <button className={`${styles.playBtn} ${styles.playBtnLaunching}`} disabled>
          <span className={styles.launchSpinner} />
          <span>LAUNCHING…</span>
        </button>
      )
    }
    if (runState === 'running') {
      return (
        <button
          className={`${styles.playBtn}`}
          onClick={handleStop}
          style={{ background: '#ff4444', boxShadow: '0 4px 24px #ff444440' }}
        >
          <Square size={18} fill="currentColor" />
          <span>STOP</span>
        </button>
      )
    }
    return (
      <button className={styles.playBtn} onClick={handlePlay}>
        <Play size={20} fill="currentColor" className={styles.playIcon} />
        <span>PLAY</span>
      </button>
    )
  }

  if (games.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyHero}>
          <div className={styles.emptyIcon}><LibraryIcon size={40} /></div>
          <h1 className={styles.emptyTitle}>Welcome to A Vault</h1>
          <p className={styles.emptyDesc}>
            Your collection is waiting to be built. Add your favorite games to start
            tracking achievements and playtimes.
          </p>
          <button className={styles.emptyAction} onClick={() => setAddingGame(true)}>
            <Plus size={20} /><span>Add Your First Game</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root} onMouseMove={handleMouseMove}>
      {/* Wallpaper layers */}
      <div className={styles.wallpaperWrap}>
        {prevWallpaper && (
          <div
            className={styles.wallpaperPrev}
            style={{
              backgroundImage: `url(${prevWallpaper})`,
              backgroundPosition: `calc(50% + ${parallaxX}%) calc(20% + ${parallaxY}%)`,
            }}
          />
        )}
        <div
          className={`${styles.wallpaper} ${wallpaperLoaded ? styles.wallpaperVisible : ''}`}
          style={{
            backgroundImage: `url(${selectedGame?.wallpaperImage})`,
            backgroundPosition: `calc(50% + ${parallaxX}%) calc(20% + ${parallaxY}%)`,
          }}
        />
        <div
          className={styles.wallpaperTint}
          style={{ background: `linear-gradient(135deg, ${selectedGame?.thumbnailColor ?? '#0b0f1a'}50 0%, transparent 80%)` }}
        />
        <div className={styles.wallpaperOverlay} />
      </div>

      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroMeta}>
            <span className={styles.emulatorBadge}>{EMULATOR_LABELS[selectedGame?.emulator ?? 'unknown']}</span>
            {selectedGame?.genre && <span className={styles.genreBadge}>{selectedGame.genre}</span>}
            {runState === 'running' && <span className={styles.runningBadge}>● RUNNING</span>}
          </div>

          <h1 className={styles.heroTitle}>{selectedGame?.title}</h1>

          {selectedGame?.developer && (
            <p className={styles.heroDev}>Published by <span>{selectedGame.developer}</span></p>
          )}

          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <Clock size={16} /><span>{formatPlaytime(selectedGame?.playtime ?? 0)}</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <Trophy size={16} /><span>{unlockedCount} / {totalCount}</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statLabel}>Last played</span>
              <span>{timeAgo(selectedGame?.lastPlayed)}</span>
            </div>
            {(selectedGame?.lastSessionMins ?? 0) > 0 && (
              <>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Last session</span>
                  <span>{formatPlaytime(selectedGame!.lastSessionMins!)}</span>
                </div>
              </>
            )}
            {(selectedGame?.sessionCount ?? 0) > 0 && (
              <>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Sessions</span>
                  <span>{selectedGame!.sessionCount}</span>
                </div>
              </>
            )}
          </div>

          <div className={styles.heroActions}>
            <div className={styles.actions}>
              {renderPlayButton()}

              <button
                className={`${styles.iconAction} ${styles.btnFavorite} ${selectedGame?.isFavorite ? styles.favActive : ''}`}
                onClick={() => selectedGame && toggleFavorite(selectedGame.id)}
                title={selectedGame?.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart size={20} fill={selectedGame?.isFavorite ? 'currentColor' : 'none'} />
              </button>

              {/* FIX 1 — iconActionActive now correctly applied when showNotes is true */}
              <button
                className={`${styles.iconAction} ${styles.btnNotes} ${showNotes ? styles.iconActionActive : ''}`}
                title="Field Journal"
                onClick={() => setShowNotes(v => !v)}
              >
                <BookOpen size={20} />
              </button>

              <button
                className={`${styles.iconAction} ${styles.btnSettings}`}
                title="Settings"
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  setSettingsMenuPos({ x: rect.right - 180, y: rect.bottom + 8 })
                  setShowSettingsMenu(!showSettingsMenu)
                }}
              >
                <Cpu size={20} />
              </button>
            </div>

            {hasAchievements && (
              <div className={styles.achievementTab} onClick={() => setShowAchievements(true)}>
                <div className={styles.achTabHeader}>
                  <div className={styles.achTabTitle}><Trophy size={14} /><span>ACHIEVEMENTS</span></div>
                  <span className={styles.achTabCount}>
                    {totalCount > 0 ? `${unlockedCount} / ${totalCount}` : 'Loading...'}
                  </span>
                </div>
                <div className={styles.achTabProgress}>
                  <div
                    className={styles.achTabFill}
                    style={{
                      width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%`,
                      background: selectedGame?.accentColor || 'var(--accent)',
                    }}
                  />
                </div>
                <div className={styles.achTabFooter}>
                  <span className={styles.achTabHint}>Click to Expand</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showAchievements && selectedGame && (
            <AchievementPanel game={selectedGame} onClose={() => setShowAchievements(false)} />
          )}
        </AnimatePresence>
      </div>

      <div className={styles.shelf}>
        <div
          className={styles.shelfGlow}
          style={{ background: `linear-gradient(to bottom, ${selectedGame?.thumbnailColor}40 0%, transparent 100%)` }}
        />
        <div className={styles.shelfHeader}>
          <div className={styles.shelfTitleGroup}>
            <span className={styles.shelfTitle}>LIBRARY</span>
            <span className={styles.shelfCount}>{games.length} Titles</span>
          </div>
        </div>
        <div className={styles.gameGrid} ref={shelfRef}>
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isSelected={game.id === selectedGame?.id}
              isPlaying={runStates[game.id] === 'launching' || runStates[game.id] === 'running'}
              onSelect={() => selectGame(game.id)}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showSettingsMenu && selectedGame && createPortal(
          <motion.div
            className="context-menu"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{ top: settingsMenuPos.y, left: settingsMenuPos.x }}
            onClick={e => e.stopPropagation()}
          >
            <button className="context-btn" onClick={() => { setEditingGame(selectedGame); setShowSettingsMenu(false) }}>
              ✏️ Edit Metadata
            </button>
            <div className="context-divider" />
            <button className="context-btn danger" onClick={() => { removeGame(selectedGame.id); setShowSettingsMenu(false) }}>
              🗑️ Remove Game
            </button>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNotes && selectedGame && (
          <NotesPanel game={selectedGame} onClose={() => setShowNotes(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}