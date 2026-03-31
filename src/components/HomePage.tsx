import { motion, Variants } from 'framer-motion'
import { Library, Gamepad2, Clock, Trophy } from 'lucide-react'
import { useStore } from '../store/useStore'

const containerVars: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const itemVars: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
}

export default function HomePage() {
  const { games, setRoute } = useStore()

  const totalPlaytime = games.reduce((acc, g) => acc + (g.playtime || 0), 0)
  const totalPlaytimeHours = Math.floor(totalPlaytime / 60)
  const totalAchievements = games.reduce((acc, g) => acc + g.achievements.filter(a => a.unlocked).length, 0)

  return (
    <div style={{ padding: '64px', height: '100%', overflowY: 'auto' }}>
      <motion.div variants={containerVars} initial="hidden" animate="show" style={{ maxWidth: 900, margin: '0 auto' }}>

        <motion.div variants={itemVars} style={{ marginBottom: 48 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 800, letterSpacing: '-1px', marginBottom: 8 }}>
            Welcome back to <span style={{ color: 'var(--accent)', textShadow: '0 0 20px var(--accent-glow)' }}>A Vault</span>.
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 18 }}>Your ultimate command center for offline operations.</p>
        </motion.div>

        <motion.div variants={itemVars} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 48 }}>
          <StatCard icon={Gamepad2} label="Total Games" value={games.length.toString()} color="#4a9eff" />
          <StatCard icon={Clock} label="Hours Logged" value={totalPlaytimeHours.toString()} color="#3ddc84" />
          <StatCard icon={Trophy} label="Achievements" value={totalAchievements.toString()} color="#ffd93b" />
        </motion.div>

        <motion.div variants={itemVars}>
          <button
            onClick={() => setRoute('library')}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '16px 40px',
              background: 'var(--accent)', color: '#000', borderRadius: 12,
              fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, letterSpacing: '1px',
              border: 'none', cursor: 'pointer', boxShadow: '0 8px 32px var(--accent-glow)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0) scale(1)'}
          >
            <Library size={20} />
            ENTER LIBRARY
          </button>
        </motion.div>

      </motion.div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div style={{
      background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
      borderRadius: 16, padding: 24, display: 'flex', alignItems: 'center', gap: 20,
      backdropFilter: 'var(--glass-filter)'
    }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={28} />
      </div>
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  )
}