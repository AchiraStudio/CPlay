/**
 * App.tsx — Main launcher window
 *
 * The in-app AchievementOverlay component has been removed.
 * Achievement toasts and launch badges now appear in the separate
 * overlay Tauri window (label="overlay") that sits on top of the game.
 *
 * This window still listens for:
 *   "achievement-unlocked"  → update the Zustand store (mark ach unlocked)
 *   "game-exited"           → update run state
 *   "game-launched"         → update run state to 'running'
 */

import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useStore } from './store/useStore'
import Sidebar from './components/Sidebar'
import LibraryPage from './components/LibraryPage'
import HomePage from './components/HomePage'
import ProfilePage from './components/ProfilePage'
import FavoritesPage from './components/FavoritesPage'
import AddGameModal from './components/AddGameModal'
import TitleBar from './components/TitleBar'
import SettingsPage from './components/SettingsPage'
import { useStartupRefresh } from './hooks/useStartupRefresh'
import { AnimatePresence, motion } from 'framer-motion'
import './App.css'

export default function App() {
  const {
    isAddingGame, setAddingGame,
    editingGame, setEditingGame,
    currentRoute,
    unlockAchievement,
    setRunState,
    games,
  } = useStore()

  useStartupRefresh()

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddingGame) setAddingGame(false)
        if (editingGame) setEditingGame(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAddingGame, editingGame, setAddingGame, setEditingGame])

  // ── Achievement unlock events (store update only, no toast here) ────────
  useEffect(() => {
    const unsub = listen<{
      game_id: string
      achievement_name: string
      match_by?: string
    }>('achievement-unlocked', ({ payload }) => {
      const game = games.find(g => g.id === payload.game_id)
      if (!game) return

      const byDisplayName = payload.match_by === 'display_name'
      const ach = byDisplayName
        ? game.achievements.find(a => a.name === payload.achievement_name)
        : game.achievements.find(a => a.id === payload.achievement_name)

      if (!ach || ach.unlocked) return
      unlockAchievement(payload.game_id, ach.id)
    })
    return () => { unsub.then(fn => fn()) }
  }, [games, unlockAchievement])

  // ── Game lifecycle events ───────────────────────────────────────────────
  useEffect(() => {
    const unLaunched = listen<string>('game-launched', ({ payload: gameId }) => {
      setRunState(gameId, 'running')
    })
    const unExited = listen<string>('game-exited', ({ payload: gameId }) => {
      setRunState(gameId, 'idle')
    })
    return () => {
      unLaunched.then(fn => fn())
      unExited.then(fn => fn())
    }
  }, [setRunState])

  return (
    <div className="app-root">
      <TitleBar />

      <div className="app-body">
        <Sidebar />

        <main className="app-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentRoute}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: '100%', height: '100%' }}
            >
              {currentRoute === 'home' && <HomePage />}
              {currentRoute === 'library' && <LibraryPage />}
              {currentRoute === 'profile' && <ProfilePage />}
              {currentRoute === 'favorites' && <FavoritesPage />}
              {currentRoute === 'settings' && <SettingsPage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAddingGame && <AddGameModal />}
        {editingGame && <AddGameModal editGame={editingGame} />}
      </AnimatePresence>

      {/*
        AchievementOverlay has been intentionally removed from this window.
        Achievement toasts now appear in the separate overlay Tauri window
        (label="overlay") which floats on top of the running game process.
      */}
    </div>
  )
}