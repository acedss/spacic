import { Outlet } from "react-router-dom";
import { LeftSidebar } from "./components/LeftSidebar";
import { FriendsActivity } from "./components/FriendsActivity";
import { PlaybackControls } from "./components/PlaybackControls";
import AudioPlayer from "./components/AudioPlayer";
import { useEffect, useState } from "react";

const MainLayout = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);

    const showExpanded = !isCollapsed || isSidebarHovered;

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    return (
        <div className='h-screen flex flex-col bg-black text-white overflow-hidden'>
            {/* Audio logic only, no UI */}
            <AudioPlayer />

            {/* MAIN CONTENT AREA */}
            <div className='flex-1 flex overflow-hidden gap-2'>

                {/* LEFT SIDEBAR: Fixed width on desktop, hidden on mobile */}
                {!isMobile && (
                    <aside
                        className={`${showExpanded ? 'w-60' : 'w-16'} shrink-0 transition-all duration-300 overflow-hidden`}
                        onMouseEnter={() => setIsSidebarHovered(true)}
                        onMouseLeave={() => setIsSidebarHovered(false)}
                    >
                        <LeftSidebar
                            isCollapsed={!showExpanded}
                            onToggle={() => setIsCollapsed(prev => !prev)}
                        />
                    </aside>
                )}

                {/* MAIN SECTION: Flexible width (Home, Album, etc.) */}
                <main className='flex-1  bg-linear-to-b from-purple-900/20 to-zinc-900/90 overflow-y-auto custom-scrollbar'>
                    <Outlet />
                </main>

                {/* RIGHT SIDEBAR: Friends Activity (Sprint 3 Focus) */}
                {!isMobile && (
                    <aside className='w-70 shrink-0'>
                        <FriendsActivity />
                    </aside>
                )}
            </div>

            {/* FIXED FOOTER PLAYER */}
            <footer className='h-20 px-4 bg-black border-t border-zinc-900 shrink-0'>
                <PlaybackControls />
            </footer>
        </div>
    );
};

export default MainLayout;