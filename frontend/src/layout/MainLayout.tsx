import { Outlet } from "react-router-dom";
import { LeftSidebar } from "./components/LeftSidebar";
import { FriendsActivity } from "./components/FriendsActivity";
import { PlaybackControls } from "./components/PlaybackControls";
import AudioPlayer from "./components/AudioPlayer";
import { RoomSessionProvider } from "@/providers/RoomSessionProvider";
import { SocialSocketProvider } from "@/providers/SocialSocketProvider";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Menu, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const MainLayout = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [mobileFriendsOpen, setMobileFriendsOpen] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    return (
        <SocialSocketProvider><RoomSessionProvider><div className='h-screen flex flex-col bg-[#080c10] text-white overflow-hidden relative'>
            <AudioPlayer />

            {/* Ambient glow blobs */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute -top-1/4 -right-1/4 size-[800px] bg-blue-500/5 rounded-full blur-[120px]" />
                <div className="absolute -bottom-1/4 -left-1/4 size-[700px] bg-blue-500/5 rounded-full blur-[120px]" />
            </div>

            {/* Mobile top bar */}
            {isMobile && (
                <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setMobileNavOpen(true)}
                        className="bg-white/10 hover:bg-white/20 rounded-xl"
                    >
                        <Menu className="size-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setMobileFriendsOpen(true)}
                        className="bg-white/10 hover:bg-white/20 rounded-xl"
                    >
                        <Users className="size-5" />
                    </Button>
                </div>
            )}

            <div className='flex-1 flex overflow-hidden gap-0 p-4 pb-0'>

                {/* LEFT SIDEBAR — desktop only */}
                {!isMobile && (
                    <div
                        className='w-16 shrink-0 relative mr-4 z-100'
                        onMouseEnter={() => setIsSidebarHovered(true)}
                        onMouseLeave={() => setIsSidebarHovered(false)}
                    >
                        <aside className={cn(
                            'h-full liquid-glass rounded-2xl overflow-hidden transition-all duration-300',
                            isSidebarHovered
                                ? 'absolute inset-y-0 left-0 w-60 shadow-2xl'
                                : 'w-full'
                        )}>
                            <LeftSidebar isCollapsed={!isSidebarHovered} />
                        </aside>
                    </div>
                )}

                <main className='flex-1 overflow-y-auto hide-scrollbar pb-32'>
                    <Outlet />
                </main>

                {/* RIGHT SIDEBAR — desktop only */}
                {!isMobile && (
                    <aside className='w-72 shrink-0 liquid-glass rounded-2xl ml-4 overflow-hidden'>
                        <FriendsActivity />
                    </aside>
                )}
            </div>

            {/* Mobile nav Sheet */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetContent side="left" className="w-64 bg-zinc-950 border-white/10 p-0">
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <LeftSidebar isCollapsed={false} />
                </SheetContent>
            </Sheet>

            {/* Mobile friends Sheet */}
            <Sheet open={mobileFriendsOpen} onOpenChange={setMobileFriendsOpen}>
                <SheetContent side="right" className="w-80 bg-zinc-950 border-white/10 p-0">
                    <SheetTitle className="sr-only">Friends Activity</SheetTitle>
                    <FriendsActivity />
                </SheetContent>
            </Sheet>

            <footer className='fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-7xl h-24 liquid-glass rounded-2xl z-50 shadow-2xl'>
                <PlaybackControls />
            </footer>
        </div></RoomSessionProvider></SocialSocketProvider>
    );
};

export default MainLayout;
