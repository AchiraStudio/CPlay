import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Rocket, Trophy, Bug, RefreshCw, Layers, CheckCircle, XCircle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = { ok: boolean; msg: string } | null

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: Status }) {
  if (!status) return null
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      borderRadius: 8,
      background: status.ok ? 'rgba(61,220,132,0.1)' : 'rgba(255,85,85,0.1)',
      border: `1px solid ${status.ok ? 'rgba(61,220,132,0.3)' : 'rgba(255,85,85,0.3)'}`,
      color: status.ok ? '#3ddc84' : '#ff5555',
      fontSize: 12,
      fontWeight: 600,
      marginTop: 8,
    }}>
      {status.ok
        ? <CheckCircle size={13} />
        : <XCircle size={13} />}
      {status.msg}
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>{title}</h2>
      {children}
    </div>
  )
}

// ── Debug action button ───────────────────────────────────────────────────────

function DebugBtn({
  icon, label, sub, onClick, loading,
}: {
  icon: React.ReactNode
  label: string
  sub: string
  onClick: () => void
  loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        color: '#fff',
        cursor: loading ? 'default' : 'pointer',
        textAlign: 'left',
        width: '100%',
        opacity: loading ? 0.5 : 1,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        if (!loading) {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'
            ; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)'
        }
      }}
      onMouseLeave={e => {
        ; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
          ; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'
      }}
    >
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [overlayStatus, setOverlayStatus] = useState<Status>(null)
  const [launchStatus, setLaunchStatus] = useState<Status>(null)
  const [achStatus, setAchStatus] = useState<Status>(null)
  const [burstStatus, setBurstStatus] = useState<Status>(null)
  const [loading, setLoading] = useState<string | null>(null)

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function run<T>(
    key: string,
    setter: (s: Status) => void,
    fn: () => Promise<T>,
  ) {
    setLoading(key)
    setter(null)
    try {
      await fn()
      setter({ ok: true, msg: 'Success' })
    } catch (e) {
      setter({ ok: false, msg: String(e) })
    } finally {
      setLoading(null)
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Show the overlay window without launching a game */
  const handleShowOverlay = () =>
    run('overlay', setOverlayStatus, () =>
      invoke('debug_show_overlay')
    )

  /** Emit a fake game-launched badge to the overlay */
  const handleLaunchBadge = () =>
    run('launch', setLaunchStatus, () =>
      invoke('debug_launch_badge', {
        gameTitle: 'Cyberpunk 2077',
        accent: '#fdf500',
      })
    )

  /** Emit a single fake achievement unlock to the overlay */
  const handleAchievement = () =>
    run('ach', setAchStatus, () =>
      invoke('debug_achievement', {
        name: `Breathtaking_${Date.now()}`,
        displayName: 'Breathtaking',
        description: 'Complete the main story in Night City.',
        accent: '#00ffcc',
      })
    )

  /** Emit 3 achievements back-to-back to test stacking */
  const handleBurst = async () => {
    setBurstStatus(null)
    setLoading('burst')
    try {
      const achs = [
        { name: `ach_a_${Date.now()}`, displayName: 'Breathtaking', description: 'Complete the main story.', accent: '#00ffcc' },
        { name: `ach_b_${Date.now()}`, displayName: 'Night City Legend', description: 'Reach max street cred.', accent: '#ffd93b' },
        { name: `ach_c_${Date.now()}`, displayName: 'Ripperdoc', description: 'Install 30 cyberware mods.', accent: '#a78bfa' },
      ]
      for (let i = 0; i < achs.length; i++) {
        await new Promise(r => setTimeout(r, i * 700))
        await invoke('debug_achievement', achs[i])
      }
      setBurstStatus({ ok: true, msg: '3 toasts fired' })
    } catch (e) {
      setBurstStatus({ ok: false, msg: String(e) })
    } finally {
      setLoading(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: '40px 56px',
    }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <Bug size={28} color="#ffd93b" />
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.3px',
            margin: 0,
          }}>
            Debug Console
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Test overlay notifications without launching a game.
          </p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 20,
        maxWidth: 800,
      }}>

        {/* ── Overlay window ── */}
        <Card title="Overlay Window">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            The overlay is a separate transparent window that sits on top of
            the game. Use this to show / verify it without launching anything.
          </p>
          <DebugBtn
            icon={<Layers size={18} color="#4a9eff" />}
            label="Show Overlay Window"
            sub="Reveal the transparent overlay over your desktop"
            onClick={handleShowOverlay}
            loading={loading === 'overlay'}
          />
          <StatusPill status={overlayStatus} />
        </Card>

        {/* ── Toast triggers ── */}
        <Card title="Toast Triggers">
          <DebugBtn
            icon={<Rocket size={18} color="#fdf500" />}
            label="Game Launch Badge"
            sub={'Fires the "Now Playing" toast'}
            onClick={handleLaunchBadge}
            loading={loading === 'launch'}
          />
          <StatusPill status={launchStatus} />

          <DebugBtn
            icon={<Trophy size={18} color="#00ffcc" />}
            label="Single Achievement"
            sub="Fires one achievement-unlocked toast"
            onClick={handleAchievement}
            loading={loading === 'ach'}
          />
          <StatusPill status={achStatus} />

          <DebugBtn
            icon={<RefreshCw size={18} color="#ff4444" />}
            label="Stack Burst (×3)"
            sub="Fires 3 achievements 700 ms apart"
            onClick={handleBurst}
            loading={loading === 'burst'}
          />
          <StatusPill status={burstStatus} />
        </Card>

        {/* ── System info ── */}
        <Card title="System Info">
          <div style={{
            fontFamily: 'monospace',
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.8,
          }}>
            <div><span style={{ color: '#ffd93b' }}>overlay</span>   transparent Tauri window</div>
            <div><span style={{ color: '#ffd93b' }}>position</span>  bottom-right corner</div>
            <div><span style={{ color: '#ffd93b' }}>dismiss</span>   5 000 ms auto + ✕ button</div>
            <div><span style={{ color: '#ffd93b' }}>passthrough</span> cursor events ignored</div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            The overlay is shown automatically when a game launches and hidden
            when it exits. Debug commands bypass the game lifecycle so you can
            test toasts at any time.
          </p>
        </Card>

      </div>
    </div>
  )
}