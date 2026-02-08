import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2, Music2, Clock, Calendar, Hash, GripHorizontal, Play, Heart, Share2, MoreHorizontal, ShoppingCart } from 'lucide-react'
import { playlistsApi, PlaylistWithTracks, Track } from '../../services/api/playlists'
import { useMusic } from '../../context/MusicContext'
import FavoriteButton from './FavoriteButton'

interface PlaylistDetailModalProps {
    isOpen: boolean
    onClose: () => void
    playlistId: number | null
    onAddToCart?: (track: Track) => void
    cartTrackIds?: Set<number>
}

const PlaylistDetailModal = ({ isOpen, onClose, playlistId, onAddToCart, cartTrackIds }: PlaylistDetailModalProps) => {
    const [playlist, setPlaylist] = useState<PlaylistWithTracks | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [imageError, setImageError] = useState(false)
    const { playPlaylist, playTrack, setQueue } = useMusic()

    // Drag state
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const dragStartPos = useRef({ x: 0, y: 0 })
    const modalRef = useRef<HTMLDivElement>(null)

    // Reset position when modal opens
    useEffect(() => {
        if (isOpen) {
            setPosition({ x: 0, y: 0 })
        }
    }, [isOpen])

    // Drag handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
        dragStartPos.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        }
    }, [position])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return
        const newX = e.clientX - dragStartPos.current.x
        const newY = e.clientY - dragStartPos.current.y
        setPosition({ x: newX, y: newY })
    }, [isDragging])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    // Add/remove global event listeners for drag
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    useEffect(() => {
        if (isOpen && playlistId) {
            fetchDetails(playlistId)
            setImageError(false)
        } else {
            setPlaylist(null)
            setLoading(true)
            setImageError(false)
        }
    }, [isOpen, playlistId])

    const fetchDetails = async (id: number) => {
        try {
            setLoading(true)
            setError(null)
            // Fix: Cast response to unknown then to PlaylistWithTracks because getById might return just Playlist in types
            const data = await playlistsApi.getById(id) as unknown as PlaylistWithTracks
            setPlaylist(data)
        } catch (err) {
            console.error('Failed to load playlist details:', err)
            setError('플레이리스트 정보를 불러오는데 실패했습니다.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    // Format duration helper
    const formatDuration = (seconds: number) => {
        const min = Math.floor(seconds / 60)
        const sec = seconds % 60
        return `${min}:${sec.toString().padStart(2, '0')}`
    }

    // Fix image URL (handle Apple Music placeholder URLs and Tidal double slash issue)
    const fixImageUrl = (url?: string, size: number = 300): string | undefined => {
        if (!url) return undefined

        let fixed = url
            .replace('{w}', String(size))
            .replace('{h}', String(size))

        // Fix Tidal double slash issue FIRST (e.g., /images//images/ -> /images/)
        fixed = fixed.replace(/\/images\/\/images\//g, '/images/')
        // Fix any remaining double slashes (except after protocol)
        fixed = fixed.replace(/([^:])\/\/+/g, '$1/')

        // Proxy external Tidal/Spotify images through backend to avoid CORS
        if (fixed.startsWith('https://resources.tidal.com/') ||
            fixed.startsWith('https://i.scdn.co/') ||
            fixed.includes('mzstatic.com')) {
            return `/api/playlists/proxy-image?url=${encodeURIComponent(fixed)}`
        }

        return fixed
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div
                ref={modalRef}
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                className={`bg-hud-bg-card border-2 border-hud-accent-primary/30 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl shadow-hud-accent-primary/20 relative overflow-hidden animate-scale-up ${isDragging ? 'cursor-grabbing' : ''}`}
            >
                {/* Gradient Border Effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-hud-accent-primary/20 via-transparent to-hud-accent-info/20 pointer-events-none"></div>

                {/* Header (draggable) */}
                <div
                    className="relative px-5 pt-3 pb-4 bg-gradient-to-b from-hud-accent-primary/10 to-hud-bg-card border-b border-hud-border-secondary shrink-0"
                >
                    {/* Drag Handle */}
                    <div
                        onMouseDown={handleMouseDown}
                        className="flex justify-center mb-3 cursor-grab active:cursor-grabbing"
                    >
                        <div className="w-10 h-1 rounded-full bg-hud-text-muted/30 hover:bg-hud-accent-primary/50 transition-colors" />
                    </div>

                    {loading ? (
                        <div className="h-16 animate-pulse bg-hud-bg-secondary w-full rounded-lg"></div>
                    ) : playlist ? (
                        <div className="flex items-center gap-4">
                            {/* Album Cover - compact */}
                            <div className="w-16 h-16 rounded-lg overflow-hidden shadow-lg border border-hud-accent-primary/20 shrink-0 relative group bg-hud-bg-secondary">
                                {fixImageUrl(playlist.coverImage) && !imageError ? (
                                    <img
                                        src={fixImageUrl(playlist.coverImage)}
                                        alt={playlist.title}
                                        className="w-full h-full object-cover"
                                        onError={() => setImageError(true)}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-hud-accent-primary/20 to-hud-accent-info/20">
                                        <Music2 className="w-8 h-8 text-hud-accent-primary/50" />
                                    </div>
                                )}
                            </div>

                            {/* Title + Stats */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-hud-accent-primary uppercase tracking-widest px-1.5 py-0.5 bg-hud-accent-primary/10 rounded">
                                        Playlist
                                    </span>
                                    <span className="text-xs text-hud-text-muted">
                                        {playlist.tracks?.length || 0} tracks
                                    </span>
                                </div>
                                <h2 className="text-xl font-bold text-hud-text-primary truncate">
                                    {playlist.title}
                                </h2>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => playlist?.tracks && playPlaylist(playlist.tracks)}
                                    className="flex items-center gap-2 px-5 py-2 bg-hud-accent-primary text-black font-bold rounded-full hover:scale-105 hover:shadow-lg hover:shadow-hud-accent-primary/50 transition-all text-sm"
                                >
                                    <Play className="w-4 h-4" fill="currentColor" />
                                    Play All
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-hud-text-muted hover:text-hud-text-primary hover:bg-hud-bg-secondary rounded-lg transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div></div>
                    )}
                </div>

                {/* Content - Track List */}
                <div className="flex-1 overflow-y-auto p-0 custom-scrollbar bg-hud-bg-card">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-hud-text-muted">
                            <Loader2 className="w-12 h-12 animate-spin text-hud-accent-primary" />
                            <p className="text-lg">Loading tracks...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-red-400">
                            <p className="font-bold text-lg">{error}</p>
                            <button
                                onClick={() => playlistId && fetchDetails(playlistId)}
                                className="px-6 py-3 bg-hud-accent-primary text-black font-bold rounded-full hover:scale-105 transition-all"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-hud-bg-secondary/80 backdrop-blur-sm sticky top-0 z-10">
                                <tr className="border-b border-hud-border-secondary">
                                    <th className="px-4 py-2.5 w-12 text-center text-xs font-black text-hud-text-muted uppercase tracking-wider">#</th>
                                    <th className="px-4 py-2.5 text-xs font-black text-hud-text-muted uppercase tracking-wider">Title</th>
                                    <th className="px-4 py-2.5 text-xs font-black text-hud-text-muted uppercase tracking-wider hidden md:table-cell">Artist</th>
                                    <th className="px-4 py-2.5 text-xs font-black text-hud-text-muted uppercase tracking-wider hidden lg:table-cell">Album</th>
                                    <th className="px-4 py-2.5 w-24 text-right text-xs font-black text-hud-text-muted uppercase tracking-wider">
                                        <Clock className="w-3.5 h-3.5 ml-auto" />
                                    </th>
                                    {onAddToCart && (
                                        <th className="px-4 py-2.5 w-12 text-center text-xs font-black text-hud-text-muted uppercase tracking-wider">
                                            <ShoppingCart className="w-3.5 h-3.5 mx-auto" />
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {playlist?.tracks && playlist.tracks.length > 0 ? (
                                    playlist.tracks.map((track, index) => (
                                        <tr
                                            key={track.id}
                                            onClick={() => {
                                                if (playlist.tracks) {
                                                    setQueue(playlist.tracks)
                                                    playTrack(track)
                                                }
                                            }}
                                            className="group hover:bg-gradient-to-r hover:from-hud-accent-primary/10 hover:to-transparent transition-all duration-200 cursor-pointer border-b border-hud-border-secondary/30 hover:border-hud-accent-primary/30"
                                        >
                                            <td className="px-4 py-2 text-center">
                                                <div className="flex items-center justify-center">
                                                    <span className="text-xs text-hud-text-muted group-hover:hidden font-mono">
                                                        {index + 1}
                                                    </span>
                                                    <Play className="w-3.5 h-3.5 text-hud-accent-primary hidden group-hover:block" fill="currentColor" />
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="text-sm font-medium text-hud-text-primary group-hover:text-hud-accent-primary transition-colors truncate">{track.title}</div>
                                                <div className="text-xs text-hud-text-secondary md:hidden">{track.artist}</div>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-hud-text-secondary hidden md:table-cell group-hover:text-hud-text-primary transition-colors">
                                                {track.artist}
                                            </td>
                                            <td className="px-4 py-2 text-xs text-hud-text-muted hidden lg:table-cell truncate max-w-[200px]">
                                                {track.album}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <FavoriteButton
                                                            track={{ title: track.title, artist: track.artist, album: track.album, duration: track.duration, artwork: track.artwork }}
                                                            size="sm"
                                                        />
                                                    </div>
                                                    <span className="text-xs text-hud-text-muted font-mono">
                                                        {formatDuration(track.duration)}
                                                    </span>
                                                </div>
                                            </td>
                                            {onAddToCart && (
                                                <td className="px-4 py-2 text-center">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onAddToCart(track)
                                                        }}
                                                        className={`p-1.5 rounded-full transition-all hover:scale-110 ${
                                                            cartTrackIds?.has(track.id)
                                                                ? 'bg-hud-accent-warning/30 text-hud-accent-warning'
                                                                : 'bg-hud-bg-secondary hover:bg-hud-accent-warning/20 text-hud-text-muted hover:text-hud-accent-warning'
                                                        }`}
                                                        title={cartTrackIds?.has(track.id) ? "장바구니에 담김" : "장바구니에 담기"}
                                                    >
                                                        <ShoppingCart className="w-3.5 h-3.5" fill={cartTrackIds?.has(track.id) ? "currentColor" : "none"} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                ) : (
<tr>
                                        <td colSpan={onAddToCart ? 6 : 5} className="p-16 text-center">
                                            <Music2 className="w-16 h-16 text-hud-text-muted/30 mx-auto mb-4" />
                                            <p className="text-hud-text-muted text-lg">No tracks found in this playlist.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}

export default PlaylistDetailModal
