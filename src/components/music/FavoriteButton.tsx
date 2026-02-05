import { useState, useEffect } from 'react'
import { Heart, Loader2 } from 'lucide-react'
import { favoritesService, FavoriteTrack } from '../../services/api/favorites'

interface FavoriteButtonProps {
    track: FavoriteTrack
    size?: 'sm' | 'md' | 'lg'
    showLabel?: boolean
    onToggle?: (isFavorited: boolean) => void
    className?: string
}

const FavoriteButton = ({ 
    track, 
    size = 'md', 
    showLabel = false,
    onToggle,
    className = ''
}: FavoriteButtonProps) => {
    const [isFavorited, setIsFavorited] = useState(false)
    const [loading, setLoading] = useState(false)
    const [checking, setChecking] = useState(true)

    // Size configurations
    const sizeConfig = {
        sm: { icon: 14, button: 'w-7 h-7', text: 'text-xs' },
        md: { icon: 18, button: 'w-9 h-9', text: 'text-sm' },
        lg: { icon: 22, button: 'w-11 h-11', text: 'text-base' }
    }

    const config = sizeConfig[size]

    // Check if track is favorited on mount
    useEffect(() => {
        const checkFavorite = async () => {
            setChecking(true)
            try {
                const result = await favoritesService.isFavorited(track)
                setIsFavorited(result)
            } catch (e) {
                console.error('[FavoriteButton] Failed to check favorite status:', e)
            } finally {
                setChecking(false)
            }
        }

        if (track.title && track.artist) {
            checkFavorite()
        }
    }, [track.title, track.artist])

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation() // Prevent triggering parent click events
        
        if (loading || checking) return

        setLoading(true)
        try {
            const newStatus = await favoritesService.toggleFavorite(track)
            setIsFavorited(newStatus)
            onToggle?.(newStatus)
        } catch (e) {
            console.error('[FavoriteButton] Failed to toggle favorite:', e)
        } finally {
            setLoading(false)
        }
    }

    if (checking) {
        return (
            <button
                disabled
                className={`flex items-center justify-center ${config.button} rounded-full bg-hud-bg-secondary/50 text-hud-text-muted ${className}`}
            >
                <Loader2 size={config.icon} className="animate-spin" />
            </button>
        )
    }

    return (
        <button
            onClick={handleToggle}
            disabled={loading}
            title={isFavorited ? '좋아요 취소' : '좋아요'}
            className={`
                flex items-center justify-center gap-1.5 rounded-full transition-all duration-200
                ${showLabel ? 'px-3 py-1.5' : config.button}
                ${isFavorited 
                    ? 'bg-hud-accent-danger/20 text-hud-accent-danger hover:bg-hud-accent-danger/30' 
                    : 'bg-hud-bg-secondary/50 text-hud-text-muted hover:text-hud-accent-danger hover:bg-hud-accent-danger/10'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${className}
            `}
        >
            {loading ? (
                <Loader2 size={config.icon} className="animate-spin" />
            ) : (
                <Heart 
                    size={config.icon} 
                    fill={isFavorited ? 'currentColor' : 'none'}
                    className={isFavorited ? 'animate-scale-up' : ''}
                />
            )}
            {showLabel && (
                <span className={config.text}>
                    {isFavorited ? '좋아요 됨' : '좋아요'}
                </span>
            )}
        </button>
    )
}

export default FavoriteButton
