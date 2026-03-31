/**
 * ToastShell.tsx
 *
 * Steam-style overlay toast shell for the OVERLAY WINDOW only.
 * Uses a strict setTimeout phase machine — no Framer Motion needed.
 *
 * Phases:
 *   bubble  (400ms)  — tiny circle pops up from bottom-right
 *   expand  (380ms)  — circle stretches horizontally into a pill
 *   hold    (varies) — full card visible, drain bar counts down
 *   shrink  (280ms)  — pill collapses back to circle
 *   popout  (300ms)  — circle scales up slightly and fades out
 *
 * After popout completes, onDone(id) is called so OverlayApp removes
 * the item from the queue.
 */

import { useEffect, useRef, useState } from 'react'

// ── Phase types ───────────────────────────────────────────────────────────────

type Phase = 'bubble' | 'expand' | 'hold' | 'shrink' | 'popout' | 'done'

// ── Durations ─────────────────────────────────────────────────────────────────

const DUR = {
  bubble: 400,
  expand: 380,
  shrink: 280,
  popout: 300,
} as const

// ── Props ─────────────────────────────────────────────────────────────────────

interface ToastShellProps {
  id: string
  accent?: string
  /** How long the card stays visible in ms (does not include entry/exit phases). */
  holdDuration?: number
  onDone: (id: string) => void
  children: React.ReactNode
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ToastShell({
  id,
  accent = '#ffd93b',
  holdDuration = 5000,
  onDone,
  children,
}: ToastShellProps) {
  const [phase, setPhase] = useState<Phase>('bubble')
  const doneRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const push = (fn: () => void, delay: number) => {
      const t = setTimeout(fn, delay)
      timersRef.current.push(t)
    }

    let cursor = 0

    // bubble → expand
    cursor += DUR.bubble
    push(() => setPhase('expand'), cursor)

    // expand → hold
    cursor += DUR.expand
    push(() => setPhase('hold'), cursor)

    // hold → shrink
    cursor += holdDuration
    push(() => setPhase('shrink'), cursor)

    // shrink → popout
    cursor += DUR.shrink
    push(() => setPhase('popout'), cursor)

    // popout → done
    cursor += DUR.popout
    push(() => {
      if (!doneRef.current) {
        doneRef.current = true
        setPhase('done')
        onDone(id)
      }
    }, cursor)

    return () => {
      timersRef.current.forEach(clearTimeout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'done') return null

  // ── Derived style per phase ─────────────────────────────────────────────────

  const isBubble = phase === 'bubble'
  const isExpand = phase === 'expand'
  const isHold = phase === 'hold'
  const isShrink = phase === 'shrink'
  const isPopout = phase === 'popout'

  // The pill width: tiny circle → full width → tiny circle → pop
  const ICON_SIZE = 56 // matches the icon circle in badges
  const FULL_WIDTH = 360

  // Width animation
  const width = isBubble
    ? ICON_SIZE
    : isExpand
    ? FULL_WIDTH
    : isHold
    ? FULL_WIDTH
    : isShrink
    ? ICON_SIZE
    : ICON_SIZE // popout

  // Scale for bubble pop-in and popout fade
  const scale = isPopout ? 1.15 : 1
  const opacity = isPopout ? 0 : 1

  // Entry pop: during 'bubble' phase, scale from 0 to 1
  const entryScale = isBubble ? 'scale(0)' : `scale(${scale})`

  const transition = (() => {
    if (isBubble) return 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease'
    if (isExpand) return `width ${DUR.expand}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 0.15s ease`
    if (isShrink) return `width ${DUR.shrink}ms cubic-bezier(0.55, 0, 1, 0.45), opacity 0.15s ease`
    if (isPopout) return `transform ${DUR.popout}ms ease, opacity ${DUR.popout}ms ease`
    return 'none'
  })()

  // After bubble, switch from transform-driven to width-driven animations
  const usesTransform = isBubble || isPopout

  return (
    <div
      style={{
        marginBottom: 12,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: usesTransform ? ICON_SIZE : width,
          height: ICON_SIZE,
          borderRadius: ICON_SIZE / 2,
          overflow: isHold ? 'visible' : 'hidden',
          background: 'rgba(22, 24, 30, 0.96)',
          border: `1px solid ${accent}40`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px ${accent}20`,
          backdropFilter: 'blur(24px) saturate(180%)',
          transform: usesTransform ? entryScale : `scale(${scale})`,
          opacity,
          transition,
          transformOrigin: 'bottom right',
          // During hold, allow the card to show its full content (not clipped)
          ...(isHold && {
            overflow: 'hidden',
            borderRadius: 10,
            height: 'auto',
            minHeight: ICON_SIZE,
          }),
        }}
      >
        {/* Glow halo */}
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: 'inherit',
            background: `radial-gradient(ellipse at 100% 100%, ${accent}28 0%, transparent 65%)`,
            filter: 'blur(10px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Content — hidden during bubble (just shows a circle with nothing inside) */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            opacity: isBubble ? 0 : isExpand ? 0 : 1,
            transition: isHold ? 'opacity 0.18s ease' : 'none',
          }}
        >
          {/* Main content row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 16px 0 4px',
              height: ICON_SIZE,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {children}
          </div>

          {/* Drain bar — only visible during hold phase */}
          {(isHold || isShrink) && (
            <div
              style={{
                height: 3,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
                borderRadius: '0 0 10px 10px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: '100%',
                  background: `linear-gradient(90deg, ${accent}80, ${accent})`,
                  boxShadow: `0 0 8px ${accent}`,
                  transformOrigin: 'left',
                  animation: `drain ${holdDuration}ms linear forwards`,
                }}
              />
            </div>
          )}
        </div>

        {/* Bubble center dot — visible only during bubble phase */}
        {isBubble && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: accent,
                opacity: 0.9,
                boxShadow: `0 0 12px ${accent}`,
              }}
            />
          </div>
        )}
      </div>

      {/* Inline keyframes for the drain bar */}
      <style>{`
        @keyframes drain {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  )
}
