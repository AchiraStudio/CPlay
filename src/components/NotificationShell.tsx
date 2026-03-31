import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

interface NotificationShellProps {
  id: string
  accent?: string
  duration?: number
  onDismiss: (id: string) => void
  children: React.ReactNode
}

export default function NotificationShell({
  id,
  accent = '#ffd93b',
  duration = 5000,
  onDismiss,
  children,
}: NotificationShellProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDismissing = useRef(false)

  const handleDismiss = () => {
    if (isDismissing.current) return
    isDismissing.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    onDismiss(id)
  }

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      handleDismiss()
    }, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [duration])

  return (
    <motion.div
      layout
      style={{
        position: 'relative',
        width: 360,
        pointerEvents: 'auto',
        marginBottom: 12,
      }}
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, x: 60, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', damping: 25, stiffness: 300, layout: { duration: 0.3 } }}
    >
      {/* Outer glow halo */}
      <div
        style={{
          position: 'absolute',
          inset: -2,
          borderRadius: 8,
          background: `radial-gradient(ellipse at 100% 100%, ${accent}30 0%, transparent 60%)`,
          filter: 'blur(8px)',
          zIndex: 0,
        }}
      />

      {/* Main card */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'rgba(28, 30, 36, 0.95)',
          border: `1px solid ${accent}40`,
          borderRadius: 6,
          overflow: 'hidden',
          backdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset`,
        }}
      >
        <button
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            zIndex: 10,
            padding: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          <X size={14} />
        </button>

        {/* Content row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
          }}
        >
          {children}
        </div>

        {/* Drain bar */}
        <div
          style={{
            height: 3,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          <motion.div
            style={{
              height: '100%',
              width: '100%',
              background: `linear-gradient(90deg, ${accent}80, ${accent})`,
              transformOrigin: 'left',
              boxShadow: `0 0 8px ${accent}`,
            }}
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
          />
        </div>
      </div>
    </motion.div>
  )
}
