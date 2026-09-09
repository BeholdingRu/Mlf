import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MediaPlayer, MediaProvider, SeekButton, VolumeSlider } from '@vidstack/react'
import type { MediaPlayerInstance } from '@vidstack/react'
import { DefaultAudioLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/base.css'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/audio.css'

type FileSystemFileHandleLike = {
  kind: 'file'
  getFile: () => Promise<File>
}

type FileSystemDirectoryHandleLike = {
  kind: 'directory'
  values: () => AsyncIterableIterator<FileSystemFileHandleLike | FileSystemDirectoryHandleLike>
  queryPermission: (descriptor?: { mode?: 'read' }) => Promise<PermissionState>
  requestPermission: (descriptor?: { mode?: 'read' }) => Promise<PermissionState>
}

type FileSystemWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike>
}

type Track = {
  id: string
  name: string
  file: File
}

type Playlist = {
  id: string
  name: string
  directory: FileSystemDirectoryHandleLike
}

type MediaSubTab = 'player' | 'playlists'
type RepeatMode = 'off' | 'playlist' | 'track'

const DIRECTORY_HANDLE_DB = 'mlf-media'
const PLAYLIST_STORE = 'playlists'
const PLAYER_WIDTH_STORAGE_KEY = 'mlf:media-player-width-ratio-v2'
const VIDSTACK_RUSSIAN_TRANSLATIONS = {
  Accessibility: 'Доступность',
  AirPlay: 'AirPlay',
  Audio: 'Аудио',
  Auto: 'Авто',
  Boost: 'Усиление',
  Captions: 'Субтитры',
  Chapters: 'Главы',
  Continue: 'Продолжить',
  Default: 'По умолчанию',
  Disabled: 'Отключено',
  Download: 'Скачать',
  'Enter Fullscreen': 'Во весь экран',
  'Exit Fullscreen': 'Выйти из полноэкранного режима',
  Fullscreen: 'Полный экран',
  LIVE: 'ПРЯМОЙ ЭФИР',
  Loop: 'Повтор',
  Mute: 'Выключить звук',
  Normal: 'Обычная',
  Off: 'Выкл.',
  Pause: 'Пауза',
  Play: 'Воспроизвести',
  Playback: 'Воспроизведение',
  Quality: 'Качество',
  Replay: 'Повторить',
  Reset: 'Сбросить',
  'Seek Backward': 'Назад',
  'Seek Forward': 'Вперёд',
  Seek: 'Перемотка',
  Settings: 'Настройки',
  Speed: 'Скорость',
  Unmute: 'Включить звук',
  Volume: 'Громкость',
} as const

function SeekIcon({ direction }: { direction: 'backward' | 'forward' }) {
  const arrowTransform = direction === 'forward' ? undefined : 'translate(24 0) scale(-1 1)'
  const label = direction === 'forward' ? '+10' : '−10'

  return (
    <svg className="vds-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
      <g transform={arrowTransform}>
        <path d="M19 8.5A8 8 0 1 0 20 15" />
        <path d="m19 4.5 1 4-4 1" />
      </g>
      <text x="12" y="15" fill="currentColor" stroke="none" textAnchor="middle" fontSize="6" fontWeight="500">{label}</text>
    </svg>
  )
}

function RepeatIcon({ mode }: { mode: RepeatMode }) {
  return (
    <svg className="vds-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8c1.4-2.2 4-3.5 6.7-3.5 2.8 0 5.1 1.3 6.5 3.5" />
      <path d="m16.5 4.5 2.7 3-3.9.4" />
      <path d="M18 16c-1.4 2.2-4 3.5-6.7 3.5-2.8 0-5.1-1.3-6.5-3.5" />
      <path d="m7.5 19.5-2.7-3 3.9-.4" />
      {mode === 'track' && <text x="12" y="15.25" fill="currentColor" stroke="none" textAnchor="middle" fontSize="7" fontWeight="700">1</text>}
      {mode === 'off' && <path d="M5 5 19 19" />}
    </svg>
  )
}

function StopIcon() {
  return (
    <svg className="vds-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" />
    </svg>
  )
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className="vds-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={collapsed ? 'm7 9 5 5 5-5' : 'm7 15 5-5 5 5'} />
    </svg>
  )
}

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DIRECTORY_HANDLE_DB, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PLAYLIST_STORE)) {
        request.result.createObjectStore(PLAYLIST_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getPlaylists() {
  const database = await openHandleDatabase()
  const playlists = await new Promise<Playlist[]>((resolve, reject) => {
    const request = database.transaction(PLAYLIST_STORE).objectStore(PLAYLIST_STORE).getAll()
    request.onsuccess = () => resolve(request.result as Playlist[])
    request.onerror = () => reject(request.error)
  })
  database.close()
  return playlists
}

async function savePlaylist(playlist: Playlist) {
  const database = await openHandleDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PLAYLIST_STORE, 'readwrite')
    transaction.objectStore(PLAYLIST_STORE).put(playlist)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

async function deletePlaylist(id: string) {
  const database = await openHandleDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PLAYLIST_STORE, 'readwrite')
    transaction.objectStore(PLAYLIST_STORE).delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

async function readAudioFiles(directory: FileSystemDirectoryHandleLike) {
  const files: File[] = []
  for await (const entry of directory.values()) {
    if (entry.kind !== 'file') continue
    const file = await entry.getFile()
    if (file.type.startsWith('audio/')) files.push(file)
  }
  return files
}

type MediaViewProps = {
  compact?: boolean
}

export function MediaView({ compact = false }: MediaViewProps) {
  const playerRef = useRef<MediaPlayerInstance>(null)
  const pendingPlaybackTrackIdRef = useRef<string | null>(null)
  const resizePointerIdRef = useRef<number | null>(null)
  const panelResizeStartRef = useRef<{ clientX: number; ratio: number; availableWidth: number } | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [overlayCollapsed, setOverlayCollapsed] = useState(false)
  const [overlayWidthRatio, setOverlayWidthRatio] = useState(() => {
    const savedRatio = Number(window.localStorage.getItem(PLAYER_WIDTH_STORAGE_KEY))
    return Number.isFinite(savedRatio) && savedRatio >= 0.5 && savedRatio <= 1 ? savedRatio : 0.5
  })
  const [volume, setVolume] = useState(1)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off')
  const [status, setStatus] = useState('Выберите аудиофайлы или папку с музыкой.')
  const [mediaInfoOpen, setMediaInfoOpen] = useState(false)
  const [subTab, setSubTab] = useState<MediaSubTab>(() => window.matchMedia('(max-width: 768px)').matches ? 'playlists' : 'player')
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [playlistFormOpen, setPlaylistFormOpen] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const [selectedPlaylistDirectory, setSelectedPlaylistDirectory] = useState<FileSystemDirectoryHandleLike | null>(null)
  const fileSystemSupported = typeof (window as FileSystemWindow).showDirectoryPicker === 'function'
  const playlistFoldersSupported = fileSystemSupported && window.isSecureContext

  useEffect(() => {
    if (!playlistFoldersSupported) return
    void getPlaylists().then(setPlaylists).catch(() => setStatus('Не удалось загрузить сохранённые плейлисты.'))
  }, [playlistFoldersSupported])

  useEffect(() => {
    window.localStorage.setItem(PLAYER_WIDTH_STORAGE_KEY, String(overlayWidthRatio))
  }, [overlayWidthRatio])

  const setFiles = (files: File[], autoPlay = false) => {
    const newTracks = files.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      file,
    }))
    setTracks(newTracks)
    setActiveTrackId(newTracks[0]?.id ?? null)
    setStatus(newTracks.length ? `Добавлено треков: ${newTracks.length}. Файлы остаются на вашем устройстве.` : 'Аудиофайлы не найдены.')
    pendingPlaybackTrackIdRef.current = autoPlay ? newTracks[0]?.id ?? null : null
  }

  const selectFiles = (event: React.ChangeEvent<HTMLInputElement>) => setFiles(Array.from(event.target.files ?? []), true)

  const selectDirectory = async () => {
    const picker = (window as FileSystemWindow).showDirectoryPicker
    if (!picker) return
    try {
      const handle = await picker()
      setFiles(await readAudioFiles(handle))
      setStatus('Папка подключена. Сохраните её как плейлист, чтобы использовать снова.')
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') setStatus('Не удалось открыть папку с музыкой.')
    }
  }

  const openPlaylist = async (playlist: Playlist) => {
    try {
      const permission = await playlist.directory.queryPermission({ mode: 'read' })
      const granted = permission === 'granted' || await playlist.directory.requestPermission({ mode: 'read' }) === 'granted'
      if (!granted) {
        setStatus('Доступ к папке не предоставлен.')
        return
      }
      setFiles(await readAudioFiles(playlist.directory))
      setStatus(`Открыт плейлист «${playlist.name}». Музыка не загружается на сайт.`)
      setSubTab('player')
    } catch {
      setStatus('Не удалось открыть плейлист. Возможно, папка недоступна — выберите её заново.')
    }
  }

  const choosePlaylistDirectory = async () => {
    const picker = (window as FileSystemWindow).showDirectoryPicker
    if (!picker) return
    try {
      setSelectedPlaylistDirectory(await picker())
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') setStatus('Не удалось выбрать папку с музыкой.')
    }
  }

  const createPlaylist = async () => {
    const name = playlistName.trim()
    if (!name || !selectedPlaylistDirectory) return
    try {
      const playlist: Playlist = { id: crypto.randomUUID(), name, directory: selectedPlaylistDirectory }
      await savePlaylist(playlist)
      setPlaylists((items) => [...items, playlist])
      setPlaylistName('')
      setSelectedPlaylistDirectory(null)
      setPlaylistFormOpen(false)
      setStatus(`Плейлист «${name}» сохранён на этом устройстве.`)
    } catch {
      setStatus('Не удалось сохранить плейлист в браузере.')
    }
  }

  const removePlaylist = async (playlist: Playlist) => {
    if (!window.confirm(`Удалить плейлист «${playlist.name}»?`)) return

    await deletePlaylist(playlist.id)
    setPlaylists((items) => items.filter((item) => item.id !== playlist.id))
  }

  const activeTrack = tracks.find((track) => track.id === activeTrackId)
  const playerTitle = activeTrack?.name ?? 'Локальная музыка'

  const playNextTrack = () => {
    const currentTrackIndex = tracks.findIndex((track) => track.id === activeTrackId)
    const nextTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex + 1] : undefined

    if (repeatMode === 'track' && activeTrackId) {
      playerRef.current!.currentTime = 0
      void playerRef.current?.play()
      return
    }

    const trackToPlay = nextTrack ?? (repeatMode === 'playlist' ? tracks[0] : undefined)
    if (!trackToPlay) {
      setIsPlaying(false)
      return
    }

    pendingPlaybackTrackIdRef.current = trackToPlay.id
    setActiveTrackId(trackToPlay.id)
  }

  const startPendingTrack = () => {
    if (!activeTrackId || pendingPlaybackTrackIdRef.current !== activeTrackId) return
    pendingPlaybackTrackIdRef.current = null
    void playerRef.current?.play()
  }

  const cycleRepeatMode = () => {
    setRepeatMode((mode) => mode === 'off' ? 'playlist' : mode === 'playlist' ? 'track' : 'off')
  }

  const stopPlayback = () => {
    pendingPlaybackTrackIdRef.current = null
    playerRef.current?.pause()
    if (playerRef.current) playerRef.current.currentTime = 0
    setActiveTrackId(null)
    setOverlayCollapsed(false)
    setIsPlaying(false)
  }

  const repeatLabel = repeatMode === 'off'
    ? 'Повтор выключен'
    : repeatMode === 'playlist'
      ? 'Повтор плейлиста'
      : 'Повтор текущего трека'

  const startPanelResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (overlayCollapsed) return
    const panelWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 0
    if (!panelWidth) return

    resizePointerIdRef.current = event.pointerId
    panelResizeStartRef.current = {
      clientX: event.clientX,
      ratio: overlayWidthRatio,
      availableWidth: panelWidth / overlayWidthRatio,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const resizePanel = (event: React.PointerEvent<HTMLDivElement>) => {
    const resizeStart = panelResizeStartRef.current
    if (resizePointerIdRef.current !== event.pointerId || !resizeStart) return

    const ratio = resizeStart.ratio + (event.clientX - resizeStart.clientX) / resizeStart.availableWidth
    setOverlayWidthRatio(Math.min(1, Math.max(0.5, ratio)))
  }

  const finishPanelResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (resizePointerIdRef.current !== event.pointerId) return
    resizePointerIdRef.current = null
    panelResizeStartRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const resizePanelWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 0.05
    if (event.key === 'ArrowLeft') setOverlayWidthRatio((ratio) => Math.max(0.5, ratio - step))
    else if (event.key === 'ArrowRight') setOverlayWidthRatio((ratio) => Math.min(1, ratio + step))
    else if (event.key === 'Home') setOverlayWidthRatio(1)
    else if (event.key === 'End') setOverlayWidthRatio(0.5)
    else return
    event.preventDefault()
  }

  return (
    <section
      className={`media-view${compact ? ' is-compact' : ''}`}
      aria-labelledby="media-player-heading"
      hidden={compact && !isPlaying}
    >
      <div
        className={`media-player-overlay is-overlay${overlayCollapsed ? ' is-collapsed' : ''}`}
        style={{ '--media-panel-width-ratio': overlayWidthRatio } as CSSProperties}
      >
        <div
          className="media-player-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину аудиопанели"
          aria-valuemin={50}
          aria-valuemax={100}
          aria-valuenow={Math.round(overlayWidthRatio * 100)}
          tabIndex={0}
          onPointerDown={startPanelResize}
          onPointerMove={resizePanel}
          onPointerUp={finishPanelResize}
          onPointerCancel={finishPanelResize}
          onKeyDown={resizePanelWithKeyboard}
        />
        <div className="media-player-card">
          <MediaPlayer
            ref={playerRef}
            className="media-audio"
            src={activeTrack ? { src: activeTrack.file, type: 'audio/object' } : undefined}
            viewType="audio"
            title={playerTitle}
            volume={volume}
            onVolumeChange={(event) => setVolume(event.volume)}
            onCanPlay={startPendingTrack}
            onPlay={() => setIsPlaying(true)}
            onEnded={playNextTrack}
          >
            <MediaProvider />
            <DefaultAudioLayout
              icons={defaultLayoutIcons}
              translations={VIDSTACK_RUSSIAN_TRANSLATIONS}
              slots={{
                title: playerTitle,
                beforeSeekBackwardButton: <button type="button" className="media-overlay-stop vds-button" aria-label="Остановить и закрыть проигрыватель" title="Остановить" onClick={stopPlayback}><StopIcon /></button>,
                seekBackwardButton: <SeekButton className="vds-seek-button vds-button" seconds={-10} aria-label="Назад на 10 секунд"><SeekIcon direction="backward" /></SeekButton>,
                seekForwardButton: <SeekButton className="vds-seek-button vds-button" seconds={10} aria-label="Вперёд на 10 секунд"><SeekIcon direction="forward" /></SeekButton>,
                beforeMuteButton: <button type="button" className={`vds-repeat-button vds-button repeat-${repeatMode}`} aria-label={repeatLabel} title={repeatLabel} onClick={cycleRepeatMode}><RepeatIcon mode={repeatMode} /></button>,
                volumeSlider: (
                  <VolumeSlider.Root className="vds-volume-slider vds-slider" aria-label="Громкость" orientation="horizontal">
                    <VolumeSlider.Track className="vds-slider-track" />
                    <VolumeSlider.TrackFill className="vds-slider-track-fill vds-slider-track" />
                    <VolumeSlider.Thumb className="vds-slider-thumb" />
                    <VolumeSlider.Preview className="vds-slider-preview" noClamp>
                      <VolumeSlider.Value className="vds-slider-value" />
                    </VolumeSlider.Preview>
                  </VolumeSlider.Root>
                ),
              }}
            />
          </MediaPlayer>
          <button
            type="button"
            className="media-overlay-collapse"
            aria-label={overlayCollapsed ? 'Развернуть проигрыватель' : 'Свернуть проигрыватель'}
            aria-expanded={!overlayCollapsed}
            onClick={() => setOverlayCollapsed((collapsed) => !collapsed)}
          >
            <CollapseIcon collapsed={overlayCollapsed} />
          </button>
        </div>
      </div>

      {!compact && <>
        <div className="page-head media-page-head">
          <div className="media-heading">
            <h2 id="media-player-heading">Локальный музыкальный проигрыватель</h2>
            <button
              type="button"
              className="info-button"
              aria-label="Информация о локальном музыкальном проигрывателе"
              aria-expanded={mediaInfoOpen}
              aria-controls="media-player-info"
              onClick={() => setMediaInfoOpen((open) => !open)}
            >
              i
            </button>
            {mediaInfoOpen && (
              <p id="media-player-info" className="media-info">
                Музыкальный проигрыватель воспроизводит только файлы, выбранные пользователем на его устройстве. Файлы не загружаются и не хранятся сервисом. Пользователь самостоятельно отвечает за наличие прав и соблюдение законодательства при использовании материалов.
              </p>
            )}
          </div>
          <p>Музыка воспроизводится только в браузере и не передаётся на сайт.</p>
        </div>

        <div className="media-subtabs" role="tablist" aria-label="Разделы медиа">
          <button type="button" role="tab" aria-selected={subTab === 'player'} className={subTab === 'player' ? 'media-subtab active' : 'media-subtab'} onClick={() => setSubTab('player')}>Проигрыватель</button>
          <button type="button" role="tab" aria-selected={subTab === 'playlists'} className={subTab === 'playlists' ? 'media-subtab active' : 'media-subtab'} onClick={() => setSubTab('playlists')}>Плейлисты</button>
        </div>

        {subTab === 'player' && <>
          <div className="media-actions">
          <label className="primary media-file-picker">
            Выбрать аудиофайлы
            <input type="file" accept="audio/*" multiple onChange={selectFiles} />
          </label>
          {playlistFoldersSupported && <button type="button" className="ghost" onClick={selectDirectory}>Выбрать папку</button>}
        </div>
        <p className="hint media-status" role="status">{status}</p>
        {playlistFoldersSupported && <p className="hint">В Chrome и Edge можно сохранить доступ к выбранной папке. Браузер может запросить разрешение повторно.</p>}

      {tracks.length > 0 && (
        <ol className="media-playlist">
          {tracks.map((track) => (
            <li key={track.id}>
              <button
                type="button"
                className={track.id === activeTrackId ? 'media-track active' : 'media-track'}
                onClick={() => {
                  pendingPlaybackTrackIdRef.current = track.id
                  setActiveTrackId(track.id)
                }}
              >
                {track.name}
              </button>
            </li>
          ))}
        </ol>
      )}
        </>}

        {subTab === 'playlists' && (
        <div className="media-playlists-panel" role="tabpanel">
          {!playlistFoldersSupported ? (
            <p className="hint">
              {!window.isSecureContext
                ? 'Для сохранения папок откройте сайт через HTTPS или по адресу localhost. Текущий адрес по HTTP в локальной сети не даёт браузеру доступ к папкам.'
                : 'Сохранение папок доступно в Chrome и Edge. В этом браузере можно выбирать аудиофайлы только для текущей сессии.'}
            </p>
          ) : (
            <>
              <button type="button" className="primary" onClick={() => setPlaylistFormOpen(true)}>Добавить новый плейлист</button>
              {playlistFormOpen && (
                <div className="media-playlist-form">
                  <label>Название плейлиста<input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Например, Для прогулки" /></label>
                  <div className="media-playlist-folder">
                    <button type="button" className="ghost" onClick={choosePlaylistDirectory}>Указать папку</button>
                    <span className="hint">{selectedPlaylistDirectory ? 'Папка выбрана' : 'Папка не выбрана'}</span>
                  </div>
                  <div className="media-actions"><button type="button" className="primary" disabled={!playlistName.trim() || !selectedPlaylistDirectory} onClick={() => void createPlaylist()}>Сохранить плейлист</button><button type="button" className="ghost" onClick={() => setPlaylistFormOpen(false)}>Отмена</button></div>
                </div>
              )}
              {playlists.length === 0 ? <p className="hint">Сохранённых плейлистов пока нет.</p> : <ul className="saved-playlists">{playlists.map((playlist) => <li key={playlist.id}><button type="button" className="media-track" onClick={() => void openPlaylist(playlist)}>{playlist.name}</button><button type="button" className="ghost compact" onClick={() => void removePlaylist(playlist)} aria-label={`Удалить плейлист ${playlist.name}`}>Удалить</button></li>)}</ul>}
            </>
          )}
        </div>
        )}
      </>}
    </section>
  )
}
