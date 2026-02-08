import { Outlet } from 'react-router-dom'
import MusicHeader from '../components/music/MusicHeader'
import MusicSidebar from '../components/music/MusicSidebar'

const MusicLayout = () => {
    return (
        <div className="h-screen bg-hud-bg-primary hud-grid-bg overflow-hidden flex flex-col">
            <MusicSidebar />
            <MusicHeader />
            <main className="md:ml-64 pb-16 overflow-y-auto flex-1 min-h-0">
                <Outlet />
            </main>
        </div>
    )
}

export default MusicLayout
