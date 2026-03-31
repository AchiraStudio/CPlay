import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FolderOpen, Cpu, CheckCircle, AlertCircle, Search, Trash2, Zap, Palette, Image as ImageIcon, Trophy } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useStore, type Game } from '../store/useStore'
import styles from './AddGameModal.module.css'

type ScanResult = {
  emulator: string
  app_id?: string
  save_folder?: string
  achievements_json?: string
  achievements_ini?: string
  achievements_xml?: string
  best_exe?: string
  debug_log?: string[]
}

const ACCENT_PRESETS = ['#4a9eff', '#ff5577', '#ffb74d', '#3ddc84', '#c8a84b', '#ff7b72', '#a78bfa', '#34d399']
const BG_PRESETS = [
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1920&q=80',
  'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1920&q=80',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&q=80',
  'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=1920&q=80',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1920&q=80',
]
const EMULATOR_COLORS: Record<string, string> = { codex: '#ff7b72', goldberg: '#3ddc84', anadius: '#a78bfa', unknown: '#8a8aa0' }

interface Props { editGame?: Game }

export default function AddGameModal({ editGame }: Props) {
  const { setAddingGame, addGame, updateGame, removeGame, selectGame, setEditingGame } = useStore()
  const isEdit = !!editGame

  const [title, setTitle] = useState(editGame?.title ?? '')
  const [exePath, setExePath] = useState(editGame?.exePath ?? '')
  const [wallpaper, setWallpaper] = useState(editGame?.wallpaperImage ?? BG_PRESETS[0])
  const [accentColor, setAccentColor] = useState(editGame?.accentColor ?? ACCENT_PRESETS[0])
  const [genre, setGenre] = useState(editGame?.genre ?? '')
  const [developer, setDeveloper] = useState(editGame?.developer ?? '')

  const [manualAppId, setManualAppId] = useState(editGame?.appId ?? '')
  const [manualSaveFolder, setManualSaveFolder] = useState(editGame?.saveFolder ?? '')
  const [manualAchJson, setManualAchJson] = useState(editGame?.achievementsJson ?? '')
  const [manualAchIni, setManualAchIni] = useState(editGame?.achievementsIni ?? '')
  const [manualAchXml, setManualAchXml] = useState(editGame?.achievementsXml ?? '')
  const [showOverrides, setShowOverrides] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const canSave = title.trim() !== '' && exePath.trim() !== '' && !scanning

  async function runScan(path: string) {
    if (!path) return
    const dir = path.replace(/[/\\][^/\\]+$/, '')
    setScanning(true)
    setScanResult(null)
    setScanError(null)

    try {
      const result = await invoke<ScanResult>('scan_game', { path: dir })
      setScanResult(result)
      if (!manualAppId && result.app_id) setManualAppId(result.app_id)
      if (!manualSaveFolder && result.save_folder) setManualSaveFolder(result.save_folder)
      if (!manualAchJson && result.achievements_json) setManualAchJson(result.achievements_json)
      if (!manualAchIni && result.achievements_ini) setManualAchIni(result.achievements_ini)
      if (!manualAchXml && result.achievements_xml) setManualAchXml(result.achievements_xml)
    } catch (e) {
      setScanError(String(e))
    } finally {
      setScanning(false)
    }
  }

  const handleBrowse = async () => {
    try {
      const picked = await open({ multiple: false, directory: false, filters: [{ name: 'Executable', extensions: ['exe'] }] })
      if (picked && typeof picked === 'string') {
        setExePath(picked)
        if (!title) {
          const name = picked.split(/[/\\]/).slice(-2, -1)[0] || ''
          if (name) setTitle(name)
        }
        runScan(picked)
      }
    } catch (e) { console.error(e) }
  }

  const handlePickFolder = async (setter: (val: string) => void) => {
    try {
      const picked = await open({ multiple: false, directory: true })
      if (picked && typeof picked === 'string') setter(picked)
    } catch (e) { console.error(e) }
  }

  const handlePickFile = async (setter: (val: string) => void, ext: string, label: string) => {
    try {
      const picked = await open({ multiple: false, directory: false, filters: [{ name: label, extensions: [ext] }] })
      if (picked && typeof picked === 'string') setter(picked)
    } catch (e) { console.error(e) }
  }

  const handleSave = () => {
    if (!canSave) return
    const emulator = (scanResult?.emulator ?? editGame?.emulator ?? 'unknown') as Game['emulator']

    const payload: Partial<Game> = {
      title, exePath, wallpaperImage: wallpaper, accentColor,
      genre: genre || undefined, developer: developer || undefined, emulator,
      appId: manualAppId || scanResult?.app_id || undefined,
      saveFolder: manualSaveFolder || scanResult?.save_folder || undefined,
      achievementsJson: manualAchJson || scanResult?.achievements_json || undefined,
      achievementsIni: manualAchIni || scanResult?.achievements_ini || undefined,
      achievementsXml: manualAchXml || scanResult?.achievements_xml || undefined,
    }

    if (isEdit && editGame) {
      updateGame(editGame.id, payload)
    } else {
      const id = `game-${Date.now()}`
      addGame({ ...payload, id, playtime: 0, achievements: [], thumbnailColor: '#0a0a0f' } as Game)
      selectGame(id)
    }
    handleClose()
  }

  const handleClose = () => { setAddingGame(false); setEditingGame(null) }

  return (
    <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose}>
      <motion.div
        className={styles.modal}
        initial={{ y: 30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{ '--local-accent': accentColor } as any}
      >
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Zap size={16} style={{ color: accentColor }} />
            <span>{isEdit ? 'Operational Refinement' : 'Integrate New Sector'}</span>
          </div>
          <div className={styles.headerActions}>
            {isEdit && (
              <button className={styles.deleteBtn} onClick={() => setShowConfirmDelete(true)}><Trash2 size={16} /></button>
            )}
            <button className={styles.closeBtn} onClick={handleClose}><X size={20} /></button>
          </div>
        </div>

        <AnimatePresence>
          {showConfirmDelete && (
            <motion.div className={styles.confirmBar} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <span>Permanently remove <strong>{title}</strong>?</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.confirmYes} onClick={() => { removeGame(editGame!.id); handleClose(); }}>Remove</button>
                <button className={styles.confirmNo} onClick={() => setShowConfirmDelete(false)}>Cancel</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={styles.body}>
          <div className={styles.form}>
            <section className={styles.section}>
              <label className={styles.label}>Identity</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Game Name" className={styles.mainInput} />
              <div className={styles.row}>
                <div style={{ flex: 1 }}><label className={styles.label}>Role</label><input value={genre} onChange={e => setGenre(e.target.value)} placeholder="Genre (RPG, etc.)" /></div>
                <div style={{ flex: 1 }}><label className={styles.label}>Origin</label><input value={developer} onChange={e => setDeveloper(e.target.value)} placeholder="Developer" /></div>
              </div>
            </section>

            <section className={styles.section}>
              <label className={styles.label}>Bridge Point (EXE)</label>
              <div className={styles.pathRow}>
                <input value={exePath} onChange={e => setExePath(e.target.value)} placeholder="Path to executable" />
                <button className={styles.browseBtn} onClick={handleBrowse}><FolderOpen size={16} /></button>
              </div>
            </section>

            <section className={styles.scanBox}>
              <div className={styles.scanHeader}>
                <div className={styles.scanTitle}><Cpu size={14} /> <span>CORE ANALYSIS</span></div>
                <button className={styles.scanBtn} onClick={() => runScan(exePath)} disabled={!exePath || scanning}>
                  {scanning ? <div className={styles.spinner} /> : <Search size={13} />}
                  <span>{scanning ? 'Analyzing...' : 'Scan Core'}</span>
                </button>
              </div>

              {scanError && (
                <motion.div className={styles.scanError} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <AlertCircle size={12} /><span>{scanError}</span>
                </motion.div>
              )}

              {scanResult && (
                <motion.div className={styles.scanResult} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className={styles.scanRow}>
                    <CheckCircle size={12} color={EMULATOR_COLORS[scanResult.emulator] || '#fff'} />
                    <span className={styles.scanKey}>Emulator</span>
                    <span style={{ color: EMULATOR_COLORS[scanResult.emulator], fontWeight: 700 }}>{scanResult.emulator.toUpperCase()}</span>
                  </div>
                  {scanResult.app_id && (
                    <div className={styles.scanRow}><CheckCircle size={12} color="#3ddc84" /><span className={styles.scanKey}>Target ID</span><span className={styles.scanVal}>{scanResult.app_id}</span></div>
                  )}
                  {scanResult.save_folder && (
                    <div className={styles.scanBlock}><div className={styles.scanBlockLabel}><CheckCircle size={12} color="#3ddc84" /> <span>Sync Point</span></div><div className={styles.scanPath}>{scanResult.save_folder}</div></div>
                  )}
                  {scanResult.achievements_ini && (
                    <div className={styles.scanBlock}><div className={styles.scanBlockLabel}><Trophy size={11} color="#ffd700" /> <span>Achievement Map (INI)</span></div><div className={styles.scanPath}>{scanResult.achievements_ini}</div></div>
                  )}
                  {scanResult.achievements_json && (
                    <div className={styles.scanBlock}><div className={styles.scanBlockLabel}><Trophy size={11} color="#3ddc84" /> <span>Achievement Data (JSON)</span></div><div className={styles.scanPath}>{scanResult.achievements_json}</div></div>
                  )}
                  {scanResult.achievements_xml && (
                    <div className={styles.scanBlock}><div className={styles.scanBlockLabel}><Trophy size={11} color="#a78bfa" /> <span>Achievement Registry (XML)</span></div><div className={styles.scanPath}>{scanResult.achievements_xml}</div></div>
                  )}

                  {scanResult.debug_log && scanResult.debug_log.length > 0 && (
                    <div className={styles.debugSection}>
                      <button className={styles.debugToggle} onClick={() => setShowDebug(!showDebug)}>
                        <span>{showDebug ? 'Hide Analysis Log' : 'View Analysis Log'}</span><Search size={10} />
                      </button>
                      <AnimatePresence>
                        {showDebug && (
                          <motion.div className={styles.debugContent} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                            {scanResult.debug_log.map((log, i) => (<div key={i} className={styles.debugLine}><span className={styles.debugBullet}>›</span> {log}</div>))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {!scanResult.achievements_json && !scanResult.achievements_ini && !scanResult.achievements_xml && (
                    <div className={styles.scanError} style={{ marginTop: 12, background: 'rgba(255, 183, 77, 0.1)', borderColor: 'rgba(255, 183, 77, 0.2)', color: '#ffb74d' }}>
                      <AlertCircle size={12} /><span>No achievement data detected. Check <strong>Analysis Log</strong> above or pick files manually in <strong>Parameters</strong>.</span>
                    </div>
                  )}
                </motion.div>
              )}
            </section>

            <section className={styles.overrides}>
              <button className={styles.overrideToggle} onClick={() => setShowOverrides(!showOverrides)}>
                <span>Manual Parameters</span>{showOverrides ? <X size={12} /> : <Search size={12} />}
              </button>
              <AnimatePresence>
                {showOverrides && (
                  <motion.div className={styles.overrideContent} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <div className={styles.field}><label className={styles.label}>App ID</label><input value={manualAppId} onChange={e => setManualAppId(e.target.value)} placeholder="Steam AppID" /></div>
                    <div className={styles.field}><label className={styles.label}>Save Folder</label><div className={styles.pathRow}><input value={manualSaveFolder} onChange={e => setManualSaveFolder(e.target.value)} placeholder="Path to save/stats folder" /><button className={styles.browseBtn} onClick={() => handlePickFolder(setManualSaveFolder)}><FolderOpen size={14} /></button></div></div>
                    <div className={styles.field}><label className={styles.label}>achievements.json</label><div className={styles.pathRow}><input value={manualAchJson} onChange={e => setManualAchJson(e.target.value)} placeholder="Path to JSON achievement list" /><button className={styles.browseBtn} onClick={() => handlePickFile(setManualAchJson, 'json', 'JSON File')}><FolderOpen size={14} /></button></div></div>
                    <div className={styles.field}><label className={styles.label}>achievements.ini</label><div className={styles.pathRow}><input value={manualAchIni} onChange={e => setManualAchIni(e.target.value)} placeholder="Path to INI achievement list" /><button className={styles.browseBtn} onClick={() => handlePickFile(setManualAchIni, 'ini', 'INI File')}><FolderOpen size={14} /></button></div></div>
                    <div className={styles.field}><label className={styles.label}>achievements.xml</label><div className={styles.pathRow}><input value={manualAchXml} onChange={e => setManualAchXml(e.target.value)} placeholder="Path to XML achievement list" /><button className={styles.browseBtn} onClick={() => handlePickFile(setManualAchXml, 'xml', 'XML File')}><FolderOpen size={14} /></button></div></div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>

          <aside className={styles.customize}>
            <div className={styles.preview} style={{ backgroundImage: `url(${wallpaper})` }}>
              <div className={styles.previewContent}><div className={styles.previewTitle} style={{ color: accentColor }}>{title || 'Unknown Project'}</div></div>
            </div>

            <div className={styles.section}>
              <label className={styles.label}><ImageIcon size={12} /> Atmosphere</label>
              <div className={styles.bgGrid}>
                {BG_PRESETS.map(bg => (
                  <button key={bg} className={`${styles.bgThumb} ${wallpaper === bg ? styles.bgThumbActive : ''}`} onClick={() => setWallpaper(bg)} style={{ backgroundImage: `url(${bg})` }} />
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <label className={styles.label}><Palette size={12} /> Accent Token</label>
              <div className={styles.colorRow}>
                {ACCENT_PRESETS.map(c => (
                  <button key={c} className={`${styles.colorDot} ${accentColor === c ? styles.colorDotActive : ''}`} style={{ background: c }} onClick={() => setAccentColor(c)} />
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={handleClose}>Abort</button>
          <button className={styles.addBtn} onClick={handleSave} disabled={!canSave} style={{ background: accentColor, boxShadow: `0 8px 32px ${accentColor}40` }}>
            {isEdit ? 'Update Integration' : 'Initialize Integration'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}