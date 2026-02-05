import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, Loader2, Music, Heart, ChevronDown, ChevronUp } from 'lucide-react'
import Button from '../../components/common/Button'
import { register } from '../../services/api/auth'
import { useAuth } from '../../contexts/AuthContext'
import TermsModal from '../../components/auth/TermsModal'
import PrivacyModal from '../../components/auth/PrivacyModal'
import { genresApi, GenreCategory } from '../../services/api/genres'
import TidalLoginModal from '../../components/auth/TidalLoginModal'

const STREAMING_SERVICES = [
    { id: 'tidal', name: 'Tidal', icon: 'T', color: 'bg-black', activeColor: 'bg-hud-accent-primary text-hud-bg-primary' },
    { id: 'youtube', name: 'YouTube', icon: '▶', color: 'bg-[#FF0000]/10 text-[#FF0000]', activeColor: 'bg-[#FF0000] text-white' },
    { id: 'apple', name: 'Apple', icon: '', color: 'bg-gradient-to-br from-pink-500 to-orange-400', activeColor: 'bg-pink-500 text-white' },
    { id: 'spotify', name: 'Spotify', icon: '●', color: 'bg-[#1DB954]/10 text-[#1DB954]', activeColor: 'bg-[#1DB954] text-black' },
    { id: 'other', name: '이외', icon: '...', color: 'bg-hud-bg-secondary text-hud-text-muted', activeColor: 'bg-hud-text-muted text-hud-bg-primary' },
]

const Register = () => {
    const navigate = useNavigate()
    const { setUser } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [agreeTerms, setAgreeTerms] = useState(false)
    const [isTermsOpen, setIsTermsOpen] = useState(false)
    const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)
    const [streamingServices, setStreamingServices] = useState<string[]>([])
    const [otherService, setOtherService] = useState('')

    // Tidal 연동 관련 상태
    const [showTidalModal, setShowTidalModal] = useState(false)
    const [tidalConnected, setTidalConnected] = useState(false)
    const [tidalAuthData, setTidalAuthData] = useState<any>(null)

    // 장르 관련 상태
    const [genreCategories, setGenreCategories] = useState<GenreCategory[]>([])
    const [selectedGenres, setSelectedGenres] = useState<string[]>([])
    const [genresLoading, setGenresLoading] = useState(true)
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['popular']) // 기본으로 인기장르 펼침

    // 장르 목록 로드
    useEffect(() => {
        const loadGenres = async () => {
            setGenresLoading(true)
            const categories = await genresApi.getGenresGrouped()
            setGenreCategories(categories)
            setGenresLoading(false)
        }
        loadGenres()
    }, [])

    const toggleCategory = (categoryCode: string) => {
        setExpandedCategories(prev =>
            prev.includes(categoryCode)
                ? prev.filter(code => code !== categoryCode)
                : [...prev, categoryCode]
        )
    }

    const toggleStreamingService = (serviceId: string) => {
        setStreamingServices(prev =>
            prev.includes(serviceId)
                ? prev.filter(id => id !== serviceId)
                : [...prev, serviceId]
        )

        // Tidal 선택 시 로그인 모달 표시
        if (serviceId === 'tidal' && !tidalConnected) {
            setShowTidalModal(true)
        }
    }

    const toggleGenre = (genreCode: string) => {
        setSelectedGenres(prev =>
            prev.includes(genreCode)
                ? prev.filter(code => code !== genreCode)
                : [...prev, genreCode]
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (!name || !email || !password || !confirmPassword) {
            setError('모든 필드를 입력해주세요')
            return
        }

        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다')
            return
        }

        if (password.length < 6) {
            setError('비밀번호는 최소 6자 이상이어야 합니다')
            return
        }

        if (!agreeTerms) {
            setError('이용약관에 동의해주세요')
            return
        }

        if (selectedGenres.length === 0) {
            setError('최소 1개 이상의 음악 장르를 선택해주세요')
            return
        }

        setIsLoading(true)

        try {
            // Include otherService if "other" is selected
            const finalServices = streamingServices.includes('other') && otherService
                ? [...streamingServices.filter(s => s !== 'other'), `other:${otherService}`]
                : streamingServices

            const response = await register({
                name,
                email,
                password,
                streamingServices: finalServices,
                genres: selectedGenres,
                // Tidal 연동 데이터 포함
                tidalConnected: tidalConnected,
                tidalVisitorId: tidalAuthData?.visitorId,
                tidalAccessToken: tidalAuthData?.accessToken,
                tidalRefreshToken: tidalAuthData?.refreshToken
            })
            setUser(response.user)

            // Redirect to onboarding if music services are selected
            if (streamingServices.length > 0) {
                const servicesParam = streamingServices.join(',')
                navigate(`/onboarding?services=${servicesParam}`)
            } else {
                navigate('/')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '회원가입에 실패했습니다')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-hud-bg-primary hud-grid-bg flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-hud-accent-primary to-hud-accent-info rounded-lg flex items-center justify-center font-bold text-xl text-hud-bg-primary">
                            H
                        </div>
                        <span className="font-bold text-2xl text-hud-text-primary text-glow">ALPHA TEAM</span>
                    </div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">Create Account</h1>
                    <p className="text-hud-text-muted mt-2">Sign up to get started with ALPHA TEAM</p>
                </div>

                {/* Register Form */}
                <div className="hud-card hud-card-bottom rounded-lg p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                        {/* Name */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your name"
                                    className="w-full pl-12 pr-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    className="w-full pl-12 pr-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Create a password"
                                    className="w-full pl-12 pr-12 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-hud-text-muted hover:text-hud-text-primary transition-hud"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">Confirm Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    className="w-full pl-12 pr-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                            </div>
                        </div>

                        {/* Favorite Genres - Category Grouped */}
                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex items-center gap-2">
                                <div className="h-[1px] flex-1 bg-hud-border-secondary/50"></div>
                                <Heart className="w-4 h-4 text-hud-accent-danger" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-hud-text-muted px-2">좋아하는 장르</span>
                                <div className="h-[1px] flex-1 bg-hud-border-secondary/50"></div>
                            </div>
                            <p className="text-[11px] text-hud-text-muted text-center -mt-1 mb-1">
                                선호하는 음악 장르를 선택해주세요. (최소 1개)
                            </p>

                            {genresLoading ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-6 h-6 animate-spin text-hud-accent-primary" />
                                </div>
                            ) : (
                                <div className="max-h-64 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                                    {genreCategories.map((category) => (
                                        <div key={category.code} className="border border-hud-border-secondary rounded-lg overflow-hidden">
                                            {/* Category Header */}
                                            <button
                                                type="button"
                                                onClick={() => toggleCategory(category.code)}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-hud-bg-secondary/50 hover:bg-hud-bg-secondary transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">{category.icon}</span>
                                                    <span className="text-xs font-semibold text-hud-text-primary">{category.nameKo}</span>
                                                    <span className="text-[10px] text-hud-text-muted">({category.genres.length})</span>
                                                    {/* 선택된 장르 수 표시 */}
                                                    {category.genres.filter(g => selectedGenres.includes(g.code)).length > 0 && (
                                                        <span className="px-1.5 py-0.5 bg-hud-accent-primary text-hud-bg-primary text-[9px] font-bold rounded-full">
                                                            {category.genres.filter(g => selectedGenres.includes(g.code)).length}
                                                        </span>
                                                    )}
                                                </div>
                                                {expandedCategories.includes(category.code) ? (
                                                    <ChevronUp className="w-4 h-4 text-hud-text-muted" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-hud-text-muted" />
                                                )}
                                            </button>

                                            {/* Genre List */}
                                            {expandedCategories.includes(category.code) && (
                                                <div className="p-2 grid grid-cols-4 gap-1.5 bg-hud-bg-primary">
                                                    {category.genres.map((genre) => (
                                                        <button
                                                            key={genre.code}
                                                            type="button"
                                                            onClick={() => toggleGenre(genre.code)}
                                                            className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition-all border ${selectedGenres.includes(genre.code)
                                                                    ? 'border-hud-accent-primary bg-hud-accent-primary/20'
                                                                    : 'border-transparent hover:border-hud-border-secondary hover:bg-hud-bg-secondary/30'
                                                                }`}
                                                            title={genre.nameEn}
                                                        >
                                                            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${genre.color} flex items-center justify-center mb-0.5 ${selectedGenres.includes(genre.code) ? 'ring-2 ring-hud-accent-primary ring-offset-1 ring-offset-hud-bg-primary' : ''
                                                                }`}>
                                                                <span className="text-xs">{genre.icon}</span>
                                                            </div>
                                                            <span className={`text-[9px] font-medium text-center leading-tight ${selectedGenres.includes(genre.code) ? 'text-hud-accent-primary' : 'text-hud-text-muted'
                                                                }`}>
                                                                {genre.nameKo}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Selected Genres Tags */}
                            {selectedGenres.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-hud-bg-secondary/30 rounded-lg">
                                    <span className="text-[10px] text-hud-text-muted mr-1">선택됨:</span>
                                    {selectedGenres.map(code => {
                                        // 모든 카테고리에서 장르 찾기
                                        const genre = genreCategories.flatMap(c => c.genres).find(g => g.code === code)
                                        return genre ? (
                                            <span
                                                key={code}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-hud-accent-primary/20 text-hud-accent-primary rounded-full text-[10px] font-medium"
                                            >
                                                {genre.icon} {genre.nameKo}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleGenre(code)}
                                                    className="ml-0.5 hover:text-hud-accent-danger"
                                                >
                                                    x
                                                </button>
                                            </span>
                                        ) : null
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Streaming Services */}
                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex items-center gap-2">
                                <div className="h-[1px] flex-1 bg-hud-border-secondary/50"></div>
                                <Music className="w-4 h-4 text-hud-accent-info" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-hud-text-muted px-2">스트리밍 서비스</span>
                                <div className="h-[1px] flex-1 bg-hud-border-secondary/50"></div>
                            </div>
                            <p className="text-[11px] text-hud-text-muted text-center -mt-1 mb-1">
                                구독 중이신 서비스를 선택해주세요. (선택사항)
                            </p>
                            <div className="grid grid-cols-5 gap-1.5">
                                {STREAMING_SERVICES.map((service) => (
                                    <button
                                        key={service.id}
                                        type="button"
                                        onClick={() => toggleStreamingService(service.id)}
                                        className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition-all border ${streamingServices.includes(service.id)
                                            ? 'bg-hud-accent-primary/20 border-hud-accent-primary text-hud-accent-primary'
                                            : 'bg-hud-bg-primary border-hud-border-secondary text-hud-text-muted hover:border-hud-text-muted'
                                            }`}
                                        title={service.name}
                                    >
                                        <div className={`w-7 h-7 rounded ${service.id === 'youtube' || service.id === 'spotify' ? 'rounded-full' : ''} flex items-center justify-center font-bold mb-1 ${streamingServices.includes(service.id) ? service.activeColor : `${service.color} text-white`
                                            } ${service.id === 'spotify' ? 'text-base' : 'text-xs'}`}>
                                            {service.icon}
                                        </div>
                                        <span className="text-[9px] font-bold">{service.name}</span>
                                    </button>
                                ))}
                            </div>
                            {streamingServices.includes('other') && (
                                <input
                                    type="text"
                                    value={otherService}
                                    onChange={(e) => setOtherService(e.target.value)}
                                    placeholder="사용 중인 서비스를 입력하세요 (예: Spotify, Melon)"
                                    className="w-full mt-3 px-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                            )}
                        </div>

                        {/* Terms */}
                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                id="agreeTerms"
                                checked={agreeTerms}
                                onChange={(e) => setAgreeTerms(e.target.checked)}
                                className="w-4 h-4 mt-0.5 rounded border-hud-border-secondary bg-hud-bg-primary text-hud-accent-primary focus:ring-hud-accent-primary cursor-pointer"
                            />
                            <label htmlFor="agreeTerms" className="text-sm text-hud-text-secondary cursor-pointer">
                                I agree to the{' '}
                                <button
                                    type="button"
                                    onClick={() => setIsTermsOpen(true)}
                                    className="text-hud-accent-primary hover:underline"
                                >
                                    Terms of Service
                                </button>
                                {' '}and{' '}
                                <button
                                    type="button"
                                    onClick={() => setIsPrivacyOpen(true)}
                                    className="text-hud-accent-primary hover:underline"
                                >
                                    Privacy Policy
                                </button>
                            </label>
                        </div>

                        {/* Submit */}
                        <Button variant="primary" fullWidth glow type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="animate-spin" size={18} />
                                    가입 중...
                                </span>
                            ) : (
                                'Create Account'
                            )}
                        </Button>
                    </form>

                    {/* Login Link */}
                    <p className="text-center text-sm text-hud-text-muted mt-6">
                        Already have an account?{' '}
                        <Link to="/login" className="text-hud-accent-primary hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>

            {/* Modals */}
            <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
            <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />

            {/* Tidal Login Modal */}
            <TidalLoginModal
                isOpen={showTidalModal}
                onClose={() => setShowTidalModal(false)}
                onSuccess={(response) => {
                    console.log('[Register] Tidal login success:', response)
                    setTidalConnected(true)
                    setTidalAuthData({
                        visitorId: response.visitorId || response.user?.userId,
                        accessToken: response.accessToken || response.access_token,
                        refreshToken: response.refreshToken || response.refresh_token
                    })
                    setShowTidalModal(false)
                }}
            />
        </div>
    )
}

export default Register
