import { useState, useEffect } from 'react'
import { getCurrentWindow, Window } from '@tauri-apps/api/window'
import { useStore } from '../store/useStore'
import styles from './TitleBar.module.css'

export default function TitleBar() {
  const { selectedGameId, games, currentRoute } = useStore()
  const selectedGame = games.find(g => g.id === selectedGameId)
  const [appWindow, setAppWindow] = useState<Window | null>(null)

  useEffect(() => {
    try {
      setAppWindow(getCurrentWindow())
    } catch (e) {
      console.warn("Tauri window API not available", e)
    }
  }, [])

  return (
    <div className={styles.bar} data-tauri-drag-region>
      <div className={styles.left} data-tauri-drag-region>
        <div className={styles.logo}>
          <span className={styles.logoV}>A</span>
          <span className={styles.logoText}> VAULT</span>
        </div>
        {currentRoute === 'library' && selectedGame && (
          <span className={styles.breadcrumb}>
            <span className={styles.sep}>›</span>
            {selectedGame.title}
          </span>
        )}
      </div>

      <div className={styles.center} data-tauri-drag-region>
        <div className={styles.pulse} title="Server Connected" />
      </div>

      <div className={styles.controls}>
        <button
          className={`${styles.ctrl} ${styles.minimize}`}
          onClick={() => appWindow?.minimize()}
          title="Minimize"
        >
          <svg width="10" height="2" viewBox="0 0 10 2"><rect width="10" height="2" rx="1" fill="currentColor" /></svg>
        </button>
        <button
          className={`${styles.ctrl} ${styles.maximize}`}
          onClick={() => appWindow?.toggleMaximize()}
          title="Maximize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
        <button
          className={`${styles.ctrl} ${styles.close}`}
          onClick={() => appWindow?.close()}
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}