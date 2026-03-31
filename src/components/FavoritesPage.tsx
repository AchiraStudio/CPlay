import { motion, Variants } from 'framer-motion'
import { Heart, HeartCrack, Play, Clock, Trophy, Library } from 'lucide-react'
import { useStore } from '../store/useStore'
import styles from './FavoritesPage.module.css'

const containerVars: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.07, delayChildren: 0.05 },
    },
}

const cardVars: Variants = {
    hidden: { opacity: 0, y: 24, scale: 0.97 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: 'spring', stiffness: 280, damping: 24 },
    },
}

function formatPlaytime(mins: number) {
    if (!mins) return '0m'
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function FavoritesPage() {
    const { games, selectGame, runStates, setRoute } = useStore()
    const favorites = games.filter(g => g.isFavorite)

    return (
        <div className={styles.root}>
            {/* Page header */}
            <motion.div
                className={styles.pageHeader}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className={styles.pageTitleRow}>
                    <Heart size={20} color="var(--accent)" fill="var(--accent)" />
                    <h1 className={styles.pageTitle}>Pinned Operations</h1>
                    {favorites.length > 0 && (
                        <span className={styles.pageCount}>{favorites.length}</span>
                    )}
                </div>
                <p className={styles.pageSubtitle}>
                    Your curated collection of highlighted missions.
                </p>
            </motion.div>

            {/* Empty state */}
            {favorites.length === 0 ? (
                <motion.div
                    className={styles.empty}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                >
                    <div className={styles.emptyIcon}>
                        <HeartCrack size={40} />
                    </div>
                    <h2 className={styles.emptyTitle}>No pinned operations</h2>
                    <p className={styles.emptyDesc}>
                        Open your library and press the heart icon on any game to pin it here.
                    </p>
                    <button
                        className={styles.emptyAction}
                        onClick={() => setRoute('library')}
                    >
                        <Library size={16} />
                        <span>Go to Library</span>
                    </button>
                </motion.div>
            ) : (
                <motion.div
                    className={styles.grid}
                    variants={containerVars}
                    initial="hidden"
                    animate="show"
                >
                    {favorites.map(game => {
                        const unlocked = game.achievements.filter(a => a.unlocked).length
                        const total = game.achievements.length
                        const progress = total > 0 ? (unlocked / total) * 100 : 0
                        const isPlaying =
                            runStates[game.id] === 'launching' ||
                            runStates[game.id] === 'running'

                        return (
                            <motion.div
                                key={game.id}
                                variants={cardVars}
                                className={styles.card}
                                onClick={() => selectGame(game.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => e.key === 'Enter' && selectGame(game.id)}
                            >
                                {/* Wallpaper background */}
                                <div className={styles.cardBg}>
                                    {game.wallpaperImage ? (
                                        <img
                                            src={game.wallpaperImage}
                                            alt=""
                                            className={styles.cardImg}
                                            draggable={false}
                                        />
                                    ) : (
                                        <div
                                            className={styles.cardImgFallback}
                                            style={{
                                                background: `linear-gradient(135deg, ${game.thumbnailColor}, ${game.accentColor}40)`,
                                            }}
                                        />
                                    )}
                                    {/* Dark gradient so text is always readable */}
                                    <div
                                        className={styles.cardOverlay}
                                        style={{
                                            background: `linear-gradient(100deg,
                        rgba(8,10,16,0.95) 0%,
                        rgba(8,10,16,0.75) 40%,
                        rgba(8,10,16,0.20) 70%,
                        rgba(8,10,16,0.05) 100%)`,
                                        }}
                                    />
                                    {/* Subtle accent tint */}
                                    <div
                                        className={styles.cardTint}
                                        style={{
                                            background: `linear-gradient(135deg, ${game.thumbnailColor}30 0%, transparent 60%)`,
                                        }}
                                    />
                                </div>

                                {/* Card content */}
                                <div className={styles.cardContent}>
                                    {/* Left: text */}
                                    <div className={styles.cardLeft}>
                                        <div className={styles.badgeRow}>
                                            {game.genre && (
                                                <span className={styles.badge}>{game.genre}</span>
                                            )}
                                            {isPlaying && (
                                                <span className={styles.playingBadge}>● PLAYING</span>
                                            )}
                                        </div>

                                        <h2 className={styles.cardTitle}>{game.title}</h2>

                                        {game.developer && (
                                            <p className={styles.cardDev}>{game.developer}</p>
                                        )}

                                        <div className={styles.statsRow}>
                                            <span className={styles.stat}>
                                                <Clock size={13} />
                                                {formatPlaytime(game.playtime)}
                                            </span>
                                            {total > 0 && (
                                                <>
                                                    <span className={styles.statDot} />
                                                    <span className={styles.stat}>
                                                        <Trophy size={13} />
                                                        {unlocked} / {total}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {total > 0 && (
                                            <div className={styles.progressWrap}>
                                                <div className={styles.progressTrack}>
                                                    <motion.div
                                                        className={styles.progressFill}
                                                        style={{ background: game.accentColor }}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${progress}%` }}
                                                        transition={{
                                                            delay: 0.3,
                                                            duration: 0.8,
                                                            ease: [0.16, 1, 0.3, 1],
                                                        }}
                                                    />
                                                </div>
                                                <span className={styles.progressPct}>
                                                    {Math.round(progress)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: play button */}
                                    <div className={styles.cardRight}>
                                        <motion.div
                                            className={styles.playBtn}
                                            style={{
                                                background: isPlaying ? '#3ddc84' : game.accentColor,
                                                boxShadow: `0 8px 32px ${isPlaying ? '#3ddc8440' : game.accentColor + '40'
                                                    }`,
                                            }}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.92 }}
                                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                        >
                                            <Play
                                                size={22}
                                                fill="#000"
                                                color="#000"
                                                style={{ marginLeft: 3 }}
                                            />
                                        </motion.div>
                                        <span className={styles.playHint}>
                                            {isPlaying ? 'Running' : 'Open'}
                                        </span>
                                    </div>
                                </div>

                                {/* Bottom accent line */}
                                <div
                                    className={styles.cardAccentLine}
                                    style={{ background: game.accentColor }}
                                />
                            </motion.div>
                        )
                    })}
                </motion.div>
            )}
        </div>
    )
}