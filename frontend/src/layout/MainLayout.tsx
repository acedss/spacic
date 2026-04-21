import { Outlet, useLocation } from "react-router-dom";
import { LeftSidebar } from "./components/LeftSidebar";
import { FriendsActivity } from "./components/FriendsActivity";
import { PlaybackControls } from "./components/PlaybackControls";
import AudioPlayer from "./components/AudioPlayer";
import { SearchPalette } from "@/components/SearchPalette";
import { RoomSessionProvider } from "@/providers/RoomSessionProvider";
import { SocialSocketProvider } from "@/providers/SocialSocketProvider";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Menu, Users } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const MainLayout = () => {
    const location = useLocation();
    const hideRightSidebar = location.pathname.startsWith('/studio') || location.pathname.startsWith('/room');
    const isRoomPage = location.pathname.startsWith('/rooms/');

    const [isMobile, setIsMobile]           = useState(false);
    const [isSidebarHovered, setSidebarHov] = useState(false);
    // Separate expanded state — lags 220ms behind hover so text fades before width collapses
    const [isSidebarExpanded, setSidebarExp] = useState(false);
    const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [mobileFriendsOpen, setMobFriends]= useState(false);
    const [searchOpen, setSearchOpen]       = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // Global Cmd+K / Ctrl+K to open search palette
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(o => !o);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <SocialSocketProvider>
        <RoomSessionProvider>
        <div className='h-screen flex flex-col overflow-hidden relative' style={{ background: 'var(--ink-0)', color: 'var(--fg-1)', fontFamily: "'Figtree', system-ui, sans-serif" }}>
            <AudioPlayer />
            <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

            {/* Mobile top bar */}
            {isMobile && (
                <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 border-b hair">
                    <button
                        onClick={() => setMobileNavOpen(true)}
                        className="h-8 w-8 rounded-xl grid place-items-center bg-white/8 ring-1 ring-white/10"
                    >
                        <Menu className="size-4 text-white" />
                    </button>
                    <span className="serif italic text-white text-[22px]">spacic</span>
                    <button
                        onClick={() => setMobFriends(true)}
                        className="h-8 w-8 rounded-xl grid place-items-center bg-white/8 ring-1 ring-white/10"
                    >
                        <Users className="size-4 text-white" />
                    </button>
                </div>
            )}

            <div className='flex-1 flex overflow-hidden'>

                {/* LEFT SIDEBAR — collapsed spacer + floating overlay */}
                {!isMobile && (
                    <>
                        {/* Fixed-width spacer keeps main content offset */}
                        <div className='w-16 shrink-0' />
                        {/* Floating sidebar overlays on hover */}
                        <div
                            className='absolute top-0 bottom-0 left-0 z-50 border-r hair'
                            style={{
                                width: isSidebarHovered ? 220 : 64,
                                transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
                                background: 'var(--ink-1)',
                            }}
                            onMouseEnter={() => {
                                if (collapseTimer.current) clearTimeout(collapseTimer.current);
                                setSidebarHov(true);
                                setSidebarExp(true);
                            }}
                            onMouseLeave={() => {
                                setSidebarHov(false);
                                collapseTimer.current = setTimeout(() => setSidebarExp(false), 220);
                            }}
                        >
                            <div className='h-full overflow-hidden'>
                                <LeftSidebar isCollapsed={!isSidebarExpanded} />
                            </div>
                        </div>
                    </>
                )}

                <main className={cn(
                    'flex-1 hide-scrollbar',
                    // Room pages manage their own inner scroll, but we still reserve
                    // h-24 (96px) at the bottom so the fixed playback bar doesn't
                    // overlap the chat input, constellation, or queue. Without pb-24,
                    // any child using h-full extends behind the bar.
                    isRoomPage ? 'overflow-hidden pb-24' : 'overflow-y-auto pb-28',
                )}>
                    <Outlet />
                </main>

                {/* RIGHT SIDEBAR */}
                {!isMobile && !hideRightSidebar && (
                    <aside className='w-72 shrink-0 border-l hair overflow-hidden' style={{ background: 'var(--ink-1)' }}>
                        <FriendsActivity />
                    </aside>
                )}
            </div>

            {/* Mobile nav Sheet */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetContent side="left" className="w-64 p-0 border-white/10" style={{ background: 'var(--ink-1)' }}>
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <LeftSidebar isCollapsed={false} />
                </SheetContent>
            </Sheet>

            {/* Mobile friends Sheet */}
            <Sheet open={mobileFriendsOpen} onOpenChange={setMobFriends}>
                <SheetContent side="right" className="w-80 p-0 border-white/10" style={{ background: 'var(--ink-1)' }}>
                    <SheetTitle className="sr-only">Friends Activity</SheetTitle>
                    <FriendsActivity />
                </SheetContent>
            </Sheet>

            {/* Bottom playback bar */}
            <footer className={cn(
                'fixed bottom-0 right-0 h-24 border-t hair z-40 glass',
                isMobile ? 'left-0' : 'left-16'
            )}
                    style={{ background: 'oklch(0.1 0.015 285 / 0.85)' }}>
                <PlaybackControls />
            </footer>
        </div>
        </RoomSessionProvider>
        </SocialSocketProvider>
    );
};

export default MainLayout;
