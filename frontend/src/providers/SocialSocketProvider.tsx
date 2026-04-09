// Single persistent WebSocket for all social events (friend activity, creator status).
// Replaces the separate io() calls in FriendsActivity + LeftSidebar.
// Room-specific socket (useRoomSocket) stays separate — it has a join/leave lifecycle.

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@clerk/clerk-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin

const SocialSocketContext = createContext<Socket | null>(null)

export const SocialSocketProvider = ({ children }: { children: ReactNode }) => {
    const { userId } = useAuth()
    const [socket, setSocket] = useState<Socket | null>(null)
    const navigate = useNavigate()

    useEffect(() => {
        if (!userId) return

        const s = io(SOCKET_URL, {
            auth:       { clerkId: userId },
            transports: ['websocket', 'polling'],
        })
        setSocket(s)

        s.on('room:favorite_live', ({ roomId, title, creatorName }: {
            roomId: string
            title: string
            creatorName: string
        }) => {
            toast(`${creatorName} is live!`, {
                description: title,
                action: {
                    label: 'Join',
                    onClick: () => navigate(`/rooms/${roomId}`),
                },
                duration: 8000,
            })
        })

        return () => {
            s.disconnect()
            setSocket(null)
        }
    }, [userId, navigate])

    return (
        <SocialSocketContext.Provider value={socket}>
            {children}
        </SocialSocketContext.Provider>
    )
}

export const useSocialSocket = () => useContext(SocialSocketContext)
