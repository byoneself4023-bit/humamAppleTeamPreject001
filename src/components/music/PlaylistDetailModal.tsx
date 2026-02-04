import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2, Music2, Clock, Calendar, Hash, GripHorizontal, Play, Heart, Share2, MoreHorizontal } from 'lucide-react'
import { playlistsApi, PlaylistWithTracks } from '../../services/api/playlists'
import { useMusic } from '../../context/MusicContext'

interface PlaylistDetailModalProps {
    isOpen: boolean
    onClose: () => void
    playlistId: number | null
}

const PlaylistDetailModal = ({ isOpen, onClose, playlistId }: PlaylistDetailModalProps) => {
    const [playlist, setPlaylist] = useState<PlaylistWithTracks | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [imageError, setImageError] = useState(false)
    const { playPlaylist } = useMusic()

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
            <div
                ref={modalRef}
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                className={`bg-hud-bg-card border-2 border-hud-accent-primary/30 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl shadow-hud-accent-primary/20 relative overflow-hidden animate-scale-up ${isDragging ? 'cursor-grabbing' : ''}`}
            >
                {/* Gradient Border Effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-hud-accent-primary/20 via-transparent to-hud-accent-info/20 pointer-events-none"></div>

                {/* Drag Handle */}
                <div
                    onMouseDown={handleMouseDown}
                    className="absolute top-0 left-0 right-0 h-12 flex items-center justify-center cursor-grab hover:bg-hud-bg-secondary/30 transition-all z-20 group backdrop-blur-sm"
                >
                    <GripHorizontal className="w-6 h-6 text-hud-text-muted/50 group-hover:text-hud-accent-primary transition-colors" />
                </div>

                {/* Header with Gradient Background */}
                <div className="relative pt-12 pb-6 px-6 bg-gradient-to-b from-hud-accent-primary/10 via-hud-bg-card to-hud-bg-card border-b border-hud-border-secondary">
                    {loading ? (
                        <div className="h-40 animate-pulse bg-hud-bg-secondary w-full rounded-lg"></div>
                    ) : playlist ? (
                        <div className="flex gap-8">
                            {/* Album Cover with Enhanced Styling */}
                            <div className="w-48 h-48 rounded-xl overflow-hidden shadow-2xl border-2 border-hud-accent-primary/30 shrink-0 relative group bg-gradient-to-br from-hud-bg-secondary to-hud-bg-primary">
                                {fixImageUrl(playlist.coverImage) && !imageError ? (
                                    <>
                                        <img
                                            src={fixImageUrl(playlist.coverImage)}
                                            alt={playlist.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            onError={(e) => {
                                                console.error('[PlaylistDetail] Image failed to load:', e.currentTarget.src)
                                                console.error('[PlaylistDetail] Original URL:', playlist.coverImage)
                                                setImageError(true)
                                            }}
                                            onLoad={() => console.log('[PlaylistDetail] Image loaded:', fixImageUrl(playlist.coverImage))}
                                        />
                                        {/* Overlay on Hover */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Play className="w-16 h-16 text-white drop-shadow-lg" fill="white" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-hud-accent-primary/20 to-hud-accent-info/20">
                                        <Music2 className="w-20 h-20 text-hud-accent-primary/50" />
                                    </div>
                                )}
                            </div>

                            {/* Playlist Info */}
                            <div className="flex flex-col justify-center flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-black text-hud-accent-primary uppercase tracking-widest px-2 py-1 bg-hud-accent-primary/10 rounded">
                                        Playlist
                                    </span>
                                </div>
                                <h2 className="text-5xl font-black text-hud-text-primary mb-3 leading-tight drop-shadow-lg">
                                    {playlist.title}
                                </h2>
                                <p className="text-hud-text-secondary text-base mb-6 line-clamp-2 max-w-2xl">
                                    {playlist.description || '음악과 함께하는 특별한 순간'}
                                </p>

                                {/* Stats Row */}
                                <div className="flex items-center gap-6 text-sm text-hud-text-muted mb-6">
                                    <span className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-hud-accent-primary/20 flex items-center justify-center">
                                            <Hash className="w-4 h-4 text-hud-accent-primary" />
                                        </div>
                                        <span className="text-hud-text-primary font-bold">{playlist.tracks?.length || 0}</span> tracks
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-hud-accent-info/20 flex items-center justify-center">
                                            <Calendar className="w-4 h-4 text-hud-accent-info" />
                                        </div>
                                        {new Date(playlist.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => playlist?.tracks && playPlaylist(playlist.tracks)}
                                        className="flex items-center gap-2 px-6 py-3 bg-hud-accent-primary text-black font-bold rounded-full hover:scale-105 hover:shadow-lg hover:shadow-hud-accent-primary/50 transition-all">
                                        <Play className="w-5 h-5" fill="currentColor" />
                                        Play All
                                    </button>
                                    <button className="p-3 bg-hud-bg-secondary/50 hover:bg-hud-bg-secondary text-hud-text-primary rounded-full hover:scale-105 transition-all border border-hud-border-secondary hover:border-hud-accent-primary">
                                        <Heart className="w-5 h-5" />
                                    </button>
                                    <button className="p-3 bg-hud-bg-secondary/50 hover:bg-hud-bg-secondary text-hud-text-primary rounded-full hover:scale-105 transition-all border border-hud-border-secondary hover:border-hud-accent-primary">
                                        <Share2 className="w-5 h-5" />
                                    </button>
                                    <button className="p-3 bg-hud-bg-secondary/50 hover:bg-hud-bg-secondary text-hud-text-primary rounded-full hover:scale-105 transition-all border border-hud-border-secondary hover:border-hud-accent-primary">
                                        <MoreHorizontal className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div></div>
                    )}

                    {/* Close Button - Positioned Absolutely */}
                    <button
                        onClick={onClose}
                        className="absolute top-12 right-6 p-2 text-hud-text-muted hover:text-hud-text-primary hover:bg-hud-bg-secondary/80 rounded-lg transition-all backdrop-blur-sm"
                    >
                        <X size={24} />
                    </button>
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
                                    <th className="px-6 py-4 w-16 text-center text-xs font-black text-hud-text-muted uppercase tracking-wider">#</th>
                                    <th className="px-6 py-4 text-xs font-black text-hud-text-muted uppercase tracking-wider">Title</th>
                                    <th className="px-6 py-4 text-xs font-black text-hud-text-muted uppercase tracking-wider hidden md:table-cell">Artist</th>
                                    <th className="px-6 py-4 text-xs font-black text-hud-text-muted uppercase tracking-wider hidden lg:table-cell">Album</th>
                                    <th className="px-6 py-4 w-24 text-right text-xs font-black text-hud-text-muted uppercase tracking-wider">
                                        <Clock className="w-4 h-4 ml-auto" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {playlist?.tracks && playlist.tracks.length > 0 ? (
                                    playlist.tracks.map((track, index) => (
                                        <tr
                                            key={track.id}
                                            className="group hover:bg-gradient-to-r hover:from-hud-accent-primary/10 hover:to-transparent transition-all duration-200 cursor-pointer border-b border-hud-border-secondary/30 hover:border-hud-accent-primary/30"
                                        >
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center">
                                                    <span className="text-sm text-hud-text-muted group-hover:hidden font-mono">
                                                        {index + 1}
                                                    </span>
                                                    <Play className="w-4 h-4 text-hud-accent-primary hidden group-hover:block" fill="currentColor" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-hud-text-primary group-hover:text-hud-accent-primary transition-colors">{track.title}</div>
                                                <div className="text-xs text-hud-text-secondary md:hidden mt-1">{track.artist}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-hud-text-secondary hidden md:table-cell group-hover:text-hud-text-primary transition-colors">
                                                {track.artist}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-hud-text-muted hidden lg:table-cell truncate max-w-[200px]">
                                                {track.album}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-hud-bg-secondary rounded">
                                                        <Heart className="w-4 h-4 text-hud-text-muted hover:text-hud-accent-primary" />
                                                    </button>
                                                    <span className="text-sm text-hud-text-muted font-mono">
                                                        {formatDuration(track.duration)}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="p-16 text-center">
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
