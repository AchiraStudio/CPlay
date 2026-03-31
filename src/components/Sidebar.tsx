import { motion } from 'framer-motion'
import { Home, Library, Heart, User, Settings, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import styles from './Sidebar.module.css'

export default function Sidebar() {
  const { setAddingGame, currentRoute, setRoute, games } = useStore()
  const favoriteCount = games.filter(g => g.isFavorite).length

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'favorites', label: 'Favorites', icon: Heart },
  ]

  const accountItems = [
    { id: 'profile', label: 'Service Record', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <h3 className={styles.heading}>YOUR A VAULT</h3>
        <nav className={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentRoute === item.id
            return (
              <button
                key={item.id}
                className={`${styles.navItem} ${isActive ? styles.activeText : ''}`}
                onClick={() => setRoute(item.id as any)}
              >
                {isActive && (
                  <motion.div layoutId="sidebar-active" className={styles.activePill} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                )}
                <span className={styles.iconWrap}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span className={styles.label}>{item.label}</span>
                {item.id === 'favorites' && favoriteCount > 0 && (
                  <span className={styles.badge}>{favoriteCount}</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div className={styles.section}>
        <h3 className={styles.heading}>IDENTITY</h3>
        <nav className={styles.nav}>
          {accountItems.map((item) => {
            const Icon = item.icon
            const isActive = currentRoute === item.id
            return (
              <button
                key={item.id}
                className={`${styles.navItem} ${isActive ? styles.activeText : ''}`}
                onClick={() => setRoute(item.id as any)}
              >
                {isActive && (
                  <motion.div layoutId="sidebar-active" className={styles.activePill} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                )}
                <span className={styles.iconWrap}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span className={styles.label}>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className={styles.footerSection}>
        <button className={styles.addBtn} onClick={() => setAddingGame(true)}>
          <div className={styles.addIcon}>
            <Plus size={16} strokeWidth={3} />
          </div>
          <span>Add Game</span>
        </button>
      </div>
    </aside>
  )
}