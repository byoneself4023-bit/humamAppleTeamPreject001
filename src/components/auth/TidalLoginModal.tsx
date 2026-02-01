import { useState, useEffect, useRef } from 'react'
import { X, ExternalLink, Loader2, Check, Copy } from 'lucide-react'
import { tidalApi } from '../../services/api/tidal'

interface TidalLoginModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: (response: any) => void
}

const TidalLoginModal = ({ isOpen, onClose, onSuccess }: TidalLoginModalProps) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [userCode, setUserCode] = useState<string | null>(null)
    const [verificationUri, setVerificationUri] = useState<string | null>(null)
    const [expiresIn, setExpiresIn] = useState<number>(0)
    const [copied, setCopied] = useState(false)

    const pollTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isMounted = useRef(true)
    const hasInitialized = useRef(false)

    useEffect(() => {
        isMounted.current = true
        return () => {
            isMounted.current = false
            stopPolling()
        }
    }, [])

    useEffect(() => {
        if (isOpen) {
            if (!hasInitialized.current && !userCode) {
                initDeviceAuth()
            }
        } else {
            stopPolling()
            resetState()
            hasInitialized.current = false
        }
    }, [isOpen])

    const resetState = () => {
        setLoading(false)
        setError(null)
        setUserCode(null)
        setVerificationUri(null)
        setExpiresIn(0)
    }

    const handleCopyCode = () => {
        if (userCode) {
            navigator.clipboard.writeText(userCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const stopPolling = () => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current)
            pollTimerRef.current = null
        }
    }

    const initDeviceAuth = async () => {
        try {
            hasInitialized.current = true
            setLoading(true)
            setError(null)

            const response = await tidalApi.initDeviceAuth()

            if (!isMounted.current) return

            if (response.deviceCode) {
                setUserCode(response.userCode)
                // Ensure verificationUri has protocol
                let uri = response.verificationUri || 'link.tidal.com'
                if (!uri.startsWith('http')) {
                    uri = `https://${uri}`
                }
                setVerificationUri(uri)
                setExpiresIn(response.expiresIn)

                setLoading(false)
                startPolling(response.deviceCode, response.interval || 5)
            } else {
                throw new Error('Invalid response from server')
            }
        } catch (err: any) {
            if (isMounted.current) {
                console.error("Device Auth Init Failed:", err);
                setError(err.message || 'Failed to initialize Tidal login')
                setLoading(false)
                hasInitialized.current = false // Allow retry
            }
        }
    }

    const startPolling = (code: string, intervalSeconds: number) => {
        stopPolling()

        pollTimerRef.current = setInterval(async () => {
            try {
                const response = await tidalApi.pollToken(code)

                if (response.success && response.user) {
                    if (isMounted.current) {
                        stopPolling()
                        onSuccess(response)
                        onClose()
                    }
                } else if (response.error && response.error !== 'authorization_pending') {
                    // Only stop on fatal errors
                    if (response.error !== 'slow_down') {
                        // console.warn('Polling status:', response.error)
                    }
                }
            } catch (err) {
                console.warn('Polling error', err)
            }
        }, intervalSeconds * 1000)
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
                            <p className="text-gray-400 animate-pulse">인증 코드를 생성하고 있습니다...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                                <X size={24} />
                            </div>
                            <p className="text-red-400">{error}</p>
                            <button
                                onClick={() => initDeviceAuth()}
                                className="px-4 py-2 bg-hud-bg-secondary hover:bg-hud-bg-primary border border-hud-border-secondary rounded text-sm text-hud-text-primary transition-colors"
                            >
                                다시 시도
                            </button>
                        </div>
                    ) : userCode ? (
                        <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h3 className="text-lg font-medium text-white mb-2">기기 인증 코드</h3>
                                <p className="text-sm text-gray-400">
                                    아래 코드를 Tidal 인증 페이지에 입력하세요.
                                </p>
                            </div>

                            <div className="relative group w-full max-w-[240px] mb-8">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                                <div className="relative bg-black rounded-lg p-6 border border-white/10 flex flex-col items-center">
                                    <span className="text-3xl font-black text-white tracking-[0.2em] font-mono">
                                        {userCode}
                                    </span>
                                </div>
                                <button
                                    onClick={handleCopyCode}
                                    className="absolute -right-12 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors"
                                    title="Copy Code"
                                >
                                    {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                                </button>
                            </div>

                            <a
                                href={verificationUri || 'https://link.tidal.com'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3 bg-white text-black rounded font-bold hover:bg-cyan-50 transition-colors flex items-center justify-center gap-2 mb-4"
                            >
                                Tidal 로그인 페이지 열기 <ExternalLink size={16} />
                            </a>

                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Loader2 size={12} className="animate-spin" />
                                <span>로그인 확인 중입니다...</span>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

export default TidalLoginModal
