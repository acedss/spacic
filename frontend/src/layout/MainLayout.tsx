import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Outlet } from "react-router-dom";
import { LeftSidebar } from "./components/LeftSidebar";
import { FriendsActivity } from "./components/FriendsActivity";
import { PlaybackControls } from "./components/PlaybackControls";
import { AudioPlayer } from "./components/AudioPlayer";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";

const MainLayout = () => {
    const [isMobile, setIsMobile] = useState(false);
    const { user } = useUser();

    // Theo dõi kích thước màn hình để ẩn/hiện panel
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Lưu ý: Logic đồng bộ user vào backend nên đặt ở đây hoặc một component bọc ngoài
    useEffect(() => {
        if (user) {
            // Gọi API sync user mà mình đã thảo luận ở trên nếu cần
            console.log("Syncing user:", user.id);
        }
    }, [user]);

    return (
        <div className='h-screen flex flex-col bg-black text-white overflow-hidden'>
            {/* Component ẩn xử lý âm thanh (không render UI) */}
            <AudioPlayer />

            <ResizablePanelGroup direction='horizontal' className='flex-1 flex h-full overflow-hidden p-2 gap-2'>

                {/* CỘT TRÁI: NAVIGATION */}
                <ResizablePanel defaultSize={20} minSize={isMobile ? 0 : 10} maxSize={25}>
                    <LeftSidebar />
                </ResizablePanel>
                r
                <ResizableHandle className='w-1 bg-transparent hover:bg-purple-500/20 transition-colors' />

                {/* CỘT GIỮA: NỘI DUNG CHÍNH (Trang chủ, Phòng nghe, ví...) */}
                <ResizablePanel defaultSize={isMobile ? 80 : 60}>
                    <main className='h-full w-full rounded-lg bg-linear-to-b from-purple-900/20 to-zinc-900/90 overflow-y-auto custom-scrollbar'>
                        <Outlet />
                    </main>
                </ResizablePanel>

                {/* CỘT PHẢI: FRIENDS ACTIVITY (Chỉ hiện trên Desktop) */}
                {!isMobile && (
                    <>
                        <ResizableHandle className='w-1 bg-transparent hover:bg-purple-500/20 transition-colors' />
                        <ResizablePanel defaultSize={20} minSize={15} maxSize={25}>
                            <FriendsActivity />
                        </ResizablePanel>
                    </>
                )}
            </ResizablePanelGroup>

            {/* THANH ĐIỀU KHIỂN NHẠC CỐ ĐỊNH Ở DƯỚI */}
            <div className='h-[22.5] px-4 bg-black border-t border-zinc-900'>
                <PlaybackControls />
            </div>
        </div>
    );
};

export default MainLayout;