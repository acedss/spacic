// import { useState } from "react";
import { UserButton, useAuth } from "@clerk/clerk-react";
import { ChevronLeft, ChevronRight, LayoutDashboardIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import SignInOAuthButtons from "./ui/SignInOAuthButtons";
import { useAuthStore } from "@/stores/useAuthStore";
import { Button } from "@/components/ui/button";
// import CreateRoomModal from "@/pages/home/compoments/CreateRoomModal";

const TopBar = () => {
    const { isAdmin } = useAuthStore();
    const { isSignedIn } = useAuth();
    // const [showCreateRoom, setShowCreateRoom] = useState(false);
    const navigate = useNavigate();

    return (
        <>
            <div className='z-50 sticky top-0 flex items-center justify-between p-1.5 bg-white/10 backdrop-blur-lg border-white/20 shadow-lg rounded-b-xl'>
                <div className='flex items-center gap-1 text-purple-300'>
                    <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} className="rounded-full hover:bg-purple-500/20 hover:text-purple-300">
                        <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => navigate(1)} className="rounded-full hover:bg-purple-500/20 hover:text-purple-300">
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-3">
                    {isAdmin && (
                        <Button variant="ghost" size="sm" asChild className="bg-zinc-400/20 hover:bg-zinc-400/30 text-white rounded-xl">
                            <Link to="/admin">
                                <LayoutDashboardIcon className="size-4" />
                                Admin
                            </Link>
                        </Button>
                    )}
                    {/* {isSignedIn && (
                        <Button size="sm" onClick={() => setShowCreateRoom(true)} className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl">
                            <Plus className="size-4" />
                            Create Room
                        </Button>
                    )} */}
                    {!isSignedIn && <SignInOAuthButtons />}
                    <UserButton userProfileUrl="/profile" />
                </div>
            </div>

            {/* <CreateRoomModal isOpen={showCreateRoom} onClose={() => setShowCreateRoom(false)} /> */}
        </>
    );
};

export default TopBar