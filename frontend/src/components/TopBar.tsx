// import { UserButton, useAuth } from "@clerk/clerk-react";
import { UserButton } from "@clerk/clerk-react";
// import { LayoutDashboardIcon } from "lucide-react";
// import { Link } from "react-router-dom";
import SignInOAuthButtons from "./ui/SignInOAuthButtons";
// import { useAuthStore } from "@/stores/useAuthStore";
// import { buttonVariants } from "./ui/button";
// import { cn } from "@/lib/utils";


const TopBar = () => {
    // const { isAdmin } = useAuthStore();
    // console.log({ isAdmin })
    return (
        <div className='sticky top-0 flex items-center justify-between p-4 bg-zinc-900/40 '>
            <div className='flex items-center gap-2 text-purple-300'>
                <img src="/spotify.svg" className=" border-1 size-10" />
                Spacic
            </div>
            <div className="flex items-center gap-4">
                {/* {isAdmin && (
                    <Link to={"/admin"} className={cn(
                        buttonVariants({ variant: "outline" })
                    )}>
                        <LayoutDashboardIcon className="mr-2 size-4" />
                        Admin Dashboard
                    </Link>
                )}
                {!useAuth().isSignedIn && (
                    <SignInOAuthButtons></SignInOAuthButtons>
                )} */}
                <SignInOAuthButtons></SignInOAuthButtons>
                <UserButton></UserButton>
            </div>
        </div>

    )
}

export default TopBar