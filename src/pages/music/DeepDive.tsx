import { useState, useEffect } from 'react'
import { Search, Sparkles, Send, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { post } from '../../services/api' // Fixed import

interface DeepDiveProps { }

interface Track {
    track_id: string
    artist: string
    title: string
    genre: string
    tags: string
    similarity_score: number // Changed float to number
    explanation?: string
    audio_features?: {
        energy: number // Changed float to number
        valence: number // Changed float to number
    }
}

interface SearchResponse {
    success: boolean
    tracks: Track[]
    analyzed_query?: string
    detected_emotion?: string
    error?: string
}

const DeepDive = ({ }: DeepDiveProps) => {
    const [query, setQuery] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [results, setResults] = useState<Track[]>([])
    const [analyzedInfo, setAnalyzedInfo] = useState<{ query: string, emotion: string } | null>(null)
    const [searchError, setSearchError] = useState<string | null>(null)

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!query.trim()) return

        setIsLoading(true)
        setSearchError(null)
        setResults([])
        setAnalyzedInfo(null)

        try {
            // Using the new L2 endpoint (proxied via Spring Boot or Direct)
            // For simulation, we assume Spring Boot proxies /api/llm/search
            const response = await post<SearchResponse>('/llm/search', {
                query: query,
                page: 1,
                include_explanation: true
            })

            if (response.success) {
                setResults(response.tracks)
                if (response.analyzed_query) {
                    setAnalyzedInfo({
                        query: response.analyzed_query,
                        emotion: response.detected_emotion || 'neutral'
                    })
                }
            } else {
                setSearchError(response.error || '검색에 실패했습니다.')
            }
        } catch (error) {
            console.error("Deep Dive Search Error:", error)
            setSearchError("서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.")
        } finally {
            setIsLoading(false)
        }
    }

    const placeholders = [
        "비오는 날 카페에서 들을 잔잔한 재즈...",
        "운동할 때 에너지를 주는 신나는 팝...",
        "새벽 감성에 어울리는 어쿠스틱...",
        "집중해서 코딩할 때 듣는 Lo-Fi..."
    ]

    const [placeholderIndex, setPlaceholderIndex] = useState(0)

    // Placeholder rotation effect
    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % placeholders.length)
        }, 3000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen">
            {/* Header Section */}
            <div className="text-center mb-12 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-hud-accent-purple/5 blur-[100px] -z-10" />
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-hud-accent-purple via-hud-text-primary to-hud-accent-purple bg-clip-text text-transparent mb-4 flex items-center justify-center gap-4">
                        <Sparkles className="w-10 h-10 text-hud-accent-purple" />
                        Deep Dive
                        <Sparkles className="w-10 h-10 text-hud-accent-purple" />
                    </h1>
                    <p className="text-xl text-hud-text-secondary">
                        당신의 상황과 감정을 입력하세요. AI가 음악의 깊은 곳까지 탐해드립니다.
                    </p>
                </motion.div>
            </div>

            {/* Search Bar */}
            <div className="max-w-3xl mx-auto mb-16 relative z-10">
                <form onSubmit={handleSearch} className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-hud-accent-purple to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                    <div className="relative bg-hud-bg-secondary border border-hud-border-secondary rounded-2xl p-2 flex items-center shadow-2xl transition-all group-hover:border-hud-accent-purple/50">
                        <Search className="w-8 h-8 text-hud-text-muted ml-4" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={placeholders[placeholderIndex]}
                            className="w-full bg-transparent border-none text-xl text-hud-text-primary placeholder:text-hud-text-muted/50 focus:ring-0 px-6 py-4"
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-hud-accent-purple hover:bg-hud-accent-purple/80 text-white p-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                        </button>
                    </div>
                </form>

                {/* Analyzed Info Badge */}
                <AnimatePresence>
                    {analyzedInfo && !isLoading && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mt-4 flex justify-center gap-2"
                        >
                            <span className="px-3 py-1 bg-hud-bg-tertiary rounded-full text-xs text-hud-text-secondary border border-hud-border-secondary">
                                🔍 Translated: <span className="text-hud-accent-info">{analyzedInfo.query}</span>
                            </span>
                            <span className="px-3 py-1 bg-hud-bg-tertiary rounded-full text-xs text-hud-text-secondary border border-hud-border-secondary">
                                🎭 Emotion: <span className="text-hud-accent-purple">{analyzedInfo.emotion}</span>
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto">
                {searchError && (
                    <div className="text-center text-hud-accent-danger p-8 bg-hud-accent-danger/5 rounded-xl border border-hud-accent-danger/20">
                        {searchError}
                    </div>
                )}

                <AnimatePresence mode="popLayout">
                    {results.map((track, index) => (
                        <motion.div
                            key={track.track_id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{
                                opacity: 1,
                                x: 0,
                                transition: { delay: index * 0.1 }
                            }}
                            className="bg-hud-bg-card/50 backdrop-blur-sm border border-hud-border-secondary rounded-xl p-6 hover:bg-hud-bg-card hover:border-hud-accent-purple/30 transition-all group"
                        >
                            <div className="flex gap-6 items-start">
                                {/* Rank/Similarity Badge */}
                                <div className="flex flex-col items-center gap-2 min-w-[60px]">
                                    <span className="text-2xl font-bold text-hud-text-secondary/50">#{index + 1}</span>
                                    <div className="px-2 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/20">
                                        {Math.round(track.similarity_score * 100)}%
                                    </div>
                                </div>

                                {/* Track Info */}
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="text-xl font-bold text-hud-text-primary group-hover:text-hud-accent-purple transition-colors">
                                                {track.title}
                                            </h3>
                                            <p className="text-hud-text-secondary">{track.artist}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="px-2 py-1 rounded-md bg-hud-bg-tertiary text-xs text-hud-text-muted border border-hud-border-secondary">
                                                {track.genre}
                                            </span>
                                        </div>
                                    </div>

                                    {/* AI Explanation Bubble */}
                                    {track.explanation && (
                                        <div className="relative mt-4 bg-hud-accent-purple/5 border border-hud-accent-purple/10 rounded-lg p-4">
                                            <div className="absolute -top-2 left-6 w-4 h-4 bg-hud-accent-purple/5 border-t border-l border-hud-accent-purple/10 transform rotate-45 z-0" />
                                            <div className="relative z-10 flex gap-3">
                                                <Sparkles className="w-5 h-5 text-hud-accent-purple shrink-0 mt-0.5" />
                                                <p className="text-sm text-hud-text-primary leading-relaxed">
                                                    {track.explanation}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Audio Features Visual (Mini) */}
                                    {track.audio_features && (
                                        <div className="mt-4 flex gap-4 text-xs text-hud-text-muted">
                                            <div className="flex items-center gap-1">
                                                <div className="w-16 h-1 bg-hud-bg-tertiary rounded-full overflow-hidden">
                                                    <div className="h-full bg-yellow-500" style={{ width: `${track.audio_features.energy * 100}%` }} />
                                                </div>
                                                <span>Energy</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="w-16 h-1 bg-hud-bg-tertiary rounded-full overflow-hidden">
                                                    <div className="h-full bg-pink-500" style={{ width: `${track.audio_features.valence * 100}%` }} />
                                                </div>
                                                <span>Mood</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}

export default DeepDive
