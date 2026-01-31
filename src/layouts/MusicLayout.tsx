import { Outlet } from 'react-router-dom'
import MusicHeader from '../components/music/MusicHeader'
import MusicSidebar from '../components/music/MusicSidebar'

const MusicLayout = () => {
    return (
        <div className="min-h-screen bg-hud-bg-primary hud-grid-bg">
            <MusicSidebar />
            <MusicHeader />
            <main className="md:ml-64">
                <Outlet />
            </main>
        </div>
    )
}

export default MusicLayout
