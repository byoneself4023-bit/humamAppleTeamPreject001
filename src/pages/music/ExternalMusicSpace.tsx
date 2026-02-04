import UploadZone from '../../components/music/UploadZone'
import PlaylistDetailModal from '../../components/music/PlaylistDetailModal'
import MusicPlayer from '../../components/music/MusicPlayer'
import {
    EMSYoutubePick,
    EMSPlatformBest,
    EMSRecommendations,
    EMSMusicSearch,
    EMSPlaylistTable,
    EMSCartDrawer
} from '../../components/music/ems'
import { Filter, Sparkles, Plus, Link as LinkIcon } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { playlistsApi, analysisApi, Playlist as ApiPlaylist } from '../../services/api/playlists'
import { tidalApi } from '../../services/api/tidal'
import { youtubeApi, YoutubePlaylist } from '../../services/api/youtube'
import { itunesService, ItunesTrack, ItunesCollection } from '../../services/api/itunes'
import { appleMusicApi, AppleMusicItem } from '../../services/api/apple'

interface Playlist {
    id: number
    name: string
    source: string
    trackCount: number
    status: 'unverified' | 'processing' | 'ready'
    addedDate: string
}

// Map API response to UI format
const mapApiPlaylist = (p: ApiPlaylist): Playlist => {
    let source = 'tidal'
    if (p.sourceType === 'Upload') source = 'file'
    else if (p.sourceType === 'Platform') {
        const lowerDesc = (p.description || '').toLowerCase()
        if (lowerDesc.includes('youtube')) source = 'youtube'
        else if (lowerDesc.includes('apple') || lowerDesc.includes('itunes')) source = 'apple'
        else source = 'tidal'
    } else {
        source = 'url'
    }

    return {
        id: p.id,
        name: p.title,
        source,
        trackCount: p.trackCount || 0,
        status: p.status === 'PTP' ? 'unverified' : p.status === 'PRP' ? 'processing' : 'ready',
        addedDate: new Date(p.createdAt).toLocaleDateString('ko-KR')
    }
}

const ExternalMusicSpace = () => {
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [tidalConnected, setTidalConnected] = useState(false)
    const [tidalUserLoggedIn, setTidalUserLoggedIn] = useState(false)
    const [youtubeConnected, setYoutubeConnected] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null)

    // Music Search & Apple Music State
    const [trackSearchTerm, setTrackSearchTerm] = useState('')
    const [trackResults, setTrackResults] = useState<ItunesTrack[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [newReleases, setNewReleases] = useState<{ songs: AppleMusicItem[], playlists: AppleMusicItem[], albums: AppleMusicItem[] }>({ songs: [], playlists: [], albums: [] })
    const [isAutoImporting, setIsAutoImporting] = useState(false)

    // Recommendations State
    const [recommendations, setRecommendations] = useState<ItunesCollection[]>([])
    const [classicRecs, setClassicRecs] = useState<ItunesCollection[]>([])
    const [jazzRecs, setJazzRecs] = useState<ItunesCollection[]>([])
    const [kpopRecs, setKpopRecs] = useState<ItunesCollection[]>([])

    // Toast notification state
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    // Spotify Special Event State
    const [spotifySpecial, setSpotifySpecial] = useState<{
        event: { title: string; subtitle: string; description: string };
        stats: { totalPlaylists: number; totalTracks: number; hotTracks: number };
        categories: Record<string, any[]>;
        hotTracks: any[];
        playlists: any[];
    } | null>(null)

    // YouTube Search State
    const [youtubeSearchTerm, setYoutubeSearchTerm] = useState('')
    const [youtubeResults, setYoutubeResults] = useState<YoutubePlaylist[]>([])
    const [isYoutubeSearching, setIsYoutubeSearching] = useState(false)
    const [viewingYoutubeId, setViewingYoutubeId] = useState<string | null>(null)

    // Track Cart State
    const [cartTracks, setCartTracks] = useState<ItunesTrack[]>([])
    const [isCartOpen, setIsCartOpen] = useState(false)

    // AI State
    const [analyzingId, setAnalyzingId] = useState<number | null>(null)
    const [isModalLoading, setIsModalLoading] = useState(false)

    const [seedAttempted, setSeedAttempted] = useState(false)
    const [tidalSyncDone, setTidalSyncDone] = useState(false)

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    // Fetch playlists from API
    const fetchPlaylists = useCallback(async (skipSeed = false) => {
        try {
            setLoading(true)
            setError(null)

            if (!skipSeed && !seedAttempted) {
                setSeedAttempted(true)
                try {
                    const seedResult = await playlistsApi.seedPlaylists()
                    if (seedResult?.imported && seedResult.imported > 0) {
                        showToast(`${seedResult.imported}개 플레이리스트 자동 로드 완료!`, 'success')
                    }
                } catch (seedErr) {
                    console.log('Seed skipped:', seedErr)
                }
            }

            const response = await playlistsApi.getPlaylists('EMS')
            const playlists = response?.playlists || []
            setPlaylists(playlists.map(mapApiPlaylist))
        } catch (err) {
            console.error('Failed to fetch playlists:', err)
            setError('플레이리스트를 불러오는데 실패했습니다')
            setPlaylists([])
        } finally {
            setLoading(false)
        }
    }, [seedAttempted])

    const checkConnections = useCallback(async () => {
        try {
            const tidal = await tidalApi.getAuthStatus()
            setTidalConnected(tidal.authenticated)
            setTidalUserLoggedIn(tidal.userConnected || false)

            const youtube = await youtubeApi.getAuthStatus()
            setYoutubeConnected(youtube.authenticated)
        } catch (err) {
            console.error('Failed to check connection status:', err)
        }
    }, [])

    useEffect(() => {
        fetchPlaylists()
        checkConnections()
    }, [fetchPlaylists, checkConnections])

    // Load Spotify Special Event
    useEffect(() => {
        const fetchSpotifySpecial = async () => {
            try {
                const res = await fetch('/api/ems/spotify-special')
                if (res.ok) {
                    const data = await res.json()
                    setSpotifySpecial(data)
                }
            } catch (e) {
                console.error('Failed to load Spotify Special:', e)
            }
        }
        fetchSpotifySpecial()
    }, [])

    // Load Apple Music New Releases AND Auto-Import to DB
    useEffect(() => {
        const loadAndImportAppleNew = async () => {
            try {
                const data = await appleMusicApi.getNewReleases()
                setNewReleases(data as any)

                if (data.songs.length > 0 || data.playlists.length > 0) {
                    setIsAutoImporting(true)
                    showToast('Apple Music 데이터를 DB에 자동 저장 중...', 'success')

                    let importedCount = 0

                    for (const playlist of data.playlists) {
                        try {
                            const createResult = await playlistsApi.importPlaylist({
                                platformPlaylistId: playlist.id,
                                title: playlist.attributes.name,
                                description: playlist.attributes.editorialNotes?.short || 'Apple Music Auto-Import',
                                coverImage: playlist.attributes.artwork?.url.replace('{w}', '600').replace('{h}', '600').replace('{c}', 'bb').replace('{f}', 'jpg'),
                                platform: 'Apple Music'
                            })
                            importedCount++

                            try {
                                const tracksData = await appleMusicApi.getTracks(playlist.id, 'playlists')
                                for (const t of tracksData) {
                                    if (t.type === 'songs') {
                                        await playlistsApi.addTrack(createResult.playlist.id, {
                                            title: t.attributes.name,
                                            artist: t.attributes.artistName,
                                            album: t.attributes.albumName || '',
                                            artwork: t.attributes.artwork?.url.replace('{w}', '300').replace('{h}', '300').replace('{c}', 'bb').replace('{f}', 'jpg'),
                                            externalMetadata: {
                                                appleMusicId: t.id,
                                                previewUrl: (t.attributes.previews && t.attributes.previews[0]) ? t.attributes.previews[0].url : undefined
                                            }
                                        })
                                    }
                                }
                            } catch (e) { console.warn('Track import failed for playlist', playlist.id) }
                        } catch (e) { /* Ignore duplicates */ }
                    }

                    if (data.songs.length > 0) {
                        try {
                            const today = new Date().toLocaleDateString('ko-KR')
                            const chartPlaylist = await playlistsApi.create({
                                title: `Apple Music Top 20 (${today})`,
                                description: 'Auto-imported Top Charts',
                                sourceType: 'Platform',
                                spaceType: 'EMS',
                                status: 'PTP',
                                coverImage: data.songs[0].attributes.artwork?.url.replace('{w}', '600').replace('{h}', '600').replace('{c}', 'bb').replace('{f}', 'jpg')
                            })

                            for (const song of data.songs) {
                                await playlistsApi.addTrack(chartPlaylist.id, {
                                    title: song.attributes.name,
                                    artist: song.attributes.artistName,
                                    album: song.attributes.albumName,
                                    artwork: song.attributes.artwork?.url.replace('{w}', '300').replace('{h}', '300').replace('{c}', 'bb').replace('{f}', 'jpg'),
                                    externalMetadata: {
                                        appleMusicId: song.id,
                                        previewUrl: (song.attributes.previews && song.attributes.previews[0]) ? song.attributes.previews[0].url : undefined
                                    }
                                })
                            }
                            importedCount++
                        } catch (e) { console.warn('Chart playlist creation failed', e) }
                    }

                    if (importedCount > 0) {
                        showToast(`Apple Music 데이터 ${importedCount}개 세트 DB 저장 완료`, 'success')
                        fetchPlaylists(true)
                    }
                    setIsAutoImporting(false)
                }
            } catch (e) {
                console.error('Failed to load/import Apple Music:', e)
                setIsAutoImporting(false)
            }
        }
        loadAndImportAppleNew()
    }, [])

    // Load Recommendations
    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                const [mixed, classic, jazz, kpop] = await Promise.all([
                    itunesService.getRecommendations(),
                    itunesService.getRecommendations('Classical'),
                    itunesService.getRecommendations('Vocal Jazz'),
                    itunesService.getRecommendations('K-Pop')
                ])
                setRecommendations(mixed)
                setClassicRecs(classic)
                setJazzRecs(jazz)
                setKpopRecs(kpop)
            } catch (err) {
                console.error('Failed to load recommendations', err)
            }
        }
        fetchRecommendations()
    }, [])

    // Tidal Sync
    const handleTidalSync = async () => {
        if (!tidalUserLoggedIn) return
        setSyncing(true)
        try {
            const response = await tidalApi.getFeatured()
            const featuredPlaylists = response.featured.flatMap(f => f.playlists)

            for (const p of featuredPlaylists) {
                try {
                    await playlistsApi.importPlaylist({
                        platformPlaylistId: p.uuid,
                        title: p.title,
                        description: p.description || `Imported from Tidal (${p.creator?.name || 'Unknown'})`,
                        coverImage: p.squareImage,
                        platform: 'Tidal'
                    })
                } catch (err: any) {
                    if (err.response?.status !== 409) console.error(err)
                }
            }
            await fetchPlaylists(true)
        } catch (err) {
            console.error('Tidal Sync failed:', err)
        } finally {
            setSyncing(false)
        }
    }

    // Train Model
    const trainModel = async () => {
        try {
            await analysisApi.train()
            console.log('AI Model Retrained')
        } catch (err) {
            console.error('Training failed', err)
        }
    }

    useEffect(() => {
        const syncAndTrain = async () => {
            if (tidalConnected && !syncing && !tidalSyncDone) {
                setTidalSyncDone(true)
                await handleTidalSync()
                await trainModel()
            }
        }
        if (tidalUserLoggedIn && !tidalSyncDone) {
            syncAndTrain()
        }
    }, [tidalUserLoggedIn, tidalConnected, syncing, tidalSyncDone])

    // Handlers
    const handleDelete = async (id: number) => {
        try {
            await playlistsApi.deletePlaylist(id)
            setPlaylists(prev => prev.filter(p => p.id !== id))
            setSelectedIds(prev => prev.filter(sid => sid !== id))
        } catch (err) {
            console.error('Delete failed:', err)
        }
    }

    const handleSelectAll = (checked: boolean) => {
        setSelectedIds(checked ? playlists.map(p => p.id) : [])
    }

    const handleSelectRow = (id: number, checked: boolean) => {
        setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(sid => sid !== id))
    }

    const handleAnalyze = async (id: number) => {
        setAnalyzingId(id)
        try {
            const result = await analysisApi.evaluate(id)
            if (result.score >= 70) {
                await playlistsApi.moveToSpace(id, 'GMS')
                await playlistsApi.updateStatus(id, 'PTP')
                showToast(`AI 추천 성공! GMS로 이동되었습니다. (${result.grade}등급, ${result.score}점)`, 'success')
                setPlaylists(prev => prev.filter(p => p.id !== id))
            } else {
                showToast(`AI 분석 완료: ${result.grade}등급 (${result.score}점) - 보류됨`, 'success')
                fetchPlaylists(true)
            }
        } catch (err) {
            console.error('Analysis failed', err)
            showToast('분석 실패', 'error')
        } finally {
            setAnalyzingId(null)
        }
    }

    // YouTube handlers
    const handleYoutubeSearch = async () => {
        if (!youtubeSearchTerm.trim()) return
        setIsYoutubeSearching(true)
        try {
            const response = await youtubeApi.searchPlaylists(youtubeSearchTerm)
            setYoutubeResults(response?.playlists || [])
        } catch (err) {
            console.error('YouTube search failed:', err)
            showToast('YouTube 검색 실패', 'error')
            setYoutubeResults([])
        } finally {
            setIsYoutubeSearching(false)
        }
    }

    const handleViewYoutubeDetail = async (playlist: YoutubePlaylist) => {
        setViewingYoutubeId(playlist.id)
        let targetId: number | null = null
        const match = playlists.find(p => p.name === playlist.title)

        if (match) {
            targetId = match.id
        } else {
            try {
                showToast(`'${playlist.title}' 정보를 저장 중...`, 'success')
                const result = await playlistsApi.importPlaylist({
                    platformPlaylistId: playlist.id,
                    title: playlist.title,
                    description: playlist.description || `Imported from YouTube (${playlist.channelTitle})`,
                    coverImage: playlist.thumbnail,
                    platform: 'YouTube'
                })
                targetId = result.playlist.id
                setYoutubeResults(prev => prev.filter(p => p.id !== playlist.id))
                await fetchPlaylists(true)
            } catch (err: any) {
                if (err.message?.includes('409') || err.response?.status === 409) {
                    const refreshed = await playlistsApi.getPlaylists('EMS')
                    const found = refreshed.playlists.find(p => p.title === playlist.title)
                    if (found) targetId = found.id
                } else {
                    console.error('YouTube import for view failed', err)
                    showToast('상세 보기 실패', 'error')
                    setViewingYoutubeId(null)
                    return
                }
            }
        }
        setViewingYoutubeId(null)
        if (targetId) setSelectedDetailId(targetId)
    }

    // Music search handlers
    const handleSearch = async () => {
        if (!trackSearchTerm.trim()) return
        setIsSearching(true)
        try {
            const results = await itunesService.search(trackSearchTerm)
            setTrackResults(results)
        } catch (err) {
            console.error(err)
            showToast('음악 검색 실패', 'error')
        } finally {
            setIsSearching(false)
        }
    }

    // Cart handlers
    const addToCart = (track: ItunesTrack) => {
        if (cartTracks.some(t => t.id === track.id)) {
            showToast('이미 카트에 담긴 곡입니다.', 'error')
            return
        }
        setCartTracks(prev => [...prev, track])
        showToast('카트에 담았습니다.', 'success')
    }

    const removeFromCart = (trackId: number) => {
        setCartTracks(prev => prev.filter(t => t.id !== trackId))
    }

    const saveCartToPlaylist = async () => {
        if (cartTracks.length === 0) return
        try {
            const today = new Date().toLocaleDateString('ko-KR')
            const title = `EMS Collection (${today})`
            const createResult = await playlistsApi.create({
                title: title,
                description: `Created from EMS Search Cart (${cartTracks.length} tracks)`,
                sourceType: 'Upload',
                spaceType: 'EMS',
                status: 'PTP',
                coverImage: cartTracks[0].artwork
            })

            let successCount = 0
            for (const track of cartTracks) {
                await playlistsApi.addTrack(createResult.id, {
                    title: track.title,
                    artist: track.artist,
                    album: track.album,
                    artwork: track.artwork,
                    externalMetadata: {
                        appleMusicId: track.id.toString(),
                        previewUrl: track.previewUrl
                    }
                })
                successCount++
            }

            showToast(`'${title}' 생성 완료 (${successCount}곡)`, 'success')
            setCartTracks([])
            setIsCartOpen(false)
            fetchPlaylists(true)
        } catch (err) {
            console.error('Save cart failed', err)
            showToast('저장 실패', 'error')
        }
    }

    // Collection detail handler
    const handleViewCollectionDetail = async (collection: ItunesCollection) => {
        setIsModalLoading(true)
        setSelectedDetailId(null)
        let targetId: number | null = null
        const match = playlists.find(p => p.name === collection.title)

        if (match) {
            targetId = match.id
        } else {
            try {
                const albumDetails = await itunesService.getAlbum(collection.id)
                const result = await playlistsApi.importAlbumAsPlaylist({
                    title: collection.title,
                    artist: collection.artist,
                    coverImage: collection.artwork,
                    tracks: albumDetails.tracks
                })
                targetId = result.playlist.id
                setRecommendations(prev => prev.filter(r => r.id !== collection.id))
                setClassicRecs(prev => prev.filter(r => r.id !== collection.id))
                setJazzRecs(prev => prev.filter(r => r.id !== collection.id))
                setKpopRecs(prev => prev.filter(r => r.id !== collection.id))
                fetchPlaylists(true)
            } catch (err: any) {
                if (err.message?.includes('409') || err.response?.status === 409) {
                    const refreshed = await playlistsApi.getPlaylists('EMS')
                    const found = refreshed.playlists.find(p => p.title === collection.title)
                    if (found) targetId = found.id
                } else {
                    console.error('Import for view failed', err)
                    showToast('상세 보기 실패', 'error')
                    setIsModalLoading(false)
                    return
                }
            }
        }
        if (targetId) setSelectedDetailId(targetId)
        setIsModalLoading(false)
    }

    // File Upload
    const handleFileUpload = async (files: FileList) => {
        if (files.length === 0) return
        const file = files[0]
        const reader = new FileReader()

        reader.onload = async (e) => {
            const text = e.target?.result as string
            if (!text) return

            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
            const tracksToImport: { title: string, artist: string }[] = []

            lines.forEach(line => {
                if (line.toLowerCase().includes('track name') || line.toLowerCase().includes('artist name')) return
                let artist = 'Unknown Artist'
                let title = line
                if (line.includes(',')) {
                    const parts = line.split(',')
                    if (parts.length >= 2) {
                        title = parts[0].trim().replace(/^"|"$/g, '')
                        artist = parts[1].trim().replace(/^"|"$/g, '')
                    }
                } else if (line.includes(' - ')) {
                    const parts = line.split(' - ')
                    artist = parts[0].trim()
                    title = parts.slice(1).join(' - ').trim()
                }
                if (title) tracksToImport.push({ title, artist })
            })

            if (tracksToImport.length === 0) {
                showToast('파일에서 트랙을 찾을 수 없습니다.', 'error')
                return
            }

            try {
                showToast(`${tracksToImport.length}곡을 포함한 플레이리스트 생성 중...`, 'success')
                const playlistName = file.name.replace(/\.[^/.]+$/, "")
                const createResult = await playlistsApi.create({
                    title: playlistName,
                    description: `Imported from file: ${file.name}`,
                    sourceType: 'Upload',
                    spaceType: 'EMS',
                    status: 'PTP'
                })

                let successCount = 0
                for (const track of tracksToImport) {
                    try {
                        await playlistsApi.addTrack(createResult.id, {
                            title: track.title,
                            artist: track.artist,
                            album: 'Imported',
                            duration: 0
                        })
                        successCount++
                    } catch (err) { console.warn('Failed to add track:', track, err) }
                }

                showToast(`'${playlistName}' 생성 완료 (${successCount}/${tracksToImport.length}곡)`, 'success')
                fetchPlaylists(true)
            } catch (err) {
                console.error('File import failed:', err)
                showToast('파일 가져오기 실패', 'error')
            }
        }
        reader.readAsText(file)
    }

    return (
        <div className="p-4 md:p-6">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-hud-accent-warning mb-2">The Cargo</h1>
                <p className="text-hud-text-secondary mb-6">외부에서 가져온 검증되지 않은 플레이리스트를 수집하고 관리합니다</p>

                <div className="flex gap-3">
                    <button className="bg-hud-bg-secondary border border-hud-border-secondary text-hud-text-primary px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-hud-bg-hover transition-all">
                        <Filter className="w-4 h-4" />
                        Advanced Filter
                    </button>
                    <button
                        onClick={() => document.getElementById('fileInput')?.click()}
                        className="bg-hud-accent-warning text-hud-bg-primary px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-hud-accent-warning/90 transition-all">
                        <LinkIcon className="w-4 h-4" />
                        Upload Files
                    </button>
                </div>
            </header>

            <UploadZone onFilesSelected={handleFileUpload} />

            {/* New Releases */}
            {newReleases.songs.length > 0 && (
                <section className="hud-card hud-card-bottom rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-3 mb-6">
                        <Sparkles className="w-5 h-5 text-pink-500" />
                        최신 인기 차트 (Apple Music Top 10)
                        <span className="text-sm font-normal text-hud-text-muted ml-2">(KR Store Real-time)</span>
                    </h2>
                    <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar">
                        {newReleases.songs.map((song) => (
                            <div key={song.id} className="min-w-[160px] w-[160px] bg-hud-bg-secondary border border-hud-border-secondary rounded-lg p-3 hover:border-pink-500/50 transition-all group">
                                <div className="relative aspect-square mb-3 rounded-md overflow-hidden">
                                    <img src={song.attributes.artwork?.url.replace('{w}', '300').replace('{h}', '300').replace('{c}', 'bb').replace('{f}', 'jpg')} alt={song.attributes.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={() => addToCart({
                                                id: parseInt(song.id),
                                                title: song.attributes.name,
                                                artist: song.attributes.artistName || 'Unknown',
                                                album: song.attributes.name,
                                                artwork: song.attributes.artwork?.url.replace('{w}', '300').replace('{h}', '300').replace('{c}', 'bb').replace('{f}', 'jpg') || '',
                                                url: song.attributes.url,
                                                date: song.attributes.releaseDate || '',
                                                audio: '',
                                                previewUrl: (song.attributes.previews && song.attributes.previews[0]) ? song.attributes.previews[0].url : undefined
                                            })}
                                            className="bg-pink-500 text-white p-2 rounded-full transform translate-y-2 group-hover:translate-y-0 transition-all hover:bg-pink-600"
                                            title="카트에 담기"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="font-bold text-hud-text-primary truncate text-sm" title={song.attributes.name}>{song.attributes.name}</div>
                                <div className="text-xs text-hud-text-secondary truncate">{song.attributes.artistName}</div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Spotify Special */}
            <EMSPlatformBest
                spotifySpecial={spotifySpecial}
                onSelectPlaylist={setSelectedDetailId}
            />

            {/* Recommendations */}
            <EMSRecommendations
                recommendations={recommendations}
                classicRecs={classicRecs}
                jazzRecs={jazzRecs}
                kpopRecs={kpopRecs}
                onViewDetail={handleViewCollectionDetail}
            />

            {/* YouTube Search */}
            <EMSYoutubePick
                youtubeConnected={youtubeConnected}
                youtubeSearchTerm={youtubeSearchTerm}
                setYoutubeSearchTerm={setYoutubeSearchTerm}
                youtubeResults={youtubeResults}
                isYoutubeSearching={isYoutubeSearching}
                viewingYoutubeId={viewingYoutubeId}
                onSearch={handleYoutubeSearch}
                onViewDetail={handleViewYoutubeDetail}
            />

            {/* Music Search */}
            <EMSMusicSearch
                trackSearchTerm={trackSearchTerm}
                setTrackSearchTerm={setTrackSearchTerm}
                trackResults={trackResults}
                isSearching={isSearching}
                onSearch={handleSearch}
                onAddToCart={addToCart}
            />

            {/* Playlist Table */}
            <EMSPlaylistTable
                playlists={playlists}
                selectedIds={selectedIds}
                analyzingId={analyzingId}
                searchTerm={searchTerm}
                onSelectAll={handleSelectAll}
                onSelectRow={handleSelectRow}
                onDelete={handleDelete}
                onAnalyze={handleAnalyze}
                onViewDetail={setSelectedDetailId}
            />

            {/* Cart Drawer */}
            <EMSCartDrawer
                cartTracks={cartTracks}
                isCartOpen={isCartOpen}
                setIsCartOpen={setIsCartOpen}
                onRemoveFromCart={removeFromCart}
                onSaveToPlaylist={saveCartToPlaylist}
            />

            {/* Modals */}
            {(selectedDetailId || isModalLoading) && (
                <PlaylistDetailModal
                    playlistId={selectedDetailId}
                    isOpen={true}
                    onClose={() => {
                        setSelectedDetailId(null)
                        setIsModalLoading(false)
                    }}
                />
            )}

            <MusicPlayer />
        </div>
    )
}

export default ExternalMusicSpace
