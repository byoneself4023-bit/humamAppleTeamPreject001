import { Settings } from 'lucide-react'

const MusicSettings = () => {
    return (
        <div className="p-4 md:p-6">
            {/* Header */}
            <section className="hud-card hud-card-bottom rounded-xl p-8 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-hud-accent-primary/20 rounded-xl flex items-center justify-center">
                        <Settings className="w-7 h-7 text-hud-accent-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-hud-text-primary">Settings</h1>
                        <p className="text-hud-text-secondary">음악 플레이어 및 앱 설정</p>
                    </div>
                </div>
            </section>

            {/* Placeholder */}
            <section className="hud-card rounded-xl p-8 text-center">
                <p className="text-hud-text-muted">설정 기능 준비 중...</p>
            </section>
        </div>
    )
}

export default MusicSettings
