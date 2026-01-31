import TopBar from '@/components/TopBar';

const HomePage = () => {
    return (
        <div className="h-full flex flex-col">
            <TopBar />
            <div className="p-4">
                <h1 className="text-2xl font-bold">Welcome to SPACIC</h1>
                <p className="text-zinc-400">Discover and join real-time music rooms.</p>
                {/* Thêm các component khác của Sprint 2 như AlbumList ở đây */}
            </div>
        </div>
    )
}
export default HomePage;