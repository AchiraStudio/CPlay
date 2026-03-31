import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, BookOpen, Check, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { useStore, type Game } from '../store/useStore'
import styles from './NotesPanel.module.css'

interface Props {
    game: Game
    onClose: () => void
}

function timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime()
    const secs = Math.floor(diff / 1000)
    if (secs < 5) return 'Saved just now'
    if (secs < 60) return `Saved ${secs}s ago`
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `Saved ${mins}m ago`
    return `Saved ${Math.floor(mins / 60)}h ago`
}

const MAX_CHARS = 2000
const DEBOUNCE_MS = 500

export default function NotesPanel({ game, onClose }: Props) {
    const { updateGame } = useStore()
    const [notes, setNotes] = useState(game.notes || '')
    const [lastSaved, setLastSaved] = useState<Date | null>(
        game.notes ? new Date() : null
    )
    const [savedLabel, setSavedLabel] = useState('Saved just now')
    const [isSaving, setIsSaving] = useState(false)

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const labelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    // Keep a ref of current notes for the unmount flush
    const notesRef = useRef(notes)
    notesRef.current = notes

    // Update "Saved Xm ago" label every 10 seconds
    useEffect(() => {
        if (!lastSaved) return
        labelIntervalRef.current = setInterval(() => {
            setSavedLabel(timeAgo(lastSaved))
        }, 10_000)
        return () => {
            if (labelIntervalRef.current) clearInterval(labelIntervalRef.current)
        }
    }, [lastSaved])

    // Flush any pending debounce save on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
                updateGame(game.id, { notes: notesRef.current })
            }
        }
    }, [])

    // Debounced auto-save on every keystroke — eliminates the double-save
    // bug from Phase 1 entirely since we no longer rely on onBlur at all
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value
        if (val.length > MAX_CHARS) return
        setNotes(val)
        setIsSaving(true)

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            updateGame(game.id, { notes: val })
            const now = new Date()
            setLastSaved(now)
            setSavedLabel(timeAgo(now))
            setIsSaving(false)
        }, DEBOUNCE_MS)
    }, [game.id, updateGame])

    const charCount = notes.length
    const charPct = (charCount / MAX_CHARS) * 100
    const charWarning = charPct > 85

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
                className={styles.panel}
                style={{ '--game-accent': game.accentColor } as React.CSSProperties}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 200 }}
                onClick={e => e.stopPropagation()}
            >
                {/* Accent glow strip along left edge */}
                <div
                    className={styles.accentStrip}
                    style={{ background: game.accentColor }}
                />

                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div
                            className={styles.iconWrap}
                            style={{
                                color: game.accentColor,
                                background: `${game.accentColor}18`,
                                border: `1px solid ${game.accentColor}30`,
                            }}
                        >
                            <BookOpen size={16} />
                        </div>
                        <div className={styles.headerText}>
                            <span className={styles.headerLabel}>FIELD JOURNAL</span>
                            <span className={styles.headerGame}>{game.title}</span>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                {/* Accent divider */}
                <div
                    className={styles.divider}
                    style={{
                        background: `linear-gradient(90deg, ${game.accentColor}70, transparent 60%)`,
                    }}
                />

                {/* Writing area */}
                <div className={styles.body}>
                    {/* Subtle horizontal line guides — pure CSS, no images */}
                    <div className={styles.lineGuides} />
                    <textarea
                        className={styles.textarea}
                        value={notes}
                        onChange={handleChange}
                        placeholder={`Log your progress, puzzle solutions, objectives...\n\nThis is your personal field journal for ${game.title}.`}
                        autoFocus
                        spellCheck
                    />
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <div className={styles.saveStatus}>
                        {isSaving ? (
                            <span className={styles.saving}>
                                <span className={styles.savingDot} />
                                Saving...
                            </span>
                        ) : lastSaved ? (
                            <span className={styles.saved}>
                                <Check size={11} />
                                {savedLabel}
                            </span>
                        ) : (
                            <span className={styles.noSave}>
                                <Clock size={11} />
                                Not saved yet
                            </span>
                        )}
                    </div>

                    {/* SVG ring character counter */}
                    <div className={styles.charWrap} title={`${MAX_CHARS - charCount} characters remaining`}>
                        <svg width="28" height="28" viewBox="0 0 28 28" className={styles.charRing}>
                            <circle
                                cx="14" cy="14" r="11"
                                fill="none"
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth="2.5"
                            />
                            <circle
                                cx="14" cy="14" r="11"
                                fill="none"
                                stroke={charWarning ? '#ffb74d' : game.accentColor}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 11}`}
                                strokeDashoffset={`${2 * Math.PI * 11 * (1 - charPct / 100)}`}
                                style={{
                                    transform: 'rotate(-90deg)',
                                    transformOrigin: '50% 50%',
                                    transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease',
                                }}
                            />
                        </svg>
                        <span
                            className={styles.charCount}
                            style={{ color: charWarning ? '#ffb74d' : 'var(--text-muted)' }}
                        >
                            {MAX_CHARS - charCount}
                        </span>
                    </div>
                </div>
            </motion.div>
        </motion.div>,
        document.body
    )
}