import { UserButton, useAuth } from "@clerk/clerk-react";
import { ChevronLeft, ChevronRight, LayoutDashboardIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import SignInOAuthButtons from "./ui/SignInOAuthButtons";
import { useAuthStore } from "@/stores/useAuthStore";

const TopBar = () => {
    const { isAdmin } = useAuthStore();
    const { isSignedIn } = useAuth();
    const navigate = useNavigate();

    return (
        <div className='sticky top-0 z-50 flex items-center justify-between px-4 h-12 border-b hair'
             style={{ background: 'oklch(0.1 0.015 285 / 0.85)', backdropFilter: 'blur(16px)' }}>
            <div className='flex items-center gap-1'>
                <button
                    onClick={() => navigate(-1)}
                    className="h-7 w-7 rounded-lg grid place-items-center press hover:bg-white/8"
                    style={{ color: 'var(--fg-3)' }}
                >
                    <ChevronLeft className="size-4" />
                </button>
                <button
                    onClick={() => navigate(1)}
                    className="h-7 w-7 rounded-lg grid place-items-center press hover:bg-white/8"
                    style={{ color: 'var(--fg-3)' }}
                >
                    <ChevronRight className="size-4" />
                </button>
            </div>
            <div className="flex items-center gap-3">
                {isAdmin && (
                    <Link
                        to="/admin"
                        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] text-white bg-white/8 ring-1 ring-white/10 hover:bg-white/12 press"
                    >
                        <LayoutDashboardIcon className="size-3" />
                        Admin
                    </Link>
                )}
                {!isSignedIn && <SignInOAuthButtons />}
                <UserButton userProfileUrl="/profile" />
            </div>
        </div>
    );
};

export default TopBar;
