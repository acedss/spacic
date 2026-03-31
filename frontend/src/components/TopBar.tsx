import { useState } from "react";
import { UserButton, useAuth } from "@clerk/clerk-react";
import { ChevronLeft, ChevronRight, LayoutDashboardIcon, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import SignInOAuthButtons from "./ui/SignInOAuthButtons";
import { useAuthStore } from "@/stores/useAuthStore";
import CreateRoomModal from "@/pages/home/compoments/CreateRoomModal";

const TopBar = () => {
    const { isAdmin } = useAuthStore();
    const { isSignedIn } = useAuth();
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const navigate = useNavigate();

    return (
        <>
            <div className='z-50 sticky top-0 flex items-center justify-between p-1.5 bg-white/10 backdrop-blur-lg border-white/20 shadow-lg rounded-b-xl'>
                <div className='flex items-center gap-2 text-purple-300 text-center'>
                    <ChevronLeft
                        className="rounded-4xl hover:bg-purple-500/50 cursor-pointer"
                        onClick={() => navigate(-1)}
                    />
                    <ChevronRight
                        className="rounded-4xl hover:bg-purple-500/50 cursor-pointer"
                        onClick={() => navigate(1)}
                    />
                </div>
                <div className="flex items-center gap-4">
                    {isAdmin && (
                        <Link to={"/admin"} className="flex items-center gap-2 text-white hover:text-black bg-zinc-400/20 py-1 px-3 text-sm rounded-xl">
                            <LayoutDashboardIcon className="size-4" />
                            <p className="mr-1">Admin</p>
                        </Link>
                    )}
                    {isSignedIn && (
                        <button
                            onClick={() => setShowCreateRoom(true)}
                            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white py-1 px-3 text-sm rounded-xl transition-colors"
                        >
                            <Plus className="size-4" />
                            Create Room
                        </button>
                    )}
                    {!isSignedIn && <SignInOAuthButtons />}
                    <UserButton userProfileUrl="/profile" />
                </div>
            </div>

            <CreateRoomModal isOpen={showCreateRoom} onClose={() => setShowCreateRoom(false)} />
        </>
    );
};

export default TopBar