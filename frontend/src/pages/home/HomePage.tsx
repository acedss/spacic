import TopBar from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress"
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Eye, Heart, Radio, Share2 } from 'lucide-react';
// import SectionGrid from "./compoments/RoomSectionGrid";

const HomePage = () => {
    const rooms = [
        { id: '1', name: 'The Weeknd nights', author: 'John Doe', roomImg: 'https://tse4.mm.bing.net/th/id/OIP.rTvHGE1fz9FZsAbGQQB2GAHaNK?w=1440&h=2560&rs=1&pid=ImgDetMain&o=7&rm=3', description: { listener: 120, likes: 4500, totalStream: 80000, goalProgress: 75 } },
        { id: '2', name: 'Billie Eilish dorm', author: 'Jane Smith', roomImg: 'https://images.unsplash.com/photo-1465869185982-5a1a7522cbcb?auto=format&fit=crop&w=300&q=80', description: { listener: 200, likes: 8000, totalStream: 120000, goalProgress: 50 } },
        { id: '3', name: 'Late Night Jazz', author: 'Alice Johnson', roomImg: 'https://images.unsplash.com/photo-1494337480532-3725c85fd2ab?auto=format&fit=crop&w=300&q=80', description: { listener: 80, likes: 3000, totalStream: 45000, goalProgress: 90 } },
        { id: '4', name: 'Top 40', author: 'Bob Brown', roomImg: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=300&q=80', description: { listener: 150, likes: 6000, totalStream: 95000, goalProgress: 60 } },
        { id: '5', name: 'Indie Mix', author: 'Charlie Davis', roomImg: 'https://images.unsplash.com/photo-1512227728229-6c7f7b2e2a6c?auto=format&fit', description: { listener: 90, likes: 4000, totalStream: 60000, goalProgress: 80 } },
        { id: '6', name: 'Classical Essentials', author: 'Diana Evans', roomImg: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=300&q=80', description: { listener: 60, likes: 2500, totalStream: 30000, goalProgress: 70 } },
    ]

    const creators = [
        { id: '1', name: 'John Doe', avatar: 'https://www.profilebakery.com/wp-content/uploads/2024/03/professional-headshot-with-dark-gray-background-blue-suit.jpg', genre: 'Pop', followers: 5000 },
        { id: '2', name: 'Jane Smith', avatar: 'https://media.licdn.com/dms/image/D5603AQEspx17ckDPig/profile-displayphoto-shrink_800_800/0/1693854480147?e=2147483647&v=beta&t=mYYNMpPCNIRbPYTGkWtidIZNTKdR7NHDrp4oo06F9GA', genre: 'Rock', followers: 8000 },
        { id: '3', name: 'Alice Johnson', avatar: 'https://media.licdn.com/dms/image/C4E03AQFTHvNpcKeUeA/profile-displayphoto-shrink_800_800/0/1649618785168?e=2147483647&v=beta&t=t9F8eH8U465wDWG7T4zg2VSA4Bgyhoy4sGX6VsefF1o', genre: 'Jazz', followers: 3000 },
        { id: '4', name: 'Bob Brown', avatar: 'https://images-pw.pixieset.com/elementfield/585425073/Medha_Headshots0044_1-d962c6ee-1000.jpg', genre: 'Hip-Hop', followers: 6000 },
    ]
    return (
        <div className="flex flex-col h-full bg-linear-to-b from-purple-900/60 text-white">
            <TopBar />
            <div className="p-4">
                <h1 className="text-2xl font-bold">Good evening, Hau</h1>
                <p className="text-zinc-400">Join live co-listening rooms or support album goals.</p>
                {/* Thêm các component khác của Sprint 2 ở đây */}
                <div className="space-y-8">
                    {/* <RoomSectionGrid rooms={rooms} /> */}
                    <div className='mb-8 mt-8 fe'>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold sm:text-2xl">Co-listent rooms you can join</h2>
                            <Button variant="link" className="text-sm text-zinc-400 hover:text-white">
                                Show all
                            </Button>
                        </div>
                        <ScrollArea className=" rounded-md  p-2  whitespace-nowrap">
                            <div className="flex w-max space-x-4 p-4">
                                {rooms.map((room) => (
                                    <div key={room.id} className="shrink-0 bg-indigo-800/30 p-4 rounded-lg">
                                        {/* fix live status  */}
                                        <div className="relative">
                                            <div className=' absolute top-2 ml-2 px-1.5 flex bg-red-500 text-zinc-100 rounded-2xl text-xs'>
                                                <Radio className='h-4 w-4' />

                                                <p className='pl-1 font-medium'>Live</p>
                                            </div>

                                        </div>
                                        <div className="overflow-hidden rounded-md">
                                            <img src={room.roomImg} alt={room.name} className="aspect-video h-56 w-48 object-cover rounded-lg" />
                                        </div>
                                        <div className="pt-2">
                                            <h3 className="text-sm font-semibold">{room.name}</h3>
                                            <p className="text-xs text-zinc-200">by {room.author}</p>
                                            <div className="my-2 flex items-center justify-between text-xs text-zinc-400">
                                                <div className='flex'>
                                                    <Eye strokeWidth={2} className='h-3 w-3 mt-0.5 mr-0.5 text-purple-400' />
                                                    <span>{room.description.listener} listeners</span>
                                                </div>
                                                <div className='flex'>
                                                    <Heart className='h-3 w-3 mt-0.5 mr-0.5 text-pink-600' fill='red' />
                                                    <span>{room.description.likes} likes</span>
                                                </div>
                                            </div>
                                            {/* Goal progress */}
                                            <div>
                                                <div className=' flex justify-between text-xs py-1'>
                                                    <p>Album funding</p>
                                                    <p>{room.description.goalProgress}%</p>
                                                </div>
                                                <Progress value={room.description.goalProgress} className=" bg-linear-to-r bg-zinc-800 [&>div]:bg-linear-to-r [&>div]:from-indigo-300 [&>div]:via-purple-500 [&>div]:to-pink-400 [&>div]:rounded-full " />
                                            </div>
                                        </div>
                                        <div className='flex  items-center gap-2 md:flex-row '>
                                            <Button variant="default" className="w-fit px-8 bg-purple-700 text-white mt-4">Join Room</Button>
                                            <Button variant="outline" className="w-1/5 ml-auto mr-1 mt-4 bg-zinc-900 text-white">
                                                <Share2 />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <ScrollBar orientation='horizontal' hidden />
                        </ScrollArea>
                    </div>

                    <div className='mb-8 mt-8 fe'></div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold sm:text-2xl">Top creators to follow</h2>
                        <Button variant="link" className="text-sm text-zinc-400 hover:text-white">
                            Show all
                        </Button>
                    </div>
                    <ScrollArea>
                        <div className="flex w-max space-x-4 p-4">
                            {creators.map((creator) => (
                                <div key={creator.id} className="shrink-0">
                                    <div className="overflow-hidden rounded-full w-24 h-24">
                                        <img src={creator.avatar} alt={creator.name} className="object-cover w-full h-full" />
                                    </div>
                                    <div className="pt-2">
                                        <h3 className="text-sm font-semibold">{creator.name}</h3>
                                        <p className="text-xs text-zinc-400">{creator.genre}</p>
                                        <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
                                            <span>{creator.followers} followers</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                </div>

            </div>
        </div>
    )
}
export default HomePage;