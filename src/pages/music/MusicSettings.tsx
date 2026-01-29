import { useState, useEffect } from 'react'
import MusicSidebar from '../../components/music/MusicSidebar'
import { spotifyApi, SpotifyPlaylist } from '../../services/api/spotify'
import { useAuth } from '../../contexts/AuthContext'
import {
    Music,
    Link,
    Unlink,
    Download,
    Loader2,
    CheckCircle,
    List,
    Settings,
} from 'lucide-react'

const MusicSettings = () => {
    const { user } = useAuth()

    // Spotify state
    const [spotifyConnected, setSpotifyConnected] = useState(false)
    const [spotifyUser, setSpotifyUser] = useState<{ displayName: string; image?: string } | null>(null)
    const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([])
    const [spotifyLoading, setSpotifyLoading] = useState(false)
    const [importingPlaylist, setImportingPlaylist] = useState<string | null>(null)
    const [importedPlaylists, setImportedPlaylists] = useState<Set<string>>(new Set())

    // Check Spotify connection status
    useEffect(() => {
        const checkSpotify = async () => {
            try {
                const status = await spotifyApi.getAuthStatus()
                setSpotifyConnected(status.connected)
                if (status.connected && status.user) {
                    setSpotifyUser({ displayName: status.user.displayName, image: status.user.image })
                }
            } catch (e) {
                console.error('Spotify status check failed:', e)
            }
        }
        checkSpotify()

        // Listen for login success message
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SPOTIFY_LOGIN_SUCCESS') {
                setSpotifyConnected(true)
                setSpotifyUser({ displayName: event.data.user.displayName, image: event.data.user.image })
            }
        }
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [])

    // Load playlists when connected
    useEffect(() => {
        if (spotifyConnected) {
            loadSpotifyPlaylists()
        }
    }, [spotifyConnected])

    const handleSpotifyLogin = async () => {
        try {
            const authUrl = await spotifyApi.getLoginUrl()
            window.open(authUrl, 'SpotifyLogin', 'width=500,height=700')
        } catch (e) {
            console.error('Spotify login failed:', e)
        }
    }

    const handleSpotifyLogout = async () => {
        try {
            await spotifyApi.logout()
            setSpotifyConnected(false)
            setSpotifyUser(null)
            setSpotifyPlaylists([])
        } catch (e) {
            console.error('Spotify logout failed:', e)
        }
    }

    const loadSpotifyPlaylists = async () => {
        setSpotifyLoading(true)
        try {
            const response = await spotifyApi.getPlaylists()
            setSpotifyPlaylists(response.playlists)
        } catch (e) {
            console.error('Failed to load playlists:', e)
        } finally {
            setSpotifyLoading(false)
        }
    }

    const handleImportPlaylist = async (playlist: SpotifyPlaylist) => {
        if (!user?.id) {
            alert('로그인이 필요합니다')
            return
        }
        setImportingPlaylist(playlist.id)
        try {
            const result = await spotifyApi.importPlaylist(playlist.id, user.id)
            if (result.success) {
                setImportedPlaylists(prev => new Set(prev).add(playlist.id))
                alert(`"${result.title}" 가져오기 완료! (${result.importedTracks}/${result.totalTracks} 트랙)`)
            }
        } catch (e) {
            console.error('Import failed:', e)
            alert('가져오기 실패')
        } finally {
            setImportingPlaylist(null)
        }
    }

    return (
        <div className="min-h-screen bg-hud-bg-primary hud-grid-bg">
            <MusicSidebar />

            {/* Main Content */}
            <main className="ml-0 md:ml-64 p-4 md:p-6">
                {/* Header */}
                <section className="hud-card hud-card-bottom rounded-xl p-8 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-hud-accent-primary/20 rounded-xl flex items-center justify-center">
                            <Settings className="w-7 h-7 text-hud-accent-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-hud-text-primary">Music Services</h1>
                            <p className="text-hud-text-secondary">외부 음악 서비스를 연결하고 플레이리스트를 가져오세요</p>
                        </div>
                    </div>
                </section>

                {/* Spotify Section */}
                <section className="hud-card rounded-xl p-6 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-[#1DB954] rounded-lg flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-hud-text-primary">Spotify</h2>
                            <p className="text-sm text-hud-text-muted">Spotify 플레이리스트를 PMS로 가져오기</p>
                        </div>
                    </div>

                    {/* Connection Status */}
                    <div className="flex items-center justify-between p-4 bg-hud-bg-secondary rounded-lg mb-4">
                        <div className="flex items-center gap-4">
                            {spotifyUser?.image ? (
                                <img src={spotifyUser.image} alt="" className="w-12 h-12 rounded-full" />
                            ) : (
                                <div className="w-12 h-12 bg-[#1DB954]/20 rounded-full flex items-center justify-center">
                                    <Music className="w-6 h-6 text-[#1DB954]" />
                                </div>
                            )}
                            <div>
                                {spotifyConnected ? (
                                    <>
                                        <p className="text-sm text-hud-text-primary flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-[#1DB954]" />
                                            연결됨
                                        </p>
                                        <p className="text-xs text-hud-text-muted">{spotifyUser?.displayName}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-hud-text-primary">연결 안됨</p>
                                        <p className="text-xs text-hud-text-muted">Spotify 계정을 연결하세요</p>
                                    </>
                                )}
                            </div>
                        </div>
                        {spotifyConnected ? (
                            <button
                                onClick={handleSpotifyLogout}
                                className="px-4 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-secondary hover:text-hud-accent-error hover:border-hud-accent-error/30 transition-all flex items-center gap-2"
                            >
                                <Unlink className="w-4 h-4" />
                                연결 해제
                            </button>
                        ) : (
                            <button
                                onClick={handleSpotifyLogin}
                                className="px-4 py-2 bg-[#1DB954] rounded-lg text-sm text-white font-medium hover:bg-[#1ed760] transition-all flex items-center gap-2"
                            >
                                <Link className="w-4 h-4" />
                                연결하기
                            </button>
                        )}
                    </div>

                    {/* Playlists */}
                    {spotifyConnected && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-hud-text-primary flex items-center gap-2">
                                    <List className="w-4 h-4" />
                                    내 플레이리스트
                                </h4>
                                <button
                                    onClick={loadSpotifyPlaylists}
                                    disabled={spotifyLoading}
                                    className="text-xs text-hud-accent-primary hover:underline"
                                >
                                    새로고침
                                </button>
                            </div>

                            {spotifyLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 text-[#1DB954] animate-spin" />
                                </div>
                            ) : spotifyPlaylists.length === 0 ? (
                                <p className="text-center text-hud-text-muted py-4">플레이리스트가 없습니다</p>
                            ) : (
                                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                                    {spotifyPlaylists.map((playlist) => (
                                        <div
                                            key={playlist.id}
                                            className="flex items-center gap-3 p-3 bg-hud-bg-primary rounded-lg hover:bg-hud-bg-hover transition-all"
                                        >
                                            {playlist.image ? (
                                                <img src={playlist.image} alt={playlist.name} className="w-14 h-14 rounded object-cover" />
                                            ) : (
                                                <div className="w-14 h-14 bg-hud-bg-secondary rounded flex items-center justify-center">
                                                    <Music className="w-6 h-6 text-hud-text-muted" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-hud-text-primary truncate">{playlist.name}</p>
                                                <p className="text-xs text-hud-text-muted">{playlist.trackCount} 트랙</p>
                                            </div>
                                            {importedPlaylists.has(playlist.id) ? (
                                                <span className="text-xs text-hud-accent-success flex items-center gap-1 px-3 py-1.5">
                                                    <CheckCircle className="w-4 h-4" />
                                                    완료
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleImportPlaylist(playlist)}
                                                    disabled={importingPlaylist === playlist.id}
                                                    className="px-4 py-2 bg-hud-accent-primary/10 border border-hud-accent-primary/30 rounded-lg text-xs text-hud-accent-primary hover:bg-hud-accent-primary/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    {importingPlaylist === playlist.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Download className="w-3.5 h-3.5" />
                                                    )}
                                                    가져오기
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* YouTube Music Section */}
                <section className="hud-card rounded-xl p-6 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-[#FF0000] rounded-lg flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-hud-text-primary">YouTube Music</h2>
                            <p className="text-sm text-hud-text-muted">YouTube Music 플레이리스트 가져오기</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-hud-bg-secondary rounded-lg">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#FF0000]/20 rounded-full flex items-center justify-center">
                                <Music className="w-6 h-6 text-[#FF0000]" />
                            </div>
                            <div>
                                <p className="text-sm text-hud-text-primary">연결 안됨</p>
                                <p className="text-xs text-hud-text-muted">Google OAuth 설정 필요</p>
                            </div>
                        </div>
                        <button
                            disabled
                            className="px-4 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-muted cursor-not-allowed"
                        >
                            준비 중
                        </button>
                    </div>
                </section>

                {/* Tidal Section */}
                <section className="hud-card rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">T</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-hud-text-primary">Tidal</h2>
                            <p className="text-sm text-hud-text-muted">External Music Space에서 연동</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-hud-bg-secondary rounded-lg">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold">T</span>
                            </div>
                            <div>
                                <p className="text-sm text-hud-text-primary">EMS 페이지에서 연동</p>
                                <p className="text-xs text-hud-text-muted">The Cargo에서 Tidal 계정 연결</p>
                            </div>
                        </div>
                        <a
                            href="/music/external-space"
                            className="px-4 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-sm text-hud-text-secondary hover:text-hud-text-primary transition-all"
                        >
                            EMS로 이동
                        </a>
                    </div>
                </section>
            </main>
        </div>
    )
}

export default MusicSettings
