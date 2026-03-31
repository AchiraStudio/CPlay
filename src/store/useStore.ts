import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Achievement {
  id: string
  name: string
  description: string
  icon?: string
  iconGray?: string
  unlocked: boolean
  unlockedAt?: string
  hidden?: boolean
}

export interface Game {
  id: string
  title: string
  exePath: string
  coverImage?: string
  heroImage?: string
  wallpaperImage?: string
  thumbnailColor: string
  accentColor: string
  genre?: string
  developer?: string
  lastPlayed?: string
  playtime: number
  lastSessionMins?: number
  sessionCount?: number
  appId?: string
  emulator?: 'codex' | 'goldberg' | 'anadius' | 'unknown'
  achievements: Achievement[]
  saveFolder?: string
  achievementsJson?: string
  achievementsIni?: string
  achievementsXml?: string
  lastScanned?: number
  isRunning?: boolean
  isFavorite?: boolean
  notes?: string // NEW: Journal notes
  sessions?: { start: string; duration_mins: number }[] // NEW: History
}

export interface UserProfile {
  id: string;
  username: string;
  avatarColor: string;
  isPublic: boolean;
  joinedAt: string;
}

interface LauncherState {
  user: UserProfile
  updateUser: (data: Partial<UserProfile>) => void

  games: Game[]
  selectedGameId: string | null
  isAddingGame: boolean
  overlayVisible: boolean
  overlayGameId: string | null
  recentAchievement: Achievement | null
  sidebarCollapsed: boolean

  currentRoute: 'home' | 'library' | 'profile' | 'favorites' | 'settings' // UPDATED

  runStates: Record<string, 'idle' | 'launching' | 'running'>
  addGame: (game: Game) => void
  updateGame: (id: string, updates: Partial<Game>) => void
  removeGame: (id: string) => void
  selectGame: (id: string | null) => void

  setRoute: (route: 'home' | 'library' | 'profile' | 'favorites' | 'settings') => void // UPDATED

  setAddingGame: (val: boolean) => void
  showOverlay: (gameId: string) => void
  hideOverlay: () => void
  triggerAchievement: (ach: Achievement) => void
  clearAchievement: () => void
  toggleSidebar: () => void
  toggleFavorite: (id: string) => void
  unlockAchievement: (gameId: string, achId: string) => void
  editingGame: Game | null
  setEditingGame: (game: Game | null) => void
  setRunState: (gameId: string, state: 'idle' | 'launching' | 'running') => void
}

const generateUUID = () => {
  return 'user-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const useStore = create<LauncherState>()(
  persist(
    (set) => ({
      user: {
        id: generateUUID(),
        username: 'Operative',
        avatarColor: '#ffd93b',
        isPublic: false,
        joinedAt: new Date().toISOString(),
      },
      updateUser: (data) => set((s) => ({ user: { ...s.user, ...data } })),

      games: [],
      selectedGameId: null,
      isAddingGame: false,
      overlayVisible: false,
      overlayGameId: null,
      recentAchievement: null,
      sidebarCollapsed: false,
      currentRoute: 'home',
      runStates: {},
      editingGame: null,

      addGame: (game) => set((s) => {
        if (s.games.some((g) => g.id === game.id)) return s
        return { games: [...s.games, game] }
      }),
      updateGame: (id, updates) =>
        set((s) => ({
          games: s.games.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        })),
      removeGame: (id) =>
        set((s) => ({
          games: s.games.filter((g) => g.id !== id),
          selectedGameId: s.selectedGameId === id ? null : s.selectedGameId,
        })),
      selectGame: (id) => set({ selectedGameId: id, currentRoute: 'library' }),
      setRoute: (route) => set({ currentRoute: route }),
      setAddingGame: (val) => set({ isAddingGame: val }),
      showOverlay: (gameId) => set({ overlayVisible: true, overlayGameId: gameId }),
      hideOverlay: () => set({ overlayVisible: false, overlayGameId: null }),
      triggerAchievement: (ach) => set({ recentAchievement: ach }),
      clearAchievement: () => set({ recentAchievement: null }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleFavorite: (id) =>
        set((s) => ({
          games: s.games.map((g) =>
            g.id === id ? { ...g, isFavorite: !g.isFavorite } : g
          ),
        })),
      unlockAchievement: (gameId, achId) =>
        set((s) => ({
          games: s.games.map((g) =>
            g.id === gameId
              ? {
                ...g,
                achievements: g.achievements.map((a) =>
                  a.id === achId
                    ? { ...a, unlocked: true, unlockedAt: new Date().toISOString() }
                    : a
                ),
              }
              : g
          ),
        })),
      setRunState: (gameId, state) =>
        set((s) => ({
          runStates: { ...s.runStates, [gameId]: state },
        })),
      setEditingGame: (game) => set({ editingGame: game }),
    }),
    {
      name: 'vault-launcher-store',
      version: 3, // Bumped version for schema update
      migrate: (persistedState: any, version: number) => {
        if (version < 3) {
          return { ...persistedState, games: [], selectedGameId: null }
        }
        return persistedState
      },
      partialize: (s) => ({
        user: s.user,
        games: s.games,
        selectedGameId: s.selectedGameId,
        sidebarCollapsed: s.sidebarCollapsed,
        currentRoute: s.currentRoute,
      }),
      merge: (persisted: unknown, current: LauncherState): LauncherState => {
        const p = persisted as Partial<LauncherState>
        const seen = new Set<string>()
        const deduped = (p.games ?? []).filter((g) => {
          if (seen.has(g.id)) return false
          seen.add(g.id)
          return true
        })
        return { ...current, ...p, games: deduped }
      },
    }
  )
)