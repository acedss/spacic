import { Outlet } from "react-router-dom";
import { LeftSidebar } from "./components/LeftSidebar";
import { FriendsActivity } from "./components/FriendsActivity";
import { PlaybackControls } from "./components/PlaybackControls";
import AudioPlayer from "./components/AudioPlayer";
import { RoomSessionProvider } from "@/providers/RoomSessionProvider";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const MainLayout = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    return (
        <RoomSessionProvider><div className='h-screen flex flex-col bg-[#080c10] text-white overflow-hidden relative'>
            <AudioPlayer />

            {/* Ambient glow blobs */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute -top-1/4 -right-1/4 size-[800px] bg-blue-500/5 rounded-full blur-[120px]" />
                <div className="absolute -bottom-1/4 -left-1/4 size-[700px] bg-blue-500/5 rounded-full blur-[120px]" />
            </div>

            <div className='flex-1 flex overflow-hidden gap-0 p-4 pb-0'>

                {/* LEFT SIDEBAR
                    Always w-16 in layout flow.
                    Hover → absolute overlay expands to w-60, no layout shift. */}
                {!isMobile && (
                    <div
                        className='w-16 shrink-0 relative mr-4 z-100'
                        onMouseEnter={() => setIsSidebarHovered(true)}
                        onMouseLeave={() => setIsSidebarHovered(false)}
                    >
                        <aside className={cn(
                            'h-full liquid-glass rounded-2xl overflow-hidden transition-all duration-300',
                            isSidebarHovered
                                ? 'absolute inset-y-0 left-0 w-60  shadow-2xl'
                                : 'w-full'
                        )}>
                            <LeftSidebar isCollapsed={!isSidebarHovered} />
                        </aside>
                    </div>
                )}

                <main className='flex-1 overflow-y-auto hide-scrollbar pb-32'>
                    <Outlet />
                </main>

                {!isMobile && (
                    <aside className='w-72 shrink-0 liquid-glass rounded-2xl ml-4 overflow-hidden'>
                        <FriendsActivity />
                    </aside>
                )}
            </div>

            <footer className='fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-7xl h-24 liquid-glass rounded-2xl z-50 shadow-2xl'>
                <PlaybackControls />
            </footer>
        </div></RoomSessionProvider>
    );
};

export default MainLayout;
