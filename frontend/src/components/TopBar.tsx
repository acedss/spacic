import { UserButton, useAuth } from "@clerk/clerk-react";
import { ChevronLeft, ChevronRight, LayoutDashboardIcon } from "lucide-react";
import { Link } from "react-router-dom";
import SignInOAuthButtons from "./ui/SignInOAuthButtons";
// todo: fetch isAdmin from user storing (zustand)

const TopBar = () => {
    const isAdmin = true;
    return (
        <div className='sticky top-0 flex items-center justify-between p-4 bg-zinc-900/40 '>
            <div className='flex items-center gap-2 text-purple-300 text-center'>
                <ChevronLeft className=" rounded-4xl hover:bg-purple-500/50" />
                <ChevronRight className=" rounded-4xl hover:bg-purple-500/50" />
            </div>
            <div className="flex items-center gap-4 ">
                {isAdmin && (
                    <Link to={"/admin"} className="flex items-center gap-2 hover:bg-indigo-800 text-black hover:text-blue-100 bg-emerald-500 p-2 rounded-md">
                        <LayoutDashboardIcon className=" size-4 " />
                        <p className="mr-1 ">Admin Dashboard</p>
                    </Link>
                )}
                {!useAuth().isSignedIn && (
                    <SignInOAuthButtons></SignInOAuthButtons>
                )}
                <UserButton></UserButton>
            </div>
        </div>
    )
}

export default TopBar