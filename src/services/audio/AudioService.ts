import ReactPlayer from 'react-player'
import { API_BASE_URL } from '../api/index'
import { youtubeApi } from '../api/youtube'
import * as TidalAdapter from './TidalPlayerAdapter'

// Audio Source Types
export type AudioSourceType = 'YOUTUBE' | 'FILE' | 'TIDAL' | 'ITUNES_PREVIEW' | 'UNKNOWN'

// Interface for currently playing audio
export interface AudioState {
    isPlaying: boolean
    currentTime: number
    duration: number
    volume: number
    isBuffering: boolean
    sourceType: AudioSourceType
    error: string | null
}

class AudioService {
    private static instance: AudioService
    private player: any | null = null
    public state: AudioState = {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 0.7,
        isBuffering: false,
        sourceType: 'UNKNOWN',
        error: null
    }

    // Listeners
    private listeners: ((state: AudioState) => void)[] = []

    private constructor() { }

    public static getInstance(): AudioService {
        if (!AudioService.instance) {
            AudioService.instance = new AudioService()
        }
        return AudioService.instance
    }

    // Set ReactPlayer reference
    public setPlayer(player: any | null) {
        this.player = player
    }

    public subscribe(listener: (state: AudioState) => void) {
        this.listeners.push(listener)
        // Send current state immediately
        listener(this.state)
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private updateState(updates: Partial<AudioState>) {
        this.state = { ...this.state, ...updates }
        this.listeners.forEach(l => l(this.state))
    }

    // Controls
    public async play() {
        if (this.state.sourceType === 'TIDAL') {
            await TidalAdapter.resumeTidal()
        }
        this.updateState({ isPlaying: true })
    }

    public async pause() {
        if (this.state.sourceType === 'TIDAL') {
            await TidalAdapter.pauseTidal()
        }
        this.updateState({ isPlaying: false })
    }

    public async togglePlay() {
        if (this.state.isPlaying) {
            await this.pause()
        } else {
            await this.play()
        }
    }

    public async seekTo(seconds: number) {
        if (this.state.sourceType === 'TIDAL') {
            await TidalAdapter.seekTidal(seconds)
        } else if (this.player) {
            this.player.seekTo(seconds, 'seconds')
        }
        this.updateState({ currentTime: seconds })
    }

    public async setVolume(volume: number) { // 0 to 1
        if (this.state.sourceType === 'TIDAL') {
            await TidalAdapter.setTidalVolume(volume)
        }
        this.updateState({ volume })
    }

    // Handlers for ReactPlayer events - Arrow functions to bind 'this' automatically
    public onProgress = (state: { playedSeconds: number }) => {
        if (!this.state.isBuffering) {
            this.updateState({ currentTime: state.playedSeconds })
        }
    }

    public onDuration = (duration: number) => {
        this.updateState({ duration })
    }

    public onBuffer = () => {
        this.updateState({ isBuffering: true })
    }

    public onBufferEnd = () => {
        this.updateState({ isBuffering: false })
    }

    public onError = (error: any) => {
        this.updateState({ error: 'Playback error', isPlaying: false })
        console.error('AudioService Error:', error)
    }

    // Helper to determine source type
    public getSourceType(track: any): AudioSourceType {
        if (track.sourceType === 'TIDAL' || (track.original_playlist_source === 'Tidal')) return 'TIDAL'
        if (track.url?.includes('youtube.com') || track.url?.includes('youtu.be')) return 'YOUTUBE'
        if (track.url?.includes('audio-ssl.itunes.apple.com')) return 'ITUNES_PREVIEW'
        return 'UNKNOWN'
    }

    public async resolveAndPlay(track: any) {
        let url: string | null = null
        let error: string | null = null
        const sourceType = this.getSourceType(track)

        console.log(`[AudioService] Resolving playback for: "${track.title}" by ${track.artist}`)

        // === PRIORITY 1: iTunes Preview (Fastest, most reliable) ===
        const previewUrl = track.externalMetadata?.previewUrl || track.previewUrl || track.audio
        if (previewUrl && previewUrl.includes('audio-ssl.itunes.apple.com')) {
            console.log('[AudioService] Using iTunes Preview URL')
            this.updateState({
                sourceType: 'ITUNES_PREVIEW',
                isBuffering: true,
                error: null
            })
            return previewUrl
        }

        // === PRIORITY 2: Existing YouTube ID ===
        if (track.externalMetadata?.youtubeId) {
            url = `https://www.youtube.com/watch?v=${track.externalMetadata.youtubeId}`
            console.log('[AudioService] Using stored YouTube ID:', track.externalMetadata.youtubeId)
            this.updateState({
                sourceType: 'YOUTUBE',
                isBuffering: true,
                error: null
            })
            return url
        }

        // === PRIORITY 3: Direct URL ===
        if (track.url) {
            if (track.url.includes('youtube.com') || track.url.includes('youtu.be')) {
                console.log('[AudioService] Using direct YouTube URL')
                this.updateState({ sourceType: 'YOUTUBE', isBuffering: true, error: null })
                return track.url
            }
            if (track.url.includes('audio-ssl.itunes.apple.com')) {
                console.log('[AudioService] Using direct iTunes URL')
                this.updateState({ sourceType: 'ITUNES_PREVIEW', isBuffering: true, error: null })
                return track.url
            }
        }

        // === PRIORITY 4: Tidal Native Playback (If logged in) ===
        const tidalToken = localStorage.getItem('tidal_token')
        if ((sourceType === 'TIDAL' || tidalToken)) {
            console.log('[AudioService] Attempting Tidal Playback...')
            try {
                const player = await TidalAdapter.initTidalPlayer()
                if (player) {
                    let tidalId = track.sourceId || track.externalMetadata?.tidalId

                    // Search if no ID
                    if (!tidalId) {
                        try {
                            const query = `${track.artist} - ${track.title}`
                            const { tidalApi } = await import('../api/tidal')
                            const searchRes = await tidalApi.searchTracks(query, 1)
                            if (searchRes.tracks && searchRes.tracks.length > 0) {
                                tidalId = searchRes.tracks[0].id
                                console.log(`[AudioService] Found on Tidal: ${tidalId}`)
                            }
                        } catch (e) {
                            console.warn('[AudioService] Tidal search failed:', e)
                        }
                    }

                    if (tidalId) {
                        const success = await TidalAdapter.playTidalTrack(tidalId)
                        if (success) {
                            this.updateState({
                                sourceType: 'TIDAL',
                                isBuffering: false,
                                isPlaying: true,
                                error: null
                            })
                            return 'TIDAL_NATIVE'
                        }
                    }
                }
            } catch (e) {
                console.warn('[AudioService] Tidal playback failed:', e)
            }
        }

        // === PRIORITY 5: YouTube Smart Match (Fallback) ===
        this.updateState({ isBuffering: true, error: null })
        const searchQueries = [
            `${track.artist} - ${track.title} audio`,
            `${track.title} ${track.artist}`,
            `${track.title} official audio`
        ]

        for (const query of searchQueries) {
            try {
                console.log(`[SmartMatch] Trying: "${query}"`)
                const response = await youtubeApi.searchVideos(query, 1)

                if (response?.playlists && response.playlists.length > 0) {
                    const video = response.playlists[0]
                    url = `https://www.youtube.com/watch?v=${video.id}`
                    console.log(`[SmartMatch] Found: ${url}`)
                    this.updateState({
                        sourceType: 'YOUTUBE',
                        isBuffering: true,
                        error: null
                    })
                    return url
                }
            } catch (e) {
                console.warn(`[SmartMatch] Query failed: "${query}"`, e)
            }
        }

        // === NO SOURCE FOUND ===
        const errorMsg = sourceType === 'TIDAL'
            ? 'Tidal 로그인이 필요합니다'
            : `"${track.title}" 재생 소스를 찾을 수 없습니다`

        console.error('[AudioService] No playable source found')
        this.updateState({
            error: errorMsg,
            isPlaying: false,
            isBuffering: false
        })
        return null
    }
}

export const audioService = AudioService.getInstance()
