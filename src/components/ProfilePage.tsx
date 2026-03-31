import { useState } from 'react'
import { motion, Variants } from 'framer-motion'
import {
    Trophy, Clock, Target, Shield, Edit3,
    Globe, Lock, Play, Flame, BarChart2,
} from 'lucide-react'
import { useStore, type Game } from '../store/useStore'
import styles from './ProfilePage.module.css'

// ── Animation variants ────────────────────────────────────────────────────────

const containerVars: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVars: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
}

// ── Rank calculation ──────────────────────────────────────────────────────────

function calculateRank(playtimeMins: number, achievementsCount: number) {
    const score = Math.floor(playtimeMins / 60) * 10 + achievementsCount * 50

    const ranks = [
        { title: 'Initiate', threshold: 0, max: 500, color: '#9aa0b8' },
        { title: 'Operative', threshold: 500, max: 2000, color: '#4a9eff' },
        { title: 'Veteran', threshold: 2000, max: 5000, color: '#a78bfa' },
        { title: 'Elite', threshold: 5000, max: 10000, color: '#ff5577' },
        { title: 'Legend', threshold: 10000, max: Infinity, color: '#ffd93b' },
    ]

    const currentIndex = [...ranks].reverse().findIndex(r => score >= r.threshold)
    const idx = ranks.length - 1 - currentIndex
    const current = ranks[idx]
    const next = ranks[idx + 1] ?? current

    const progress =
        current.title === 'Legend'
            ? 100
            : ((score - current.threshold) / (current.max - current.threshold)) * 100

    return { ...current, score, progress, nextTitle: next.title }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPlaytime(mins: number) {
    if (!mins) return '0m'
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function timeAgo(iso?: string) {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const d = Math.floor(diff / 86_400_000)
    const h = Math.floor(diff / 3_600_000)
    if (d > 0) return `${d}d ago`
    if (h > 0) return `${h}h ago`
    return 'Recently'
}

// ── 7-day playtime chart ──────────────────────────────────────────────────────

interface DayBar {
    label: string
    date: string
    mins: number
}

// Explicit Game[] type — fixes TS2339 "Property 'games' does not exist on type 'unknown'"
function buildWeekData(games: Game[]): DayBar[] {
    const days: DayBar[] = []
    const now = new Date()

    for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(now.getDate() - i)
        const dateStr = d.toISOString().slice(0, 10)
        const label = d.toLocaleDateString('en-US', { weekday: 'short' })
        days.push({ label, date: dateStr, mins: 0 })
    }

    for (const game of games) {
        for (const session of game.sessions ?? []) {
            const sessionDate = session.start.slice(0, 10)
            const bar = days.find(b => b.date === sessionDate)
            if (bar) bar.mins += session.duration_mins
        }
    }

    return days
}

// Explicit Game[] type here too — same fix
function PlaytimeChart({ games }: { games: Game[] }) {
    const bars = buildWeekData(games)
    const maxMins = Math.max(...bars.map(b => b.mins), 1)
    const todayStr = new Date().toISOString().slice(0, 10)
    const totalThisWeek = bars.reduce((acc, b) => acc + b.mins, 0)

    return (
        <div className={styles.chartWrap}>
            <div className={styles.chartHeader}>
                <div className={styles.chartTitle}>
                    <BarChart2 size={14} />
                    <span>7-DAY ACTIVITY</span>
                </div>
                <span className={styles.chartTotal}>
                    {formatPlaytime(totalThisWeek)} this week
                </span>
            </div>

            <div className={styles.chartBars}>
                {bars.map((bar, i) => {
                    const pct = (bar.mins / maxMins) * 100
                    const isToday = bar.date === todayStr
                    const isEmpty = bar.mins === 0

                    return (
                        <div key={bar.date} className={styles.barCol}>
                            <div className={styles.barTooltip}>
                                <div className={styles.barTrack}>
                                    <motion.div
                                        className={styles.barFill}
                                        style={{
                                            background: isToday
                                                ? 'var(--accent)'
                                                : isEmpty
                                                    ? 'rgba(255,255,255,0.06)'
                                                    : 'rgba(255,217,59,0.45)',
                                            boxShadow:
                                                isToday && bar.mins > 0
                                                    ? '0 0 10px var(--accent-glow)'
                                                    : 'none',
                                        }}
                                        initial={{ height: '0%' }}
                                        animate={{ height: isEmpty ? '4px' : `${Math.max(pct, 4)}%` }}
                                        transition={{
                                            delay: i * 0.06,
                                            duration: 0.6,
                                            ease: [0.16, 1, 0.3, 1],
                                        }}
                                    />
                                </div>
                            </div>
                            <span
                                className={styles.barLabel}
                                style={{
                                    color: isToday ? 'var(--accent)' : 'var(--text-muted)',
                                    fontWeight: isToday ? 700 : 400,
                                }}
                            >
                                {bar.label}
                            </span>
                            {bar.mins > 0 && (
                                <span className={styles.barMins}>{formatPlaytime(bar.mins)}</span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfilePage() {
    const { user, updateUser, games, selectGame, setRoute } = useStore()

    const [isEditingName, setIsEditingName] = useState(false)
    const [tempName, setTempName] = useState(user.username)

    // Sync fresh value when editing starts — fixes stale username bug
    const startEditing = () => {
        setTempName(user.username)
        setIsEditingName(true)
    }

    const handleSaveName = () => {
        if (tempName.trim()) updateUser({ username: tempName.trim() })
        setIsEditingName(false)
    }

    // Aggregated stats
    const totalPlaytime = games.reduce((acc, g) => acc + (g.playtime || 0), 0)
    const totalAchievements = games.reduce(
        (acc, g) => acc + g.achievements.filter(a => a.unlocked).length,
        0,
    )
    const totalAvailableAchievements = games.reduce(
        (acc, g) => acc + g.achievements.length,
        0,
    )
    const mostPlayedGame = [...games].sort(
        (a, b) => (b.playtime || 0) - (a.playtime || 0),
    )[0]
    const longestSessionGame = [...games].sort(
        (a, b) => (b.lastSessionMins || 0) - (a.lastSessionMins || 0),
    )[0]
    const recentGames = [...games]
        .filter(g => g.lastPlayed)
        .sort(
            (a, b) =>
                new Date(b.lastPlayed!).getTime() - new Date(a.lastPlayed!).getTime(),
        )
        .slice(0, 4)

    const rank = calculateRank(totalPlaytime, totalAchievements)

    return (
        <div className={styles.root}>
            <motion.div
                variants={containerVars}
                initial="hidden"
                animate="show"
                className={styles.container}
            >
                {/* ── ID Card ──────────────────────────────────────────── */}
                <motion.div variants={itemVars} className={styles.idCard}>
                    <div
                        className={styles.banner}
                        style={{
                            background: `linear-gradient(135deg, ${user.avatarColor}40 0%, transparent 100%)`,
                        }}
                    />

                    <div className={styles.idContent}>
                        {/* Avatar */}
                        <div className={styles.avatarWrap}>
                            <div
                                className={styles.avatar}
                                style={{
                                    background: user.avatarColor,
                                    boxShadow: `0 0 40px ${user.avatarColor}40`,
                                }}
                            >
                                {user.username.charAt(0).toUpperCase()}
                            </div>
                            <input
                                type="color"
                                className={styles.colorPicker}
                                value={user.avatarColor}
                                onChange={e => updateUser({ avatarColor: e.target.value })}
                                title="Change ID Color"
                            />
                        </div>

                        {/* User info */}
                        <div className={styles.userInfo}>
                            <div className={styles.nameRow}>
                                {isEditingName ? (
                                    <input
                                        autoFocus
                                        value={tempName}
                                        onChange={e => setTempName(e.target.value)}
                                        onBlur={handleSaveName}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                        className={styles.nameInput}
                                    />
                                ) : (
                                    <h1 className={styles.username}>{user.username}</h1>
                                )}
                                <button className={styles.editBtn} onClick={startEditing}>
                                    <Edit3 size={14} />
                                </button>
                            </div>

                            <div className={styles.userId}>ID: {user.id}</div>

                            <div className={styles.metaRow}>
                                <span className={styles.joinedDate}>
                                    Joined{' '}
                                    {new Date(user.joinedAt).toLocaleDateString('en-US', {
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                </span>
                            </div>

                            <button
                                className={`${styles.privacyToggle} ${user.isPublic ? styles.public : styles.private
                                    }`}
                                onClick={() => updateUser({ isPublic: !user.isPublic })}
                                title="Prepare profile for future network sync"
                            >
                                {user.isPublic ? <Globe size={12} /> : <Lock size={12} />}
                                <span>
                                    {user.isPublic ? 'PUBLIC SYNC ENABLED' : 'LOCAL ONLY'}
                                </span>
                            </button>
                        </div>

                        {/* Rank badge with glow ring */}
                        <div className={styles.rankBadge}>
                            <div
                                className={styles.rankIconWrap}
                                style={{ '--rank-color': rank.color } as React.CSSProperties}
                            >
                                <div
                                    className={styles.rankGlowRing}
                                    style={{ background: rank.color }}
                                />
                                <Shield size={28} color={rank.color} />
                            </div>
                            <div className={styles.rankInfo}>
                                <div
                                    className={styles.rankTitle}
                                    style={{ color: rank.color }}
                                >
                                    {rank.title}
                                </div>
                                <div className={styles.rankScore}>{rank.score} SR</div>
                            </div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className={styles.progressTrack}>
                        <motion.div
                            className={styles.progressFill}
                            style={{
                                background: rank.color,
                                boxShadow: `0 0 10px ${rank.color}`,
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${rank.progress}%` }}
                            transition={{ delay: 0.4, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        />
                        <div className={styles.progressLabel}>
                            <span>Next Rank: {rank.nextTitle}</span>
                            <span>{Math.floor(rank.progress)}%</span>
                        </div>
                    </div>
                </motion.div>

                {/* ── Stats 2×2 ────────────────────────────────────────── */}
                <div className={styles.grid}>
                    <motion.div variants={itemVars} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ color: '#4a9eff', background: '#4a9eff15' }}>
                            <Clock size={24} />
                        </div>
                        <div className={styles.statData}>
                            <div className={styles.statValue}>{formatPlaytime(totalPlaytime)}</div>
                            <div className={styles.statLabel}>Total Time Engaged</div>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVars} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ color: '#ffd93b', background: '#ffd93b15' }}>
                            <Trophy size={24} />
                        </div>
                        <div className={styles.statData}>
                            <div className={styles.statValue}>
                                {totalAchievements}{' '}
                                <span className={styles.statSub}>/ {totalAvailableAchievements}</span>
                            </div>
                            <div className={styles.statLabel}>Objectives Secured</div>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVars} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ color: '#ff5577', background: '#ff557715' }}>
                            <Flame size={24} />
                        </div>
                        <div className={styles.statData}>
                            <div className={styles.statValue}>
                                {mostPlayedGame?.playtime
                                    ? formatPlaytime(mostPlayedGame.playtime)
                                    : '0m'}
                            </div>
                            <div className={styles.statLabel}>
                                Most Played ({mostPlayedGame?.title || 'None'})
                            </div>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVars} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ color: '#3ddc84', background: '#3ddc8415' }}>
                            <Target size={24} />
                        </div>
                        <div className={styles.statData}>
                            <div className={styles.statValue}>
                                {longestSessionGame?.lastSessionMins
                                    ? formatPlaytime(longestSessionGame.lastSessionMins)
                                    : '0m'}
                            </div>
                            <div className={styles.statLabel}>
                                Peak Session ({longestSessionGame?.title || 'None'})
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* ── 7-day chart ──────────────────────────────────────── */}
                <motion.div variants={itemVars}>
                    <PlaytimeChart games={games} />
                </motion.div>

                {/* ── Recent operations ────────────────────────────────── */}
                <motion.div variants={itemVars} className={styles.section}>
                    <h2 className={styles.sectionTitle}>Recent Field Operations</h2>

                    {recentGames.length > 0 ? (
                        <div className={styles.feedList}>
                            {recentGames.map(game => {
                                const unlockedCount = game.achievements.filter(a => a.unlocked).length
                                const totalCount = game.achievements.length

                                return (
                                    <motion.div
                                        key={game.id}
                                        className={styles.feedItem}
                                        onClick={() => selectGame(game.id)}
                                        whileHover={{ x: 6 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                    >
                                        <div className={styles.feedImgWrap}>
                                            {game.wallpaperImage ? (
                                                <img
                                                    src={game.wallpaperImage}
                                                    alt=""
                                                    className={styles.feedImg}
                                                    draggable={false}
                                                />
                                            ) : (
                                                <div
                                                    className={styles.feedImgFallback}
                                                    style={{
                                                        background: `linear-gradient(135deg, ${game.thumbnailColor}, ${game.accentColor}40)`,
                                                    }}
                                                />
                                            )}
                                            <div
                                                className={styles.feedImgAccent}
                                                style={{ background: game.accentColor }}
                                            />
                                        </div>

                                        <div className={styles.feedInfo}>
                                            <div className={styles.feedGame}>{game.title}</div>
                                            <div className={styles.feedMeta}>
                                                {(game.lastSessionMins ?? 0) > 0 && (
                                                    <span className={styles.feedMetaItem}>
                                                        <Clock size={11} />
                                                        {formatPlaytime(game.lastSessionMins!)} last session
                                                    </span>
                                                )}
                                                {(game.lastSessionMins ?? 0) > 0 && (
                                                    <span className={styles.feedMetaDot} />
                                                )}
                                                <span className={styles.feedMetaItem}>
                                                    {timeAgo(game.lastPlayed)}
                                                </span>
                                                {totalCount > 0 && (
                                                    <>
                                                        <span className={styles.feedMetaDot} />
                                                        <span className={styles.feedMetaItem}>
                                                            <Trophy size={11} />
                                                            {unlockedCount}/{totalCount}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className={styles.feedAction}>
                                            <Play size={14} fill="currentColor" />
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className={styles.emptyFeed}>
                            <Clock size={24} style={{ opacity: 0.2, marginBottom: 8 }} />
                            <p>No operations logged yet. Launch a game to start tracking.</p>
                            <button
                                className={styles.emptyFeedAction}
                                onClick={() => setRoute('library')}
                            >
                                Go to Library
                            </button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </div>
    )
}