import MusicPlayer from '../../components/music/MusicPlayer'
import PlaylistCard from '../../components/music/PlaylistCard'
import TrackListOverlay from '../../components/music/TrackListOverlay'
import { MusicProvider } from '../../context/MusicContext'
import { playlistsApi, PlaylistWithTracks, Playlist } from '../../services/api/playlists'
import { post } from '../../services/api/index'
import { Play, ArrowRight, Sparkles, Music, Guitar, Headphones, Zap, Loader2, RefreshCw, Info, AlertTriangle, X } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

const MusicLoungeContent = () => {
    const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistWithTracks | null>(null)
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [loading, setLoading] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null)
    const [editForm, setEditForm] = useState({ title: '', description: '' })

    // Sync with Tidal if credentials exist
    const syncTidal = useCallback(async () => {
        try {
            const storedTidal = localStorage.getItem('tidal_login_result')
            if (storedTidal) {
                const { response } = JSON.parse(storedTidal)
                if (response && response.access_token) {
                    setIsSyncing(true)
                    // Call sync API (non-blocking for UI, but blocking for data freshness if possible)
                    await post('/auth/sync/tidal', { tidalAuthData: response })
                    console.log('[MusicLounge] Tidal sync completed on mount')
                }
            }
        } catch (error) {
            console.error('[MusicLounge] Auto-sync failed:', error)
        } finally {
            setIsSyncing(false)
        }
    }, [])

    // Fetch playlists from PMS (Personal Music Space)
    const fetchPlaylists = useCallback(async () => {
        try {
            setLoading(true)
            await syncTidal() // Try sync first
            const response = await playlistsApi.getPlaylists('PMS')
            setPlaylists(response.playlists)
        } catch (error) {
            console.error('Failed to fetch playlists:', error)
        } finally {
            setLoading(false)
        }
    }, [syncTidal])

    useEffect(() => {
        fetchPlaylists()
    }, [fetchPlaylists])

    const handlePlaylistClick = async (id: number) => {
        try {
            const playlist = await playlistsApi.getById(id) as PlaylistWithTracks
            setSelectedPlaylist(playlist)
        } catch (error) {
            console.error('Failed to fetch playlist', error)
        }
    }

    const handleDeleteClick = (e: React.MouseEvent, playlist: Playlist) => {
        e.stopPropagation()
        setDeleteTarget(playlist)
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        try {
            await playlistsApi.delete(deleteTarget.id)
            setPlaylists(prev => prev.filter(p => p.id !== deleteTarget.id))
            setDeleteTarget(null)
        } catch (error) {
            console.error('Failed to delete playlist', error)
        }
    }

    const handleEditClick = (e: React.MouseEvent, playlist: Playlist) => {
        e.stopPropagation()
        setEditingPlaylist(playlist)
        setEditForm({ title: playlist.title, description: playlist.description || '' })
    }

    const handleEditSave = async () => {
        if (!editingPlaylist) return
        try {
            await playlistsApi.updateDetails(editingPlaylist.id, editForm)
            setPlaylists(prev => prev.map(p =>
                p.id === editingPlaylist.id
                    ? { ...p, title: editForm.title, description: editForm.description }
                    : p
            ))
            setEditingPlaylist(null)
        } catch (error) {
            console.error('Failed to update playlist', error)
        }
    }

    // Get icon based on index
    const getIcon = (index: number) => {
        const icons = [
            <Music className="w-12 h-12" />,
            <Guitar className="w-12 h-12" />,
            <Headphones className="w-12 h-12" />,
            <Zap className="w-12 h-12" />
        ]
        return icons[index % icons.length]
    }

    const handleTrackRemove = async (trackId: number) => {
        if (!selectedPlaylist) return
        try {
            await playlistsApi.removeTrack(selectedPlaylist.id, trackId)

            // Update selected playlist state
            const updatedTracks = selectedPlaylist.tracks.filter(t => t.id !== trackId)
            setSelectedPlaylist({ ...selectedPlaylist, tracks: updatedTracks, trackCount: updatedTracks.length })

            // Update main list state
            setPlaylists(prev => prev.map(p =>
                p.id === selectedPlaylist.id
                    ? { ...p, trackCount: updatedTracks.length }
                    : p
            ))
        } catch (error) {
            console.error('Failed to remove track:', error)
        }
    }

    return (
        <div className="pb-32 p-4 md:p-6">
                {/* Hero Section */}
                <section className="hud-card hud-card-bottom rounded-xl p-8 mb-8 relative overflow-hidden">
                    <div className="relative z-10">
                        <h1 className="text-4xl font-bold text-hud-accent-primary mb-3">Good Evening!</h1>
                        <p className="text-lg text-hud-text-secondary mb-6">오늘도 좋은 음악과 함께하세요</p>

                        <div className="flex gap-4">
                            <button className="bg-hud-accent-primary text-hud-bg-primary px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-hud-accent-primary/90 transition-all btn-glow">
                                <Play className="w-5 h-5" fill="currentColor" />
                                Continue Listening
                            </button>
                            <button className="bg-hud-bg-secondary border border-hud-border-secondary text-hud-text-primary px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-hud-bg-hover transition-all">
                                <Sparkles className="w-5 h-5" />
                                Surprise Me
                            </button>
                        </div>
                    </div>
                </section>

                {/* AI 추천 섹션 */}
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-bold text-hud-text-primary flex items-center gap-3">
                                My Playlists
                                <span className="bg-gradient-to-r from-hud-accent-secondary to-hud-accent-primary px-3 py-1 rounded-full text-xs font-semibold uppercase text-hud-bg-primary">
                                    PMS
                                </span>
                            </h2>
                            <div className="hidden md:flex items-center gap-2 bg-hud-accent-info/10 text-hud-accent-info text-xs px-3 py-1.5 rounded-lg border border-hud-accent-info/20">
                                <Info size={14} />
                                <span>PMS에서의 변경(수정/삭제)은 원본 플랫폼(Tidal 등)에 영향을 주지 않습니다.</span>
                            </div>
                        </div>
                        <a href="/music/external-space" className="text-hud-accent-primary font-medium flex items-center gap-2 hover:text-hud-accent-primary/80 transition-all">
                            {isSyncing && <RefreshCw className="w-4 h-4 animate-spin" />}
                            Add More <ArrowRight className="w-4 h-4" />
                        </a>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-hud-accent-primary animate-spin" />
                        </div>
                    ) : playlists.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {playlists.map((playlist, index) => (
                                <PlaylistCard
                                    key={playlist.id}
                                    title={playlist.title}
                                    trackCount={playlist.trackCount || 0}
                                    confidenceScore={playlist.aiScore ? Math.round(Number(playlist.aiScore)) : undefined}
                                    coverImage={playlist.coverImage}
                                    icon={getIcon(index)}
                                    onClick={() => handlePlaylistClick(playlist.id)}
                                    onEdit={(e) => handleEditClick(e, playlist)}
                                    onDelete={(e) => handleDeleteClick(e, playlist)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="hud-card rounded-xl p-8 text-center">
                            <Music className="w-16 h-16 text-hud-text-muted mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-hud-text-primary mb-2">플레이리스트가 없습니다</h3>
                            <p className="text-hud-text-secondary mb-4">The Cargo에서 플레이리스트를 가져와 시작하세요</p>
                            <a
                                href="/music/external-space"
                                className="inline-flex items-center gap-2 bg-hud-accent-primary text-hud-bg-primary px-6 py-3 rounded-lg font-semibold hover:bg-hud-accent-primary/90 transition-all"
                            >
                                <ArrowRight className="w-5 h-5" />
                                The Cargo로 이동
                            </a>
                        </div>
                    )}
                </section>

                {/* Stats Sidebar */}
                {playlists.length > 0 && (
                    <section className="grid lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-3 hud-card hud-card-bottom rounded-xl p-6">
                            <h3 className="text-lg font-bold text-hud-text-primary mb-6">Your Stats</h3>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {[
                                    { value: playlists.length.toString(), label: 'Total Playlists', color: 'text-hud-accent-primary' },
                                    { value: playlists.reduce((sum, p) => sum + (p.trackCount || 0), 0).toString(), label: 'Total Tracks', color: 'text-hud-accent-secondary' },
                                    { value: playlists.filter(p => p.status === 'PRP').length.toString(), label: 'Verified', color: 'text-hud-accent-info' },
                                    { value: playlists.filter(p => Number(p.aiScore) > 80).length.toString(), label: 'High Score', color: 'text-hud-accent-success' }
                                ].map((stat) => (
                                    <div key={stat.label} className="text-center">
                                        <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                                        <div className="text-xs text-hud-text-muted uppercase tracking-wider">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

            <MusicPlayer />

            {selectedPlaylist && (
                <TrackListOverlay
                    playlist={selectedPlaylist}
                    onClose={() => setSelectedPlaylist(null)}
                    onRemoveTrack={handleTrackRemove}
                />
            )}
            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-hud-bg-card border border-hud-border-secondary rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-hud-text-primary mb-2">Delete Playlist?</h3>
                            <p className="text-hud-text-secondary text-sm">
                                <span className="text-hud-accent-primary font-semibold">{deleteTarget.title}</span><br />
                                플레이리스트를 삭제하시겠습니까?
                            </p>
                            <p className="text-hud-text-muted text-xs mt-2 bg-hud-bg-secondary p-2 rounded">
                                * MusicSpace에서만 삭제되며, 원본 플랫폼(Tidal 등)에는 유지됩니다.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 px-4 py-2 rounded-lg bg-hud-bg-secondary text-hud-text-secondary hover:bg-hud-bg-hover transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors font-medium shadow-lg shadow-red-500/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingPlaylist && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-hud-bg-card border border-hud-border-secondary rounded-xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-hud-text-primary">Edit Playlist</h3>
                            <button onClick={() => setEditingPlaylist(null)} className="text-hud-text-muted hover:text-hud-text-primary">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-medium text-hud-text-secondary uppercase mb-1">Title</label>
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    className="w-full bg-hud-bg-secondary border border-hud-border-secondary rounded-lg px-3 py-2 text-hud-text-primary focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-hud-text-secondary uppercase mb-1">Description</label>
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    rows={3}
                                    className="w-full bg-hud-bg-secondary border border-hud-border-secondary rounded-lg px-3 py-2 text-hud-text-primary focus:outline-none focus:border-hud-accent-primary focus:ring-1 focus:ring-hud-accent-primary resize-none"
                                />
                            </div>
                            <div className="bg-hud-accent-info/10 border border-hud-accent-info/20 rounded-lg p-3">
                                <p className="text-xs text-hud-accent-info flex items-start gap-2">
                                    <Info size={14} className="mt-0.5 shrink-0" />
                                    이 변경사항은 MusicSpace 내에서만 적용됩니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setEditingPlaylist(null)}
                                className="px-4 py-2 rounded-lg bg-hud-bg-secondary text-hud-text-secondary hover:bg-hud-bg-hover transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditSave}
                                disabled={!editForm.title.trim()}
                                className="px-4 py-2 rounded-lg bg-hud-accent-primary text-hud-bg-primary hover:bg-hud-accent-primary/90 transition-colors font-medium shadow-lg shadow-hud-accent-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const MusicLounge = () => {
    return (
        <MusicProvider>
            <MusicLoungeContent />
        </MusicProvider>
    )
}

export default MusicLounge
