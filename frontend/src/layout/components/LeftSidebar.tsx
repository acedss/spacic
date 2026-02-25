import React from 'react'
import { Home, Search, Users, Target, Wallet } from 'lucide-react'

export const LeftSidebar = () => {
    return (
        <div className='flex flex-col h-full'>
            <div className='flex items-center gap-2 text-purple-300 mb-6 pl-2'>
                <img src="/spotify.svg" className=" size-10 border rounded-4xl border-indigo-900" />
                Spacic
            </div>

            <nav className='flex-1 space-y-2'>
                <a href="#" className='flex items-center gap-4 px-4 py-3 text-white hover:text-purple-300 transition-colors'>
                    <Home className='size-5' />
                    <span>Home</span>
                </a>

                <a href="#" className='flex items-center gap-4 px-4 py-3 text-white hover:text-purple-300 transition-colors'>
                    <Search className='size-5' />
                    <span>Search</span>
                </a>

                <a href="#" className='flex items-center gap-4 px-4 py-3 text-white hover:text-purple-300 transition-colors'>
                    <Users className='size-5' />
                    <span>Co-listening Rooms</span>
                </a>

                <a href="#" className='flex items-center gap-4 px-4 py-3 text-white hover:text-purple-300 transition-colors'>
                    <Target className='size-5' />
                    <span>Album Goals</span>
                </a>

                <a href="#" className='flex items-center gap-4 px-4 py-3 text-white hover:text-purple-300 transition-colors'>
                    <Wallet className='size-5' />
                    <span>Wallet</span>
                    <span className='ml-auto bg-purple-600 text-white text-xs px-2 py-1 rounded-full'>1,250</span>
                </a>
            </nav>

            <div className='mt-auto mb-4 mx-4'>
                <div className='bg-linear-to-br from-purple-600 to-pink-600 rounded-lg p-4'>
                    <h3 className='text-white font-semibold mb-1'>Go Live Now</h3>
                    <p className='text-purple-100 text-sm'>Start your own co-listening room</p>
                </div>
            </div>
        </div>
    )
}
