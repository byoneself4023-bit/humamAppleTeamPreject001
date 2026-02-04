import { useState, useEffect, useRef } from 'react'
import { X, ExternalLink, Loader2, Check } from 'lucide-react'
import { tidalApi } from '../../services/api/tidal'

interface TidalLoginModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: (response: any) => void
}

const TidalLoginModal = ({ isOpen, onClose, onSuccess }: TidalLoginModalProps) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [waitingForLogin, setWaitingForLogin] = useState(false)

    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const isMounted = useRef(true)

    useEffect(() => {
        isMounted.current = true
        return () => {
            isMounted.current = false
            stopWatching()
        }
    }, [])

    useEffect(() => {
        if (!isOpen) {
            resetState()
            stopWatching()
        }
    }, [isOpen])

    // Listen for postMessage from popup/tab
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'TIDAL_LOGIN_SUCCESS') {
                console.log('[TidalModal] Received login success via postMessage')
                handleLoginSuccess(event.data.response)
            }
        }

        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [onSuccess, onClose])

    const resetState = () => {
        setLoading(false)
        setError(null)
        setWaitingForLogin(false)
    }

    const stopWatching = () => {
        if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current)
            checkIntervalRef.current = null
        }
    }

    const handleLoginSuccess = (response: any) => {
        if (!isMounted.current) return

        stopWatching()

        // Store token for player usage
        if (response.access_token) {
            localStorage.setItem('tidal_token', response.access_token)
        }
        if (response.refresh_token) {
            localStorage.setItem('tidal_refresh_token', response.refresh_token)
        }

        onSuccess(response)
        onClose()
    }

    const openTidalLogin = async () => {
        try {
            setLoading(true)
            setError(null)

            // Clear any previous login result
            localStorage.removeItem('tidal_login_result')

            // Get OAuth URL from backend
            const authUrl = await tidalApi.getLoginUrl()

            if (!authUrl) {
                throw new Error('Failed to get Tidal login URL')
            }

            // Open in new tab (more reliable than popup)
            window.open(authUrl, '_blank', 'noopener')

            setLoading(false)
            setWaitingForLogin(true)

            // Start watching for localStorage callback
            startWatching()

        } catch (err: any) {
            if (isMounted.current) {
                console.error('Tidal Login Init Failed:', err)
                setError(err.message || 'Failed to initialize Tidal login')
                setLoading(false)
            }
        }
    }

    const startWatching = () => {
        stopWatching()

        // Check localStorage for login result (every 500ms)
        checkIntervalRef.current = setInterval(() => {
            const storedResult = localStorage.getItem('tidal_login_result')
            if (storedResult) {
                try {
                    const data = JSON.parse(storedResult)
                    // Check if this is a recent result (within last 60 seconds)
                    if (data.timestamp && Date.now() - data.timestamp < 60000) {
                        localStorage.removeItem('tidal_login_result')
                        handleLoginSuccess(data.response)
                        return
                    }
                } catch (e) {
                    console.warn('Failed to parse stored result')
                }
            }
        }, 500)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-hud-bg-card border border-hud-border-secondary rounded-xl max-w-md w-full shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-hud-border-secondary flex items-center justify-between">
                    <h2 className="text-xl font-bold text-hud-text-primary flex items-center gap-2">
                        <div className="w-8 h-8 bg-black text-white rounded flex items-center justify-center font-bold font-serif">T</div>
                        Sign in with Tidal
                    </h2>
                    <button onClick={onClose} className="text-hud-text-muted hover:text-hud-text-primary transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 flex flex-col items-center min-h-[300px] justify-center">
                    {loading ? (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                            <p className="text-gray-400 animate-pulse">Tidal 로그인 준비 중...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                                <X size={24} />
                            </div>
                            <p className="text-red-400">{error}</p>
                            <button
                                onClick={openTidalLogin}
                                className="px-4 py-2 bg-hud-bg-secondary hover:bg-hud-bg-primary border border-hud-border-secondary rounded text-sm text-hud-text-primary transition-colors"
                            >
                                다시 시도
                            </button>
                        </div>
                    ) : waitingForLogin ? (
                        <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-medium text-white mb-2">Tidal 로그인 중</h3>
                                <p className="text-sm text-gray-400">
                                    새 탭에서 Tidal 계정으로 로그인해주세요.
                                </p>
                            </div>

                            <div className="relative group w-full max-w-[240px] mb-8">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                                <div className="relative bg-black rounded-lg p-6 border border-white/10 flex flex-col items-center gap-3">
                                    <Loader2 size={32} className="text-cyan-400 animate-spin" />
                                    <span className="text-sm text-gray-300">
                                        로그인 확인 중...
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={openTidalLogin}
                                className="w-full py-3 bg-white text-black rounded font-bold hover:bg-cyan-50 transition-colors flex items-center justify-center gap-2 mb-4"
                            >
                                Tidal 로그인 페이지 다시 열기 <ExternalLink size={16} />
                            </button>

                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Check size={12} className="text-green-500" />
                                <span>로그인 완료 시 자동으로 연결됩니다</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-medium text-white mb-2">Tidal 계정 연결</h3>
                                <p className="text-sm text-gray-400">
                                    Tidal 계정을 연결하여 플레이리스트를 가져올 수 있습니다.
                                </p>
                            </div>

                            <div className="relative group w-full max-w-[280px] mb-6">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                                <div className="relative bg-black/50 rounded-lg p-5 border border-white/10">
                                    <ul className="text-sm text-gray-300 space-y-2">
                                        <li className="flex items-center gap-2">
                                            <Check size={14} className="text-cyan-400" />
                                            플레이리스트 가져오기
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check size={14} className="text-cyan-400" />
                                            고음질 스트리밍 지원
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check size={14} className="text-cyan-400" />
                                            안전한 OAuth 인증
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <button
                                onClick={openTidalLogin}
                                className="w-full py-3 bg-white text-black rounded font-bold hover:bg-cyan-50 transition-colors flex items-center justify-center gap-2"
                            >
                                Tidal 로그인 <ExternalLink size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default TidalLoginModal
